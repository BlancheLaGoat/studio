// Comptes connectés (Tidal, Spotify…) : jetons stockés chiffrés par Windows (safeStorage),
// rafraîchis automatiquement avant expiration.
const fs = require('fs');
const path = require('path');
const oauth = require('./oauth');

let file = null;
let safe = null;   // electron.safeStorage, si dispo
let data = {};     // { [service]: { access_token, refresh_token, expires_at, user } }

function init({ dir, safeStorage }) {
  file = path.join(dir, 'accounts.dat');
  safe = safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage : null;
  try {
    const raw = fs.readFileSync(file);
    const text = safe ? safe.decryptString(raw) : raw.toString('utf8');
    data = JSON.parse(text) || {};
  } catch { data = {}; }
}

function save() {
  if (!file) return;
  const text = JSON.stringify(data);
  try { fs.writeFileSync(file, safe ? safe.encryptString(text) : Buffer.from(text, 'utf8')); } catch {}
}

const get = id => data[id] || null;
function set(id, val) { data[id] = val; save(); }
function remove(id) { delete data[id]; save(); }

// Renvoie un jeton valide pour ce service, rafraîchi si besoin.
async function token(id, { tokenUrl, clientId }, force = false) {
  const acc = data[id];
  if (!acc) throw new Error('Pas connecté.');
  if (!force && acc.expires_at - Date.now() > 60_000) return acc.access_token;
  if (!acc.refresh_token) { remove(id); throw new Error('Session expirée : reconnecte-toi.'); }
  try {
    const t = await oauth.refresh({ tokenUrl, clientId, refreshToken: acc.refresh_token });
    data[id] = { ...acc, ...t };
    save();
    return t.access_token;
  } catch (e) {
    // jeton révoqué ou périmé => il faut se reconnecter ; sinon c'est sûrement le réseau
    if (/\((400|401)\)/.test(e.message)) { remove(id); throw new Error('Session expirée : reconnecte-toi.'); }
    throw new Error(`Impossible de joindre le service (${e.message}).`);
  }
}

module.exports = { init, get, set, remove, token };
