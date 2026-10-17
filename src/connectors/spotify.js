// Connecteur Spotify — Web API officielle (règles du « mode développement » de 2026 :
// /me/playlists, /playlists/{id}/items, recherche limitée à 10 résultats).
const { makeClient, sleep } = require('./http');

const chunks = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

module.exports = function spotifyConnector({ base = 'https://api.spotify.com/v1', getToken, forceRefresh }) {
  const api = makeClient({ base, getToken, forceRefresh, label: 'Spotify' });
  let meCache = null;

  async function me() {
    const r = await api.get('/me');
    meCache = { id: r.id, name: r.display_name || r.id, country: r.country || null };
    return meCache;
  }

  async function* pages(path, query) {
    let next = path, q = query;
    while (next) {
      const r = await api.get(next, q ? { query: q } : undefined);
      yield r;
      next = r.next || null;
      q = null;
    }
  }

  const toTrack = t => t && t.type !== 'episode' && !t.is_local && t.uri ? {
    targetId: t.uri,
    title: t.name,
    artists: (t.artists || []).map(a => a.name),
    album: t.album ? t.album.name : null,
    durationMs: t.duration_ms || null,
    isrc: t.external_ids && t.external_ids.isrc || null,
  } : null;

  async function listPlaylists() {
    const user = meCache || await me();
    const out = [{ id: '__favorites__', name: 'Titres likés', kind: 'favorites', count: null, cover: null, owned: true, readable: true }];
    for await (const r of pages('/me/playlists', { limit: 50 })) {
      for (const p of r.items || []) {
        if (!p) continue;
        const owned = p.owner && p.owner.id === user.id;
        const tracksInfo = p.items || p.tracks; // renommé « items » en 2026
        out.push({
          id: p.id,
          name: p.name,
          description: p.description || '',
          count: tracksInfo && typeof tracksInfo.total === 'number' ? tracksInfo.total : null,
          cover: p.images && p.images.length ? (p.images[p.images.length - 1] || p.images[0]).url : null,
          owned,
          // Spotify ne donne le contenu que de tes playlists (ou collaboratives)
          readable: owned || !!p.collaborative,
          kind: 'playlist',
        });
      }
    }
    return out;
  }

  async function getTracks(pl, onProgress) {
    const out = [];
    const path = pl.id === '__favorites__' ? '/me/tracks' : `/playlists/${encodeURIComponent(pl.id)}/items`;
    for await (const r of pages(path, { limit: 50 })) {
      for (const it of r.items || []) {
        const t = toTrack(it && (it.item || it.track));
        if (t) out.push(t);
      }
      onProgress && onProgress(out.length);
    }
    return out;
  }

  // Spotify : une recherche par ISRC à la fois.
  async function findByIsrc(isrcs) {
    const out = new Map();
    for (const isrc of [...new Set(isrcs.filter(Boolean))]) {
      const r = await api.get('/search', { query: { q: `isrc:${isrc}`, type: 'track', limit: 5 } });
      const list = (r.tracks && r.tracks.items || []).map(toTrack).filter(Boolean);
      if (list.length) out.set(isrc.toUpperCase(), list);
      await sleep(60); // reste poli avec la limite de débit
    }
    return out;
  }

  async function search(query) {
    const r = await api.get('/search', { query: { q: query, type: 'track', limit: 10 } });
    await sleep(60);
    return (r.tracks && r.tracks.items || []).map(toTrack).filter(Boolean);
  }

  async function createPlaylist(name, description) {
    const r = await api.post('/me/playlists', { body: { name: name.slice(0, 100), description: (description || '').slice(0, 300), public: false } });
    return r.id;
  }

  async function addTracks(playlistId, uris, onProgress) {
    let done = 0;
    for (const part of chunks(uris, 100)) {
      await api.post(`/playlists/${encodeURIComponent(playlistId)}/items`, { body: { uris: part } });
      done += part.length;
      onProgress && onProgress(done);
    }
  }

  return { me, listPlaylists, getTracks, findByIsrc, search, createPlaylist, addTracks, isrcBatched: false };
};
