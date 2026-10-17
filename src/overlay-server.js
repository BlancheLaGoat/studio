// Petit serveur local pour l'overlay OBS (source « Navigateur »).
//   http://127.0.0.1:4848/overlay  -> la carte « en écoute »
//   http://127.0.0.1:4848/now      -> l'état en JSON (pour tes propres outils)
// N'écoute que sur 127.0.0.1 : rien n'est accessible depuis le réseau.
const http = require('http');
const fs = require('fs');
const path = require('path');

let server = null;
let current = { title: null, playing: false };
const clients = new Set();
let log = () => {};

function start(port) {
  if (server) return Promise.resolve(true);
  return new Promise(resolve => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (url.pathname === '/' || url.pathname === '/overlay') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        const html = fs.readFileSync(path.join(__dirname, 'overlay.html'), 'utf8').replace(/\{\{APP\}\}/g, require('./editions').edition.name);
        return res.end(html);
      }
      if (url.pathname === '/now') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(current));
      }
      if (url.pathname === '/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify(current)}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.on('error', err => {
      log(`[overlay] impossible d'ouvrir le port ${port} : ${err.message}`);
      server = null;
      resolve(false);
    });
    server.listen(port, '127.0.0.1', () => { log(`[overlay] http://127.0.0.1:${port}/overlay`); resolve(true); });
  });
}

function stop() {
  for (const c of clients) { try { c.end(); } catch {} }
  clients.clear();
  if (server) { server.close(); server = null; }
}

function update(np) {
  current = np;
  const msg = `data: ${JSON.stringify(np)}\n\n`;
  for (const c of clients) { try { c.write(msg); } catch {} }
}

module.exports = { start, stop, update, running: () => !!server, setLogger(fn) { log = fn; } };
