// Réglages communs aux trois applis.
const { edition } = require('./editions');

// ID de l'application Discord de l'édition (voir editions.js). Pas un secret.
// Pour en créer une : https://discord.com/developers/applications → New Application → nom de l'appli
// → copie l'« Application ID ». Dans « Rich Presence → Art Assets », ajoute l'icône de l'appli avec
// comme nom l'id de l'édition (« platine », « pellicule » ou « studio »). Vide = Discord désactivé.
const DISCORD_CLIENT_ID = edition.discordId || '';

// Port local de l'overlay OBS : http://127.0.0.1:<port>/overlay
const OVERLAY_PORT = 4848;

// --- Playlists (lecture, transfert, sauvegarde) ---
// IDs client de tes applis développeur (publics, pas de secret nécessaire).
// Dans chaque appli, l'adresse de redirection est : http://127.0.0.1:4849/callback
//   Tidal   : https://developer.tidal.com/dashboard
//   Spotify : https://developer.spotify.com/dashboard
const TIDAL_CLIENT_ID = 'UyJ1xYZeoydpcIZi';
const SPOTIFY_CLIENT_ID = 'b8dc132c8e14433ca8bca32bec78c1c5';

// Port local utilisé uniquement pendant la connexion (doit correspondre à l'adresse de redirection).
const AUTH_PORT = 4849;

module.exports = { DISCORD_CLIENT_ID, OVERLAY_PORT, TIDAL_CLIENT_ID, SPOTIFY_CLIENT_ID, AUTH_PORT };
