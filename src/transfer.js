const APP = require('./editions').edition.name;
// Transfert de playlists d'une plateforme à une autre, et sauvegarde dans un fichier.
const services = require('./connectors');
const { matchAll } = require('./connectors/match');

let running = null; // { cancelled }

/**
 * @param {{from:string, to:string, playlists:Array<{id,name,description,kind}>}} job
 * @param {(p:object) => void} progress
 */
async function transfer(job, progress) {
  if (running) throw new Error('Un transfert est déjà en cours.');
  running = { cancelled: false };
  const ctl = running;
  const src = services.connector(job.from);
  const dst = services.connector(job.to);
  const fromName = services.SERVICES[job.from].name;
  const toName = services.SERVICES[job.to].name;
  const report = { from: fromName, to: toName, date: new Date().toISOString(), playlists: [] };
  const total = job.playlists.length;

  try {
    for (let i = 0; i < total; i++) {
      const pl = job.playlists[i];
      const base = { index: i, total, name: pl.name };
      if (ctl.cancelled) throw new Error('Transfert annulé.');

      progress({ ...base, phase: 'lecture', done: 0, count: null });
      const tracks = await src.getTracks(pl, n => progress({ ...base, phase: 'lecture', done: n, count: null }));

      progress({ ...base, phase: 'recherche', done: 0, count: tracks.length });
      const { found, missing } = await matchAll(
        tracks, dst,
        n => progress({ ...base, phase: 'recherche', done: n, count: tracks.length }),
        () => ctl.cancelled,
      );

      const entry = {
        name: pl.name,
        total: tracks.length,
        found: found.length,
        byIsrc: found.filter(f => f.how === 'isrc').length,
        missing: missing.map(t => ({ title: t.title, artists: t.artists, album: t.album })),
        created: false,
      };

      if (found.length) {
        progress({ ...base, phase: 'création', done: 0, count: found.length });
        const name = pl.kind === 'favorites' ? `${pl.name} (${fromName})` : pl.name;
        const desc = `Transférée depuis ${fromName} avec ${APP}`;
        const newId = await dst.createPlaylist(name, pl.description ? `${pl.description} — ${desc}` : desc);
        await dst.addTracks(newId, found.map(f => f.cand.targetId),
          n => progress({ ...base, phase: 'ajout', done: n, count: found.length }));
        entry.created = true;
        entry.newName = name;
      }
      report.playlists.push(entry);
      progress({ ...base, phase: 'terminé', done: tracks.length, count: tracks.length, entry });
    }
    report.cancelled = false;
  } catch (e) {
    report.error = e.message;
    report.cancelled = ctl.cancelled;
  } finally {
    running = null;
  }
  return report;
}

function cancel() { if (running) running.cancelled = true; }

// Sauvegarde : toutes les playlists d'une plateforme, avec leurs titres.
async function backup(serviceId, progress) {
  const c = services.connector(serviceId);
  const name = services.SERVICES[serviceId].name;
  const lists = (await c.listPlaylists()).filter(p => p.readable);
  const out = { platform: name, exportedAt: new Date().toISOString(), app: APP, playlists: [] };
  for (let i = 0; i < lists.length; i++) {
    const pl = lists[i];
    progress && progress({ index: i, total: lists.length, name: pl.name });
    let tracks = [];
    let error = null;
    try { tracks = await c.getTracks(pl); } catch (e) { error = e.message; }
    out.playlists.push({
      name: pl.name, description: pl.description || '', kind: pl.kind,
      tracks: tracks.map(t => ({ title: t.title, artists: t.artists, album: t.album, isrc: t.isrc, durationMs: t.durationMs })),
      ...(error ? { error } : {}),
    });
  }
  return out;
}

function toCsv(backupData) {
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Playlist', 'Titre', 'Artistes', 'Album', 'ISRC', 'Durée']];
  for (const pl of backupData.playlists) {
    for (const t of pl.tracks) {
      const sec = t.durationMs ? Math.round(t.durationMs / 1000) : null;
      rows.push([pl.name, t.title, (t.artists || []).join(', '), t.album, t.isrc,
        sec == null ? '' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`]);
    }
  }
  return '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n'); // BOM + « ; » => s'ouvre bien dans Excel FR
}

module.exports = { transfer, cancel, backup, toCsv, isRunning: () => !!running };
