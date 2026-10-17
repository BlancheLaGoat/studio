// Plateformes dont l'appli sait lire / créer les playlists.
// Pour en ajouter une : un connecteur (voir tidal.js / spotify.js) + une entrée ici.
const config = require('../config');
const accounts = require('./accounts');
const oauth = require('./oauth');
const tidalConnector = require('./tidal');
const spotifyConnector = require('./spotify');

const env = process.env; // permet de pointer vers de fausses API pendant les tests

const SERVICES = {
  tidal: {
    id: 'tidal',
    name: 'Tidal',
    accent: '#33ffee',
    clientId: () => config.TIDAL_CLIENT_ID,
    authUrl: env.STUDIO_TIDAL_AUTH || 'https://login.tidal.com/authorize',
    tokenUrl: env.STUDIO_TIDAL_TOKEN || 'https://auth.tidal.com/v1/oauth2/token',
    apiBase: env.STUDIO_TIDAL_API || 'https://openapi.tidal.com/v2',
    scopes: ['user.read', 'collection.read', 'playlists.read', 'playlists.write', 'search.read'],
    make: tidalConnector,
    devPortal: 'https://developer.tidal.com/dashboard',
  },
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    accent: '#1ed760',
    clientId: () => config.SPOTIFY_CLIENT_ID,
    authUrl: env.STUDIO_SPOTIFY_AUTH || 'https://accounts.spotify.com/authorize',
    tokenUrl: env.STUDIO_SPOTIFY_TOKEN || 'https://accounts.spotify.com/api/token',
    apiBase: env.STUDIO_SPOTIFY_API || 'https://api.spotify.com/v1',
    scopes: ['playlist-read-private', 'playlist-read-collaborative', 'playlist-modify-private', 'playlist-modify-public', 'user-library-read'],
    make: spotifyConnector,
    devPortal: 'https://developer.spotify.com/dashboard',
  },
};

const connectors = new Map();

function connector(id) {
  const s = SERVICES[id];
  if (!s) throw new Error(`Plateforme inconnue : ${id}`);
  if (!accounts.get(id)) throw new Error(`${s.name} n'est pas connecté.`);
  if (!connectors.has(id)) {
    const opts = { tokenUrl: s.tokenUrl, clientId: s.clientId() };
    connectors.set(id, s.make({
      base: s.apiBase,
      getToken: () => accounts.token(id, opts),
      forceRefresh: () => accounts.token(id, opts, true),
    }));
  }
  return connectors.get(id);
}

function list() {
  return Object.values(SERVICES).map(s => {
    const acc = accounts.get(s.id);
    return {
      id: s.id, name: s.name, accent: s.accent,
      configured: !!s.clientId(),
      connected: !!acc,
      user: acc && acc.user ? acc.user.name : null,
      devPortal: s.devPortal,
    };
  });
}

async function connect(id, openExternal) {
  const s = SERVICES[id];
  if (!s.clientId()) throw new Error(`Ajoute ${id.toUpperCase()}_CLIENT_ID dans src/config.js (voir le README).`);
  const tok = await oauth.authorize({
    name: s.name, authUrl: s.authUrl, tokenUrl: s.tokenUrl, clientId: s.clientId(),
    scopes: s.scopes, port: config.AUTH_PORT, openExternal,
  });
  accounts.set(id, tok);
  connectors.delete(id);
  try {
    const user = await connector(id).me();
    accounts.set(id, { ...accounts.get(id), user });
  } catch (e) {
    accounts.remove(id);
    connectors.delete(id);
    throw e;
  }
}

function disconnect(id) {
  accounts.remove(id);
  connectors.delete(id);
}

module.exports = { SERVICES, list, connect, disconnect, connector };
