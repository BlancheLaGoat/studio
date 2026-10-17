// Retrouver un titre d'une plateforme sur une autre.
// 1) par ISRC (code unique de l'enregistrement) ; 2) sinon par titre + artiste + durée.

const norm = s => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s*[([].*?(feat|ft\.|with|remaster|version|edit|mix|live|mono|stereo|explicit|deluxe|bonus).*?[)\]]/g, '')
  .replace(/\s+-\s+.*(remaster|version|edit|live|mono|stereo).*$/g, '')
  .replace(/\b(feat|ft)\.?\s.*$/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokens = s => new Set(norm(s).split(' ').filter(Boolean));

function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  if (norm(a) === norm(b)) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size); // coefficient de Dice
}

function artistScore(src, cand) {
  const S = (src.artists || []).map(norm).filter(Boolean);
  const C = (cand.artists || []).map(norm).filter(Boolean);
  if (!S.length || !C.length) return 0.5;
  for (const s of S) for (const c of C) if (s === c || s.includes(c) || c.includes(s)) return 1;
  return Math.max(...S.flatMap(s => C.map(c => similarity(s, c))));
}

function durationScore(src, cand) {
  if (!src.durationMs || !cand.durationMs) return 0.5;
  const d = Math.abs(src.durationMs - cand.durationMs) / 1000;
  return d <= 3 ? 1 : d <= 8 ? 0.7 : d <= 20 ? 0.3 : 0;
}

function score(src, cand) {
  return similarity(src.title, cand.title) * 0.5 + artistScore(src, cand) * 0.35 + durationScore(src, cand) * 0.15;
}

const best = (src, cands) => {
  let top = null, topScore = -1;
  for (const c of cands || []) { const s = score(src, c); if (s > topScore) { top = c; topScore = s; } }
  return top ? { cand: top, score: topScore } : null;
};

/**
 * @param {Array} tracks  titres de la playlist d'origine
 * @param {object} target connecteur de la plateforme d'arrivée
 * @param {(done:number) => void} onProgress
 * @param {() => boolean} cancelled
 * @returns {Promise<{found: Array<{src, cand, how}>, missing: Array}>}
 */
async function matchAll(tracks, target, onProgress, cancelled = () => false) {
  const results = new Array(tracks.length).fill(null);
  let done = 0;
  const tick = () => onProgress && onProgress(++done);

  // 1) ISRC
  const withIsrc = tracks.map((t, i) => [t, i]).filter(([t]) => t.isrc);
  if (withIsrc.length) {
    const byIsrc = await target.findByIsrc(withIsrc.map(([t]) => t.isrc));
    for (const [t, i] of withIsrc) {
      const pick = best(t, byIsrc.get(t.isrc.toUpperCase()));
      if (pick) { results[i] = { src: t, cand: pick.cand, how: 'isrc' }; tick(); }
    }
  }

  // 2) recherche texte pour le reste
  for (let i = 0; i < tracks.length; i++) {
    if (results[i]) continue;
    if (cancelled()) throw new Error('Transfert annulé.');
    const t = tracks[i];
    const artist = (t.artists || [])[0] || '';
    const queries = [`${norm(t.title)} ${norm(artist)}`.trim(), norm(t.title)];
    let pick = null;
    for (const q of queries) {
      if (!q) continue;
      let cands = [];
      try { cands = await target.search(q); } catch { cands = []; }
      const b = best(t, cands);
      if (b && b.score >= 0.72 && (!pick || b.score > pick.score)) pick = b;
      if (pick && pick.score >= 0.9) break;
    }
    if (pick) results[i] = { src: t, cand: pick.cand, how: 'recherche' };
    tick();
  }

  const found = [], missing = [];
  results.forEach((r, i) => (r ? found.push(r) : missing.push(tracks[i])));
  return { found, missing };
}

module.exports = { matchAll, score, norm, similarity };
