// Un seul code, trois applis. Chaque « édition » choisit ses plateformes et ses fonctions.
//  - Platine   : la musique
//  - Pellicule : la vidéo (+ X)
//  - Studio    : tout, rangé en sections Musique / Vidéo / Réseaux
//
// L'édition est fixée au moment du build (scripts/build.js écrit "edition" dans le package.json
// de l'appli). En développement : npm start (Studio), npm run start:platine, npm run start:pellicule.

const EDITIONS = {
  platine: {
    id: 'platine',
    name: 'Platine',
    appId: 'com.blanchelagoat.platine',
    repo: 'platine',
    icon: 'assets/icons/platine.png',
    description: 'Toutes tes plateformes de musique (Tidal, Spotify, Deezer…) dans une appli desktop stable, qualité max (Widevine).',
    platforms: ['tidal', 'spotify', 'deezer', 'qobuz', 'applemusic', 'amazonmusic', 'ytmusic', 'youtube', 'twitch', 'soundcloud'],
    sections: false,
    pickerTitle: 'Choisis ta plateforme',
    // ID de l'appli Discord « Platine » (pas un secret)
    discordId: '1559302656529539136',
    features: {
      playlists: true,   // fenêtre Playlists (Tidal / Spotify)
      overlay: true,     // overlay OBS
      mini: true,        // mini-lecteur
      floating: false,   // mode flottant (petite vidéo au premier plan)
    },
    defaults: {
      pauseOnSwitch: false, // la vidéo YouTube/Twitch continue quand on change d'onglet (comme avant)
      pauseOnClose: false,  // fermer la fenêtre ne coupe rien : la musique continue près de l'horloge
      discord: true,        // affichage Discord activé si l'ID est rempli
    },
  },

  pellicule: {
    id: 'pellicule',
    name: 'Pellicule',
    appId: 'com.blanchelagoat.pellicule',
    repo: 'pellicule',
    icon: 'assets/icons/pellicule.png',
    description: 'Netflix, Disney+, Prime Video, Viki, YouTube, Twitch et X dans une appli desktop stable, avec anti-pub YouTube et Twitch.',
    platforms: ['netflix', 'disneyplus', 'primevideo', 'viki', 'youtube', 'twitch', 'x'],
    sections: false,
    pickerTitle: 'Qu\'est-ce qu\'on regarde ?',
    discordId: '',
    features: { playlists: false, overlay: false, mini: false, floating: true },
    defaults: { pauseOnSwitch: true, pauseOnClose: true, discord: false },
  },

  studio: {
    id: 'studio',
    name: 'Studio',
    appId: 'com.blanchelagoat.studio',
    repo: 'studio',
    icon: 'assets/icons/studio.png',
    description: 'Musique, vidéo et réseaux dans une seule appli desktop : Tidal, Spotify, Netflix, Disney+, YouTube, Twitch, X…',
    platforms: [
      'tidal', 'spotify', 'deezer', 'qobuz', 'applemusic', 'amazonmusic', 'ytmusic', 'soundcloud',
      'netflix', 'disneyplus', 'primevideo', 'viki', 'youtube', 'twitch',
      'x',
    ],
    sections: true,
    pickerTitle: 'Qu\'est-ce qu\'on lance ?',
    // ID de l'appli Discord « Studio » (pas un secret)
    discordId: '1560839370121019423',
    // jamais affichés sur Discord
    discordExclude: ['twitch', 'x'],
    features: { playlists: true, overlay: true, mini: true, floating: true },
    // pauses : seulement les vidéos et X (la musique continue toujours)
    defaults: { pauseOnSwitch: true, pauseOnClose: true, discord: true },
  },
};

const SECTIONS = [
  { kind: 'music', title: 'Musique' },
  { kind: 'video', title: 'Vidéo' },
  { kind: 'social', title: 'Réseaux' },
];

function current() {
  let id = process.env.STUDIO_EDITION;
  if (!id) { try { id = require('../package.json').edition; } catch {} }
  return EDITIONS[id] || EDITIONS.studio;
}

module.exports = { EDITIONS, SECTIONS, current, edition: current() };
