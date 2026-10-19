// Toutes les plateformes connues. Chaque appli (voir editions.js) en affiche une partie.
// kind : 'music' | 'video' | 'social' (sections de l'écran d'accueil de Studio, et comportement :
//        une musique continue quand on change d'onglet ou ferme la fenêtre, une vidéo se met en pause).
// url : page d'ouverture ; domains : sites qui restent dans l'appli (le reste s'ouvre dans ton navigateur).
// multi : plusieurs onglets possibles en mode onglets ; adblock : anti-pub (YouTube, Twitch).
module.exports = [
  {
    id: 'tidal', kind: 'music', name: 'Tidal', color: '#1a1a1a', accent: '#33ffee',
    url: 'https://listen.tidal.com/',
    domains: ['tidal.com'],
  },
  {
    id: 'spotify', kind: 'music', name: 'Spotify', color: '#123d24', accent: '#1ed760',
    url: 'https://open.spotify.com/',
    domains: ['spotify.com', 'spotifycdn.com'],
  },
  {
    id: 'deezer', kind: 'music', name: 'Deezer', color: '#2b1240', accent: '#a238ff',
    url: 'https://www.deezer.com/fr/',
    domains: ['deezer.com', 'dzcdn.net'],
  },
  {
    id: 'qobuz', kind: 'music', name: 'Qobuz', color: '#0d2233', accent: '#4fb3ff',
    url: 'https://play.qobuz.com/',
    domains: ['qobuz.com'],
  },
  {
    id: 'applemusic', kind: 'music', name: 'Apple Music', color: '#3a1018', accent: '#ff4e6b',
    url: 'https://music.apple.com/',
    domains: ['apple.com'],
  },
  {
    id: 'amazonmusic', kind: 'music', name: 'Amazon Music', color: '#0f2a30', accent: '#25d1da',
    url: 'https://music.amazon.fr/',
    domains: ['amazon.fr', 'amazon.com', 'media-amazon.com'],
  },
  {
    id: 'ytmusic', kind: 'music', name: 'YouTube Music', color: '#3a0d0d', accent: '#ff3b3b',
    url: 'https://music.youtube.com/',
    domains: ['youtube.com', 'google.com', 'gstatic.com'],
    adblock: true,
    note: 'Pubs passées automatiquement · la connexion Google peut être refusée',
  },
  {
    id: 'soundcloud', kind: 'music', name: 'SoundCloud', color: '#3a1f0a', accent: '#ff7a1a',
    url: 'https://soundcloud.com/',
    domains: ['soundcloud.com', 'sndcdn.com'],
    multi: true,
  },
  {
    id: 'netflix', kind: 'video', name: 'Netflix', color: '#1a0607', accent: '#e50914',
    url: 'https://www.netflix.com/browse',
    domains: ['netflix.com', 'nflxvideo.net', 'nflximg.net', 'nflxext.com', 'nflxso.net'],
  },
  {
    id: 'disneyplus', kind: 'video', name: 'Disney+', color: '#0b1430', accent: '#3d7bff',
    url: 'https://www.disneyplus.com/',
    domains: ['disneyplus.com', 'disney-plus.net', 'bamgrid.com', 'dssott.com', 'mydisney.com', 'go.com', 'disney.com'],
  },
  {
    id: 'primevideo', kind: 'video', name: 'Prime Video', color: '#0b1a26', accent: '#1fa8ff',
    url: 'https://www.primevideo.com/',
    domains: ['primevideo.com', 'amazon.fr', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'media-amazon.com', 'aiv-cdn.net', 'aiv-delivery.net'],
  },
  {
    id: 'viki', kind: 'video', name: 'Viki', color: '#06222a', accent: '#1ec2e8',
    url: 'https://www.viki.com/',
    domains: ['viki.com', 'viki.io', 'vikiassets.com'],
    note: 'Dramas asiatiques sous-titrés',
  },
  {
    id: 'youtube', kind: 'video', name: 'YouTube', color: '#2a0b0b', accent: '#ff4040',
    url: 'https://www.youtube.com/',
    domains: ['youtube.com', 'youtu.be', 'google.com', 'gstatic.com', 'ytimg.com'],
    adblock: true,
    multi: true, // plusieurs onglets possibles
    note: 'Pubs passées automatiquement · la connexion Google peut être refusée',
  },
  {
    id: 'twitch', kind: 'video', name: 'Twitch', color: '#1f1233', accent: '#a970ff',
    url: 'https://www.twitch.tv/',
    domains: ['twitch.tv', 'ttvnw.net', 'jtvnw.net', 'twitchcdn.net', 'twitchsvc.net'],
    adblock: true,
    multi: true, // plusieurs onglets possibles
    note: 'Pubs bloquées (TwitchAdSolutions)',
  },
  {
    id: 'x', kind: 'social', name: 'X (Twitter)', color: '#101214', accent: '#e7e9ea',
    url: 'https://x.com/home',
    // t.co (liens raccourcis) n'est volontairement pas listé : les liens partagés s'ouvrent dans ton navigateur
    domains: ['x.com', 'twitter.com', 'twimg.com'],
    multi: true,
    adblock: true,
    note: 'Pubs masquées · la connexion Google peut être refusée',
  },
];
