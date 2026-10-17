const APP = require('../editions').edition.name;
// Connexion OAuth « Authorization Code + PKCE » dans le navigateur habituel de l'utilisateur.
// Pas de secret dans l'appli : seul l'ID client (public) est utilisé.
// La plateforme renvoie vers http://127.0.0.1:<port>/callback, qu'on écoute le temps de la connexion.
const http = require('http');
const crypto = require('crypto');

// Une seule connexion à la fois : une nouvelle tentative remplace celle qui attend encore.
let pending = null;

const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const PAGE = (title, text, ok) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0b0d;color:#f2f2f4;font-family:Segoe UI,system-ui,sans-serif">
<div style="text-align:center"><div style="font-size:42px">${ok ? '✓' : '✕'}</div>
<h1 style="font-size:22px;margin:10px 0 6px">${title}</h1><p style="color:#9a9aa4;margin:0">${text}</p></div>`;

/**
 * Ouvre la page de connexion et attend le retour.
 * @returns {Promise<{access_token, refresh_token, expires_at, scope}>}
 */
async function authorize(opts) {
  if (pending) { pending.abort(); await new Promise(r => setTimeout(r, 150)); }
  return start(opts);
}

function start({ name, authUrl, tokenUrl, clientId, scopes, port, openExternal, extraParams = {}, timeoutMs = 5 * 60_000 }) {
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const verifier = b64url(crypto.randomBytes(64));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  return new Promise((resolve, reject) => {
    let done = false;
    const me = { abort: () => finish(new Error('Connexion remplacée par une nouvelle tentative.')) };
    pending = me;
    const finish = (err, val) => {
      if (done) return;
      done = true;
      if (pending === me) pending = null;
      clearTimeout(timer);
      // libère le port tout de suite (sinon une 2e connexion juste après échouerait)
      setImmediate(() => { server.close(); if (server.closeAllConnections) server.closeAllConnections(); });
      err ? reject(err) : resolve(val);
    };

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== '/callback') { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

      const err = url.searchParams.get('error');
      if (err || url.searchParams.get('state') !== state || !url.searchParams.get('code')) {
        res.end(PAGE('Connexion annulée', `Tu peux fermer cet onglet et réessayer depuis ${APP}.`, false));
        return finish(new Error(err === 'access_denied' ? 'Connexion refusée.' : `Connexion échouée (${err || 'réponse invalide'}).`));
      }
      try {
        const tok = await tokenRequest(tokenUrl, {
          grant_type: 'authorization_code',
          code: url.searchParams.get('code'),
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: verifier,
        });
        res.end(PAGE(`${name} est connecté à ${APP}`, 'Tu peux fermer cet onglet.', true));
        finish(null, tok);
      } catch (e) {
        res.end(PAGE('Connexion échouée', e.message, false));
        finish(e);
      }
    });

    server.on('error', e => finish(new Error(
      e.code === 'EADDRINUSE' || e.code === 'EACCES'
        ? `Le port ${port} est pris par un autre programme (ou réservé par Windows). Ferme les autres ${APP} ouverts et réessaie ; sinon change AUTH_PORT dans src/config.js et l'adresse de redirection de tes applis développeur.`
        : e.message,
    )));

    const timer = setTimeout(() => finish(new Error('Connexion expirée (5 min sans réponse).')), timeoutMs);

    server.listen(port, '127.0.0.1', () => {
      const q = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        code_challenge_method: 'S256',
        code_challenge: challenge,
        state,
        ...extraParams,
      });
      openExternal(`${authUrl}?${q}`);
    });
  });
}

async function refresh({ tokenUrl, clientId, refreshToken }) {
  return tokenRequest(tokenUrl, { grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });
}

async function tokenRequest(tokenUrl, body) {
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch {}
  if (!res.ok || !json.access_token) {
    throw new Error(`Jeton refusé (${res.status}) : ${json.error_description || json.error || text.slice(0, 200)}`);
  }
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || body.refresh_token || null,
    expires_at: Date.now() + (json.expires_in || 3600) * 1000,
    scope: json.scope || '',
  };
}

module.exports = { authorize, refresh };
