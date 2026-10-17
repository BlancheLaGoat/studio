// Connecteur Tidal — API officielle (https://openapi.tidal.com/v2, format JSON:API).
const { makeClient } = require('./http');

const MAX_BATCH = 20; // nombre d'éléments par requête

const parseIsoDuration = d => {
  const m = /^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/.exec(d || '');
  if (!m) return null;
  return Math.round(((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000);
};
const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

module.exports = function tidalConnector({ base = 'https://openapi.tidal.com/v2', getToken, forceRefresh, country: fixedCountry }) {
  const api = makeClient({ base, getToken, forceRefresh, label: 'Tidal', contentType: 'application/vnd.api+json' });
  const J = 'application/vnd.api+json';
  const get = (p, query) => api.request('GET', p, { query, contentType: J });
  const post = (p, body, query) => api.request('POST', p, { body, query, contentType: J });
  let country = fixedCountry || null;

  async function cc() {
    if (!country) country = (await me()).country || 'US';
    return country;
  }

  async function me() {
    const r = await get('/users/me');
    const a = r.data.attributes || {};
    country = country || a.country;
    return { id: r.data.id, name: a.username || a.firstName || 'Compte Tidal', country: a.country };
  }

  // Parcourt toutes les pages (curseur JSON:API).
  async function* pages(path, query) {
    let next = path, q = query;
    while (next) {
      const r = await get(next, q);
      yield r;
      next = r.links && r.links.next ? r.links.next.replace(/^\/v2(?=\/)/, '') : null;
      q = null; // le lien « next » contient déjà les paramètres
    }
  }

  const coverOf = (pl, included) => {
    const rel = pl.relationships && pl.relationships.coverArt && pl.relationships.coverArt.data;
    const ref = Array.isArray(rel) ? rel[0] : rel;
    if (!ref) return null;
    const art = included.find(x => x.type === 'artworks' && x.id === ref.id);
    const files = art && art.attributes && art.attributes.files || [];
    const f = files.find(x => (x.meta && x.meta.width) <= 320) || files[files.length - 1];
    return f ? f.href : null;
  };

  async function listPlaylists() {
    const country = await cc();
    const out = [{ id: '__favorites__', name: 'Titres favoris', kind: 'favorites', count: null, cover: null, owned: true, readable: true }];
    const seen = new Set();
    for await (const r of pages('/playlists', { 'filter[owners.id]': 'me', countryCode: country, include: 'coverArt' })) {
      const inc = r.included || [];
      for (const p of r.data || []) {
        seen.add(p.id);
        const a = p.attributes || {};
        out.push({ id: p.id, name: a.name, description: a.description || '', count: a.numberOfTrackItems ?? a.numberOfItems ?? null,
          cover: coverOf(p, inc), owned: true, readable: true, kind: 'playlist' });
      }
    }
    // playlists ajoutées à ta collection (créées par d'autres)
    try {
      for await (const r of pages('/userCollectionPlaylists/me/relationships/items', { countryCode: country, include: 'items,items.coverArt' })) {
        const inc = r.included || [];
        for (const ref of r.data || []) {
          if (seen.has(ref.id)) continue;
          const p = inc.find(x => x.type === 'playlists' && x.id === ref.id);
          if (!p) continue;
          const a = p.attributes || {};
          out.push({ id: p.id, name: a.name, description: a.description || '', count: a.numberOfTrackItems ?? a.numberOfItems ?? null,
            cover: coverOf(p, inc), owned: false, readable: true, kind: 'playlist' });
        }
      }
    } catch {}
    return out;
  }

  // Détails de titres (titre, artistes, album, ISRC, durée) par lots.
  async function hydrate(ids) {
    const country = await cc();
    const map = new Map();
    for (const part of chunks([...new Set(ids)], MAX_BATCH)) {
      const r = await get('/tracks', { 'filter[id]': part, countryCode: country, include: 'artists,albums' });
      for (const t of r.data || []) map.set(t.id, toTrack(t, r.included || []));
    }
    return map;
  }

  function toTrack(t, inc) {
    const a = t.attributes || {};
    const rel = t.relationships || {};
    const names = (rel.artists && rel.artists.data || [])
      .map(ref => inc.find(x => x.type === 'artists' && x.id === ref.id))
      .filter(Boolean).map(x => x.attributes.name);
    const albRef = rel.albums && rel.albums.data && rel.albums.data[0];
    const alb = albRef && inc.find(x => x.type === 'albums' && x.id === albRef.id);
    return {
      targetId: t.id,
      title: a.version ? `${a.title} (${a.version})` : a.title,
      artists: names,
      album: alb ? alb.attributes.title : null,
      durationMs: parseIsoDuration(a.duration),
      isrc: a.isrc || null,
    };
  }

  async function getTracks(pl, onProgress) {
    const country = await cc();
    const ids = [];
    const path = pl.id === '__favorites__'
      ? '/userCollectionTracks/me/relationships/items'
      : `/playlists/${encodeURIComponent(pl.id)}/relationships/items`;
    for await (const r of pages(path, { countryCode: country, locale: 'fr-FR' })) {
      for (const ref of r.data || []) if (ref.type === 'tracks') ids.push(ref.id);
      onProgress && onProgress(ids.length);
    }
    const map = await hydrate(ids);
    return ids.map(id => map.get(id)).filter(Boolean);
  }

  // Cherche par ISRC, par lots. Renvoie Map(isrc -> [candidats]).
  async function findByIsrc(isrcs) {
    const country = await cc();
    const out = new Map();
    for (const part of chunks([...new Set(isrcs.filter(Boolean))], MAX_BATCH)) {
      const r = await get('/tracks', { 'filter[isrc]': part, countryCode: country, include: 'artists,albums' });
      for (const t of r.data || []) {
        const tr = toTrack(t, r.included || []);
        if (!tr.isrc) continue;
        const k = tr.isrc.toUpperCase();
        if (!out.has(k)) out.set(k, []);
        out.get(k).push(tr);
      }
    }
    return out;
  }

  async function search(query) {
    const country = await cc();
    const r = await get('/searchResults', { 'filter[query]': query, countryCode: country, include: 'tracks', explicitFilter: 'INCLUDE' });
    const data = Array.isArray(r.data) ? r.data[0] : r.data;
    let ids = (data && data.relationships && data.relationships.tracks && data.relationships.tracks.data || []).map(x => x.id);
    if (!ids.length) ids = (r.included || []).filter(x => x.type === 'tracks').map(x => x.id);
    ids = ids.slice(0, 10);
    if (!ids.length) return [];
    const map = await hydrate(ids);
    return ids.map(id => map.get(id)).filter(Boolean);
  }

  async function createPlaylist(name, description) {
    const r = await post('/playlists', {
      data: { type: 'playlists', attributes: { name: name.slice(0, 200), description: (description || '').slice(0, 500), accessType: 'UNLISTED' } },
    }, { countryCode: await cc() });
    return r.data.id;
  }

  async function addTracks(playlistId, ids, onProgress) {
    let done = 0;
    for (const part of chunks(ids, MAX_BATCH)) {
      await post(`/playlists/${encodeURIComponent(playlistId)}/relationships/items`, {
        data: part.map(id => ({ id, type: 'tracks' })),
        meta: { onDuplicates: 'ADD' },
      }, { countryCode: await cc() });
      done += part.length;
      onProgress && onProgress(done);
    }
  }

  return { me, listPlaylists, getTracks, findByIsrc, search, createPlaylist, addTracks, isrcBatched: true };
};

module.exports.parseIsoDuration = parseIsoDuration;
