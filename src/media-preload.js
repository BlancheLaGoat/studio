// Injecté dans la page de chaque plateforme, AVANT ses propres scripts.
// On garde une copie des boutons que le site déclare à Windows (play/pause/suivant/avancer…)
// pour que l'appli puisse les appuyer, et on lit titre/artiste/pochette/position.
const { webFrame, ipcRenderer } = require('electron');

// ---------------- Anti-pub YouTube / YouTube Music ----------------
// On ne bloque aucune requête (c'est ce qui cassait le lecteur) : quand une pub démarre,
// on coupe le son, on la passe en accéléré et on clique sur « Passer » dès qu'il apparaît.
// Les bannières et encarts pub de la page sont masqués.
let adskip = false;
let twitchMode = 'vaft';
const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);
const isTwitch = /(^|\.)twitch\.tv$/.test(location.hostname);
const isX = /(^|\.)(x|twitter)\.com$/.test(location.hostname);
const isPrime = /(^|\.)primevideo\.com$/.test(location.hostname) || /(^|\.)amazon\.(com|fr|de|co\.uk|co\.jp|es|it)$/.test(location.hostname);
try {
  if (isYouTube || isTwitch || isX || isPrime) {
    const cfg = ipcRenderer.sendSync('studio:adskip') || {};
    adskip = !!cfg.on;
    twitchMode = cfg.twitchMode || 'vaft';
  }
} catch {}

// Twitch, mode « bloquer » : script TwitchAdSolutions (vaft), injecté avant les scripts de Twitch.
// Il cherche un flux sans pub et retire les segments publicitaires du live.
if (adskip && isTwitch && twitchMode === 'vaft') {
  try {
    const code = ipcRenderer.sendSync('studio:twitch-script');
    if (code) webFrame.executeJavaScript(code);
  } catch {}
}

// ---------------- Anti-pub Twitch ----------------
// Encarts pub de la page : toujours masqués.
// Mode « sourdine » : pendant une pub, on coupe le son et on cache l'image derrière un écran
// « Pub en cours », puis on remet tout comme avant (désactivé en mode « bloquer » pour ne pas
// couper le flux propre que trouve vaft).
if (adskip && isTwitch) webFrame.executeJavaScript(`(() => {
  if (window.__studioTwitchAds) return;
  window.__studioTwitchAds = true;
  const MUTE_DURING_ADS = ${twitchMode === 'mute'};

  const CSS = [
    '.stream-display-ad', '[data-a-target="sda-panel"]', '[data-test-selector="sad-overlay"]',
    '[data-a-target="outstream-ax-overlay"]', '.video-ads__container', '[data-test-selector="ad-banner-default-text"]',
    '[aria-label="Annonce"]', '[aria-label="Advertisement"]',
  ].join(',') + '{opacity:0!important;pointer-events:none!important}' +
    '.studio-ad-cover{position:absolute;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;' +
    'background:#0e0e10;color:#efeff1;font:600 15px/1.4 Inter,Roobert,Segoe UI,sans-serif;text-align:center;pointer-events:none}' +
    '.studio-ad-cover small{font-weight:400;color:#adadb8;font-size:13px}';
  const addStyle = () => {
    if (document.getElementById('studio-twitch-ads')) return;
    const st = document.createElement('style');
    st.id = 'studio-twitch-ads';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  };
  if (document.documentElement) addStyle();
  document.addEventListener('DOMContentLoaded', addStyle);

  // repères affichés par le lecteur Twitch pendant une pub
  const AD = '[data-a-target="video-ad-label"], [data-a-target="video-ad-countdown"], [data-test-selector="ad-banner-default-text"], .video-ads__container [data-a-target]';
  const state = new WeakMap(); // vidéo -> { muted, cover }

  if (MUTE_DURING_ADS) setInterval(() => {
    for (const player of document.querySelectorAll('.video-player, [data-a-target="video-player"]')) {
      const v = player.querySelector('video');
      if (!v) continue;
      const ad = !!player.querySelector(AD);
      let st = state.get(v);
      if (ad) {
        if (!st) {
          st = { muted: v.muted, cover: document.createElement('div') };
          st.cover.className = 'studio-ad-cover';
          st.cover.innerHTML = 'Pub en cours<small>Son coupé — le live reprend tout seul</small>';
          (v.parentElement || player).appendChild(st.cover);
          state.set(v, st);
        }
        if (!v.muted) v.muted = true;
      } else if (st) {
        v.muted = st.muted;
        st.cover.remove();
        state.delete(v);
      }
    }
  }, 300);
})();`);

// ---------------- Anti-pub X (Twitter) ----------------
// Les pubs sont des posts « sponsorisés » glissés dans le fil (mention « Ad », « Sponsorisé »…),
// des tendances « sponsorisées » et des encarts Premium. On les masque sans toucher au reste du site.
if (adskip && isX) webFrame.executeJavaScript(`(() => {
  if (window.__studioXAds) return;
  window.__studioXAds = true;
  // mentions affichées par X sur un post sponsorisé, selon la langue (singulier, pluriel, féminin, majuscules)
  const LABEL = /^(ads?|publicit[ée]s?|sponsoris[ée]e?s?|sponsored|promoted|promue?s?|anzeigen?|gesponsert|werbung|patrocinados?|promocionados?|publicidad|sponsorizzat[oa]|annuncio|promovidos?|広告|프로모션)$/i;
  const PREFIX = /^(Promoted by|Sponsored by|Sponsorisée? par|Promue? par|Gesponsert von|Promocionado por|Patrocinado por)\\b/i;
  const CSS = [
    '[data-testid="sidebarColumn"] [aria-label*="Premium"]',
    '[data-testid="sidebarColumn"] a[href="/i/premium_sign_up"]',
    '[data-testid="super-upsell-UpsellCardRenderProperties"]',
    '[data-testid="cellInnerDiv"]:has([data-testid="placementTracking"] [href*="/i/premium"])',
  ].join(',') + '{display:none!important}' +
    '.studio-x-ad{display:none!important}';
  const addStyle = () => {
    if (document.getElementById('studio-x-ads')) return;
    const st = document.createElement('style');
    st.id = 'studio-x-ads';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  };
  if (document.documentElement) addStyle();
  document.addEventListener('DOMContentLoaded', addStyle);

  // une cellule du fil est une pub si un petit texte (sans enfant) vaut exactement « Ad », « Sponsorisé »…
  const isAd = cell => {
    for (const el of cell.querySelectorAll('span, div')) {
      if (el.childElementCount) continue;
      const t = (el.textContent || '').trim();
      if (t.length > 40 || !t) continue;
      if (LABEL.test(t) || PREFIX.test(t)) return true;
    }
    return false;
  };
  const scan = () => {
    for (const cell of document.querySelectorAll('[data-testid="cellInnerDiv"]:not([data-studio-x])')) {
      // on attend que le post soit rempli avant de décider
      if (!cell.querySelector('article, [data-testid="trend"], [data-testid="UserCell"]')) continue;
      cell.dataset.studioX = '1';
      if (isAd(cell)) {
        // on vide la cellule : X recalcule la hauteur du fil, sans trou
        for (const child of cell.children) child.classList.add('studio-x-ad');
      }
    }
  };
  let queued = false;
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); }); } };
  new MutationObserver(queue).observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', scan);
  setInterval(scan, 1500);
})();`);

// ---------------- Anti-pub Prime Video ----------------
// Mêmes règles que uBlock Origin (uAssets) : avant que le lecteur ne les lise, on retire de ses réponses
//  - les coupures pub annoncées dans les JSON (json-prune) ;
//  - les « périodes » pub du manifeste vidéo .mpd (xml-prune).
// La vidéo elle-même et sa protection (DRM) ne sont pas touchées : seules les pubs disparaissent du programme.
if (adskip && isPrime) webFrame.executeJavaScript(`(() => {
  if (window.__studioPrimeAds) return;
  window.__studioPrimeAds = true;
  try { window.ue_adb_chk = 1; } catch (e) {}

  // ---- json-prune
  const PATHS = ['cuepointPlaylist', 'vodPlaybackUrls.result.playbackUrls.cuepoints',
    'vodPlaylistedPlaybackUrls.result.playbackUrls.pauseBehavior',
    'vodPlaylistedPlaybackUrls.result.playbackUrls.pauseAdsResolution',
    'vodPlaylistedPlaybackUrls.result.playbackUrls.intraTitlePlaylist.[-].shouldShowOnScrubBar', 'ads'];
  const pruneAt = (obj, parts) => {
    if (!obj || typeof obj !== 'object') return false;
    const [k, ...rest] = parts;
    if (k === '[-]') {
      let hit = false;
      if (Array.isArray(obj)) for (const it of obj) hit = pruneAt(it, rest) || hit;
      return hit;
    }
    if (!Object.prototype.hasOwnProperty.call(obj, k)) return false;
    if (!rest.length) { delete obj[k]; return true; }
    return pruneAt(obj[k], rest);
  };
  const prune = obj => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const p of PATHS) { try { pruneAt(obj, p.split('.')); } catch (e) {} }
    return obj;
  };
  const origParse = JSON.parse;
  JSON.parse = function () { return prune(origParse.apply(this, arguments)); };
  JSON.parse.toString = () => origParse.toString();
  const origJson = Response.prototype.json;
  Response.prototype.json = function () { return origJson.apply(this, arguments).then(prune); };

  // ---- xml-prune (manifestes .mpd)
  const XPATHS = [
    { need: '[value="Ad"]', xp: '//*[name()="Period"][.//*[@value="Ad"]] | /*[name()="MPD"]/@mediaPresentationDuration | //*[name()="Period"]/@start' },
    { need: '[value="Draper"]', xp: '//*[name()="Period"][.//*[@value="Draper"]] | /*[name()="MPD"]/@mediaPresentationDuration | //*[name()="Period"]/@start' },
    { need: '', xp: '//*[name()="Period"][.//*[name()="BaseURL" and contains(text(),"/interstitial/")]] | /*[name()="MPD"][.//*[name()="BaseURL" and contains(text(),"/interstitial/")]]/@mediaPresentationDuration | /*[name()="MPD"][.//*[name()="BaseURL" and contains(text(),"/interstitial/")]]/*[name()="Period"]/@start' },
  ];
  const pruneXml = text => {
    if (typeof text !== 'string' || text.indexOf('<MPD') < 0) return text;
    try {
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      if (doc.querySelector('parsererror')) return text;
      let changed = false;
      for (const { need, xp } of XPATHS) {
        if (need && !doc.querySelector(need)) continue;
        const res = doc.evaluate(xp, doc, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < res.snapshotLength; i++) {
          const n = res.snapshotItem(i);
          if (n.nodeType === 2) n.ownerElement.removeAttribute(n.nodeName); else n.remove();
          changed = true;
        }
      }
      return changed ? new XMLSerializer().serializeToString(doc) : text;
    } catch (e) { return text; }
  };
  const isMpd = url => /\\.mpd(\\?|$)/i.test(String(url || ''));
  const origFetch = window.fetch;
  window.fetch = function (input) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const p = origFetch.apply(this, arguments);
    if (!isMpd(url)) return p;
    return p.then(r => r.clone().text().then(t => {
      const out = pruneXml(t);
      return out === t ? r : new Response(out, { status: r.status, statusText: r.statusText, headers: r.headers });
    }).catch(() => r));
  };
  const X = XMLHttpRequest.prototype;
  const desc = n => Object.getOwnPropertyDescriptor(X, n);
  const rt = desc('responseText'), rs = desc('response');
  const cache = new WeakMap();
  const pruned = xhr => {
    if (cache.has(xhr)) return cache.get(xhr);
    const t = rt.get.call(xhr);
    const out = pruneXml(t);
    if (xhr.readyState === 4) cache.set(xhr, out);
    return out;
  };
  Object.defineProperty(X, 'responseText', { configurable: true, get() {
    return isMpd(this.responseURL) && this.readyState === 4 ? pruned(this) : rt.get.call(this);
  } });
  Object.defineProperty(X, 'response', { configurable: true, get() {
    const type = this.responseType;
    if ((type === '' || type === 'text') && isMpd(this.responseURL) && this.readyState === 4) return pruned(this);
    return rs.get.call(this);
  } });
})();`);

// ---------------- Anti-pub YouTube ----------------
// La page signale où se trouve le bouton « Passer »  ; l'appli y fait un vrai clic de souris
// (YouTube ignore parfois les clics simulés par script).
if (adskip && isYouTube) {
  window.addEventListener('message', e => {
    const d = e.source === window && e.data && e.data.__studioYtSkip;
    if (d && typeof d.x === 'number' && typeof d.y === 'number') ipcRenderer.send('studio:yt-skip', { x: d.x, y: d.y });
  });
}
if (adskip && isYouTube) webFrame.executeJavaScript(`(() => {
  if (window.__studioAdskip) return;
  window.__studioAdskip = true;

  const CSS = [
    'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-display-ad-renderer',
    'ytd-companion-slot-renderer', 'ytd-player-legacy-desktop-watch-ads-renderer', '#player-ads', '#masthead-ad',
    'ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)', 'ytd-search-pyv-renderer',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    '.ytp-ad-overlay-container', '.ytp-ad-image-overlay', 'ytmusic-mealbar-promo-renderer',
  ].join(',') + '{display:none!important}' +
    // pendant une pub : on cache l'image de la pub (le lecteur reste noir 1 ou 2 secondes)
    '.html5-video-player.ad-showing video{opacity:0!important}';

  const addStyle = () => {
    if (document.getElementById('studio-adskip')) return;
    const st = document.createElement('style');
    st.id = 'studio-adskip';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  };
  if (document.documentElement) addStyle();
  document.addEventListener('DOMContentLoaded', addStyle);

  const SKIP = [
    '.ytp-skip-ad-button', '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern', '.ytp-ad-skip-button-slot button',
    '.ytp-ad-skip-button-container button', '[id^="skip-button"] button', '.ytp-skip-ad button', 'button[class*="skip-ad"]',
  ].join(',');
  let inAd = false, saved = null, lastTrusted = 0;

  // bouton « Passer » réellement visible et cliquable
  const visibleSkip = () => [...document.querySelectorAll(SKIP)].find(b => {
    const r = b.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    const st = getComputedStyle(b);
    return st.visibility !== 'hidden' && st.display !== 'none' && +st.opacity > 0.05 && r.bottom > 0 && r.top < innerHeight;
  });

  setInterval(() => {
    const player = document.querySelector('.html5-video-player.ad-showing, .html5-video-player.ad-interrupting')
      || document.querySelector('#movie_player, .html5-video-player');
    if (!player) return;
    const v = player.querySelector('video');
    const ad = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');

    if (ad && v) {
      if (!inAd) { inAd = true; saved = { muted: v.muted, rate: v.playbackRate > 0 && v.playbackRate <= 2 ? v.playbackRate : 1 }; }
      if (!v.muted) v.muted = true;
      if (v.playbackRate !== 16) { try { v.playbackRate = 16; } catch (e) {} }
      if (v.paused && v.readyState > 2) v.play().catch(() => {});
      const btn = visibleSkip();
      if (btn) {
        try { btn.click(); } catch (e) {}
        // vrai clic de souris, au plus une fois toutes les 0,7 s
        if (Date.now() - lastTrusted > 700) {
          lastTrusted = Date.now();
          const r = btn.getBoundingClientRect();
          window.postMessage({ __studioYtSkip: { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } }, '*');
        }
      }
    } else if (inAd) {
      inAd = false;
      if (v && saved) {
        try { v.playbackRate = saved.rate; } catch (e) {}
        v.muted = saved.muted;
      }
      saved = null;
    }
    // fenêtre « les bloqueurs de pub ne sont pas autorisés » (au cas où)
    const enforce = document.querySelector('ytd-enforcement-message-view-model');
    if (enforce) {
      const dlg = enforce.closest('tp-yt-paper-dialog');
      const close = enforce.querySelector('#dismiss-button button, button[aria-label]');
      if (close) close.click(); else if (dlg) dlg.remove();
      const vv = document.querySelector('#movie_player video');
      if (vv && vv.paused) vv.play().catch(() => {});
    }
  }, 250);
})();`);

webFrame.executeJavaScript(`(() => {
  if (window.__studio) return;
  const handlers = {};
  let pos = null;
  const MS = window.MediaSession && MediaSession.prototype;
  if (MS) {
    const origSet = MS.setActionHandler;
    MS.setActionHandler = function (action, handler) {
      handlers[action] = handler;
      return origSet.call(this, action, handler);
    };
    const origPos = MS.setPositionState;
    if (origPos) {
      MS.setPositionState = function (s) {
        pos = s && s.duration ? { duration: s.duration, position: s.position || 0, rate: s.playbackRate || 1, at: Date.now() } : null;
        return origPos.call(this, s);
      };
    }
  }
  // Certains sites (Spotify…) jouent le son avec un lecteur qui n'est jamais ajouté à la page :
  // on retient tous les lecteurs qui démarrent, même invisibles.
  const known = new Set();
  const HME = window.HTMLMediaElement && HTMLMediaElement.prototype;
  if (HME) {
    const origPlay = HME.play;
    HME.play = function () { known.add(this); return origPlay.apply(this, arguments); };
  }
  for (const ev of ['play', 'playing', 'loadedmetadata']) {
    document.addEventListener(ev, e => { if (e.target instanceof HTMLMediaElement) known.add(e.target); }, true);
  }
  const media = () => {
    const all = [...new Set([...known, ...document.querySelectorAll('audio,video')])]
      .filter(m => m.currentSrc || m.src || m.srcObject);
    // priorité : celui qui joue, puis celui qui a une durée
    return all.find(m => !m.paused && !m.ended)
      || all.find(m => isFinite(m.duration) && m.duration > 0)
      || all[0] || null;
  };
  const abs = u => { try { return new URL(u, location.href).href; } catch { return null; } };

  window.__studio = {
    state() {
      const ms = navigator.mediaSession;
      const md = ms && ms.metadata;
      const m = media();
      let playing = !!ms && ms.playbackState === 'playing';
      if (m && (!ms || ms.playbackState === 'none' || !ms.playbackState)) playing = !m.paused && !m.ended;
      else if (m && !playing && ms.playbackState !== 'paused') playing = !m.paused && !m.ended;

      let position = null, duration = null;
      if (pos) {
        duration = pos.duration;
        position = pos.position + (playing ? (Date.now() - pos.at) / 1000 * pos.rate : 0);
      } else if (m && isFinite(m.duration) && m.duration > 0) {
        duration = m.duration;
        position = m.currentTime;
      }
      if (duration && position > duration) position = duration;

      let art = null;
      if (md && md.artwork && md.artwork.length) {
        // la plus grande pochette proposée
        const best = [...md.artwork].sort((a, b) => (parseInt(b.sizes) || 0) - (parseInt(a.sizes) || 0))[0];
        art = abs(best.src);
      }
      return {
        title: md ? md.title : null,
        artist: md ? md.artist : null,
        album: md ? md.album : null,
        art, playing, position, duration,
        volume: m ? m.volume : null,
        can: {
          prev: !!handlers.previoustrack,
          next: !!handlers.nexttrack,
          seek: !!handlers.seekto || !!(m && isFinite(m.duration)),
          volume: !!m,
        },
      };
    },
    // a = 'play' | 'pause' | 'toggle' | 'nexttrack' | 'previoustrack'
    //   | { seek: secondes } | { volume: 0..1 }
    action(a) {
      const m = media();
      if (a && typeof a === 'object') {
        if (typeof a.seek === 'number') {
          if (handlers.seekto) { try { handlers.seekto({ action: 'seekto', seekTime: a.seek }); return true; } catch (e) {} }
          if (m) { m.currentTime = a.seek; return true; }
        }
        if (typeof a.volume === 'number' && m) {
          m.volume = Math.max(0, Math.min(1, a.volume));
          return true;
        }
        return false;
      }
      if (a === 'toggle') a = this.state().playing ? 'pause' : 'play';
      const h = handlers[a];
      if (h) { try { h({ action: a }); return true; } catch (e) {} }
      if (m && a === 'play') { m.play(); return true; }
      if (m && a === 'pause') { m.pause(); return true; }
      return false;
    },
  };
})();`);

// =====================================================================
// Égaliseur de volume (même moteur que l'extension « Égaliseur de Volume »)
// =====================================================================
// Sites dont le son n'est pas protégé (YouTube, YouTube Music, SoundCloud, Twitch, X) :
//   chaque <video>/<audio> passe par une chaîne Web Audio
//   source → gain auto → compresseur (optionnel) → limiteur → sortie
//   le gain auto vise le volume cible à partir de la loudness mesurée (approximation LUFS, norme BS.1770).
// Tidal (son protégé, impossible à mesurer) : on lit la valeur ReplayGain que Tidal envoie à son lecteur
//   pour chaque morceau, et on ajuste le volume du lecteur en conséquence (sans toucher au son lui-même).
const VN_HOST = location.hostname;
const VN_AUDIO = /(^|\.)(youtube\.com|soundcloud\.com|twitch\.tv|x\.com|twitter\.com)$/.test(VN_HOST);
const VN_TIDAL = /(^|\.)tidal\.com$/.test(VN_HOST);
const VN_SKIP = /(^|\.)(discord\.com|discordapp\.com)$/.test(VN_HOST); // le vocal Discord garde son propre volume
let vn = null;
if (!VN_SKIP) {
  try { vn = ipcRenderer.sendSync('studio:volnorm'); } catch {}
}
const vnLog = msg => { try { ipcRenderer.send('studio:log', msg); } catch {} };

// ---------------- Volume général (tous les sites) ----------------
// Le volume réel de chaque lecteur = volume choisi sur le site × volume général de l'appli × correction Tidal.
// Le site continue de voir « son » volume (son curseur ne bouge pas). Marche aussi sur les contenus protégés.
if (vn) {
  ipcRenderer.on('studio:mastervol', (_e, m) => { window.postMessage({ __studioMaster: m }, '*'); });
  webFrame.executeJavaScript(`(() => {
  if (window.__studioVol) return;
  const m0 = ${JSON.stringify(vn.master || { level: 100, muted: false })};
  const mult = { master: m0.muted ? 0 : m0.level / 100, rg: 1 };
  const total = () => mult.master * mult.rg;
  const P = HTMLMediaElement.prototype;
  const vd = Object.getOwnPropertyDescriptor(P, 'volume');
  const userVol = new WeakMap();
  const known = new Set();
  const refs = new WeakMap();
  const track = el => { if (!refs.has(el)) { const r = new WeakRef(el); refs.set(el, r); known.add(r); } };
  const realSet = (el, v) => { try { vd.set.call(el, Math.max(0, Math.min(1, v))); } catch (e) {} };
  const userOf = el => userVol.has(el) ? userVol.get(el) : vd.get.call(el);
  const applyEl = el => {
    const u = userOf(el);
    userVol.set(el, u);
    track(el);
    realSet(el, u * total());
  };
  Object.defineProperty(P, 'volume', {
    configurable: true,
    get() { return userOf(this); },
    set(v) { userVol.set(this, v); track(this); realSet(this, v * total()); },
  });
  // lecteurs hors de la page (ex. Spotify) : on les attrape quand ils démarrent
  const play = P.play;
  P.play = function () { applyEl(this); return play.apply(this, arguments); };
  const applyAll = () => {
    for (const el of document.querySelectorAll('audio,video')) applyEl(el);
    for (const r of [...known]) { const el = r.deref(); if (el) applyEl(el); else known.delete(r); }
  };
  document.addEventListener('play', e => { if (e.target instanceof HTMLMediaElement) applyEl(e.target); }, true);
  document.addEventListener('loadedmetadata', e => { if (e.target instanceof HTMLMediaElement) applyEl(e.target); }, true);
  window.addEventListener('message', e => {
    const m = e.source === window && e.data && e.data.__studioMaster;
    if (m) { mult.master = m.muted ? 0 : m.level / 100; applyAll(); }
  });
  window.__studioVol = { set(k, v) { mult[k] = v; applyAll(); }, get total() { return total(); }, real: el => vd.get.call(el) };
})();`);
}

if (vn && VN_AUDIO) (() => {
  let settings = vn;
  const isActive = () => !!settings.enabled;
  const SPEEDS = {
    slow:   { window: 6,   attack: 1.5, release: 8 },
    normal: { window: 3,   attack: 0.5, release: 4 },
    fast:   { window: 1.2, attack: 0.2, release: 1.5 },
  };
  const COMP = {
    off: null,
    light:  { offset: 6, ratio: 3, knee: 8,  makeup: 1 },
    strong: { offset: 0, ratio: 6, knee: 10, makeup: 3 },
  };
  const WARMUP = 1.5, SILENCE = -70, REL_GATE = 20, REL_GATE_MAX = 4;
  const dbToLin = db => Math.pow(10, db / 20);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const autoMakeupDb = (threshold, ratio) => -0.6 * threshold * (1 - 1 / ratio);

  let ctx = null;
  const chains = new Map();
  const attaching = new WeakSet();
  const failed = new WeakSet();
  const pending = new Set();

  ipcRenderer.on('studio:volnorm', (_e, s) => { settings = { ...settings, ...s }; applyAll(); if (isActive()) scan(); });

  // on ne touche jamais à un média protégé ou venu d'un autre domaine sans autorisation : il deviendrait muet
  function eligible(el) {
    if (el.mediaKeys) return false;
    if (el.srcObject) return true;
    const src = el.currentSrc || el.src;
    if (!src) return false;
    if (src.startsWith('blob:') || src.startsWith('data:')) return true;
    try { if (new URL(src, location.href).origin === location.origin) return true; } catch {}
    return el.crossOrigin !== null;
  }

  function ensureContext() {
    if (ctx) return ctx;
    ctx = new AudioContext();
    ctx.onstatechange = () => { if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {}); };
    return ctx;
  }

  async function tryAttach(el) {
    if (chains.has(el) || attaching.has(el) || failed.has(el) || !isActive()) return;
    if (el.muted || el.volume === 0) return; // vidéos muettes (fil X, aperçus) : rien à égaliser
    if (!eligible(el)) return;
    attaching.add(el);
    try {
      ensureContext();
      if (ctx.state !== 'running') { try { await Promise.race([ctx.resume(), sleep(400)]); } catch {} }
      if (ctx.state !== 'running') { pending.add(el); return; }
      if (chains.has(el)) return;
      const ch = buildChain(el);
      chains.set(el, ch);
      applyConfig(ch);
      startLoop();
    } catch (e) {
      failed.add(el);
    } finally {
      attaching.delete(el);
    }
  }

  function onGesture() {
    if (!pending.size || !ctx) return;
    ctx.resume().then(() => { const els = [...pending]; pending.clear(); els.forEach(tryAttach); }).catch(() => {});
  }
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);

  function buildChain(el) {
    const src = ctx.createMediaElementSource(el);
    const dry = ctx.createGain(), wet = ctx.createGain(), pre = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(), compTrim = ctx.createGain();
    const lim = ctx.createDynamicsCompressor(), limTrim = ctx.createGain();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    limTrim.gain.value = dbToLin(-autoMakeupDb(-2, 20));
    const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1681; shelf.gain.value = 4;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
    const split = ctx.createChannelSplitter(2);
    const anL = ctx.createAnalyser(), anR = ctx.createAnalyser();
    anL.fftSize = anR.fftSize = 4096;
    src.connect(dry).connect(ctx.destination);
    src.connect(pre).connect(comp).connect(compTrim).connect(lim).connect(limTrim).connect(wet).connect(ctx.destination);
    src.connect(shelf).connect(hp).connect(split);
    split.connect(anL, 0); split.connect(anR, 1);
    const ch = { el, pre, comp, compTrim, dry, wet, anL, anR, bufL: new Float32Array(4096), bufR: new Float32Array(4096),
      energy: null, loudness: null, gainDb: 0, warm: 0, gated: 0, skip: 0 };
    const reset = () => { ch.energy = null; ch.loudness = null; ch.warm = 0; ch.gated = 0; ch.skip = 0.3; };
    el.addEventListener('loadstart', reset);
    el.addEventListener('emptied', reset);
    return ch;
  }

  function applyConfig(ch) {
    const t = ctx.currentTime;
    const c = COMP[settings.compression];
    if (!c) {
      ch.comp.threshold.value = 0; ch.comp.ratio.value = 1; ch.comp.knee.value = 0; ch.compTrim.gain.value = 1;
    } else {
      const thr = clamp(settings.target + c.offset, -60, -1);
      ch.comp.threshold.value = thr; ch.comp.ratio.value = c.ratio; ch.comp.knee.value = c.knee;
      ch.comp.attack.value = 0.01; ch.comp.release.value = 0.3;
      ch.compTrim.gain.value = dbToLin(-autoMakeupDb(thr, c.ratio) + c.makeup);
    }
    const on = isActive();
    ch.wet.gain.setTargetAtTime(on ? 1 : 0, t, 0.05);
    ch.dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.05);
  }
  function applyAll() { if (ctx) for (const ch of chains.values()) applyConfig(ch); }

  function meanSquare(an, buf) {
    an.getFloatTimeDomainData(buf);
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return s / buf.length;
  }

  let loopTimer = null, lastTick = 0;
  function startLoop() {
    if (loopTimer) return;
    lastTick = performance.now();
    loopTimer = setInterval(tick, 100);
  }
  function tick() {
    const now = performance.now();
    const dt = clamp((now - lastTick) / 1000, 0.01, 2);
    lastTick = now;
    const sp = SPEEDS[settings.speed] || SPEEDS.normal;
    let anyPlaying = false;
    for (const ch of chains.values()) {
      if (!ch.el.isConnected && ch.el.paused) continue;
      if (ch.el.paused || !isActive()) continue;
      anyPlaying = true;
      if (ch.skip > 0) { ch.skip -= dt; continue; }
      const ms = meanSquare(ch.anL, ch.bufL) + meanSquare(ch.anR, ch.bufR);
      const block = -0.691 + 10 * Math.log10(ms + 1e-12);
      let accept = block > SILENCE;
      if (accept && ch.loudness !== null && ch.warm >= WARMUP && block < ch.loudness - REL_GATE) {
        ch.gated += dt; accept = ch.gated > REL_GATE_MAX;
      } else ch.gated = 0;
      if (accept) {
        const W = ch.warm < WARMUP ? 0.4 : sp.window;
        ch.energy = ch.energy === null ? ms : ch.energy + (ms - ch.energy) * Math.min(1, dt / W);
        ch.warm += dt;
        ch.loudness = -0.691 + 10 * Math.log10(ch.energy);
      }
      if (ch.loudness !== null) {
        const desired = clamp(settings.target - ch.loudness, -settings.maxCut, settings.maxBoost);
        const down = desired < ch.gainDb;
        const tau = down ? (ch.warm < WARMUP ? 0.1 : sp.attack) : (ch.warm < 4 ? 0.8 : sp.release);
        ch.gainDb += (desired - ch.gainDb) * Math.min(1, dt / tau);
        ch.pre.gain.setTargetAtTime(dbToLin(ch.gainDb), ctx.currentTime, 0.03);
      }
    }
    // rien ne joue : on arrête la boucle (aucun calcul en arrière-plan)
    if (!anyPlaying) { clearInterval(loopTimer); loopTimer = null; }
  }

  function scan() {
    if (pending.size && ctx) onGesture();
    for (const el of document.querySelectorAll('video,audio')) if (!el.paused) tryAttach(el);
  }
  const onPlay = e => { if (e.target instanceof HTMLMediaElement) { tryAttach(e.target); startLoop(); } };
  document.addEventListener('play', onPlay, true);
  document.addEventListener('playing', onPlay, true);
  // une vidéo muette qu'on active (fil X) : on la branche à ce moment-là
  document.addEventListener('volumechange', onPlay, true);
  setInterval(scan, 2000);

  window.__studioVolnormTest = { chains, get ctx() { return ctx; } };
})();

// ---------------- Tidal : ReplayGain ----------------
// Tidal envoie à son lecteur, pour chaque morceau, sa valeur ReplayGain (dB à ajouter pour atteindre le niveau
// de référence ReplayGain, -18 LUFS). Dans la page, on repère ces valeurs dans les réponses du serveur, puis on
// règle le volume du lecteur : volume réel = volume choisi dans Tidal × correction du morceau (jamais plus de 100 %).
if (vn && VN_TIDAL) {
  window.addEventListener('message', e => {
    const d = e.source === window && e.data && e.data.__studioRG;
    if (d && typeof d.msg === 'string') vnLog('Tidal : ' + d.msg.slice(0, 160));
  });
  ipcRenderer.on('studio:volnorm', (_e, s) => { window.postMessage({ __studioVN: s }, '*'); });
  webFrame.executeJavaScript(`(() => {
  if (window.__studioRGInstalled) return;
  window.__studioRGInstalled = true;
  let cfg = ${JSON.stringify({ enabled: !!vn.enabled, target: vn.target })};
  const gains = new Map();          // id du morceau → { rg, peak }
  let lastGain = null;              // dernière valeur reçue (si on ne sait pas quel morceau joue)
  let factor = 1, currentKey = null;
  const log = msg => window.postMessage({ __studioRG: { msg } }, '*');

  // ---- repérage des valeurs dans les réponses JSON
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : null);
  const scanObj = (o, depth) => {
    if (!o || typeof o !== 'object' || depth > 6) return;
    if (Array.isArray(o)) { for (const it of o) scanObj(it, depth + 1); return; }
    // ancien format : { trackId, trackReplayGain, trackPeakAmplitude }
    let rg = num(o.trackReplayGain), peak = num(o.trackPeakAmplitude), id = o.trackId;
    // format JSON:API : { id, attributes: { trackAudioNormalizationData: { replayGain, peakAmplitude } } }
    const nd = o.trackAudioNormalizationData || (o.attributes && o.attributes.trackAudioNormalizationData);
    if (rg === null && nd) { rg = num(nd.replayGain); peak = num(nd.peakAmplitude); id = id || o.id; }
    if (rg !== null && rg > -40 && rg < 30) {
      const g = { rg, peak };
      if (id !== undefined && id !== null) gains.set(String(id), g);
      lastGain = g;
      log('ReplayGain ' + rg.toFixed(1) + ' dB reçu' + (id ? ' (morceau ' + id + ')' : ''));
      update('net');
    }
    for (const k in o) if (o[k] && typeof o[k] === 'object') scanObj(o[k], depth + 1);
  };
  const looksRelevant = t => typeof t === 'string' && /ReplayGain|AudioNormalizationData|replayGain/.test(t);
  const origFetch = window.fetch;
  window.fetch = function () {
    const p = origFetch.apply(this, arguments);
    p.then(r => {
      const type = r.headers.get('content-type') || '';
      if (!/json/.test(type)) return;
      r.clone().text().then(t => { if (looksRelevant(t)) { try { scanObj(JSON.parse(t), 0); } catch (e) {} } }).catch(() => {});
    }).catch(() => {});
    return p;
  };
  const xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    this.addEventListener('load', () => {
      try {
        if (this.responseType && this.responseType !== 'text' && this.responseType !== 'json') return;
        const t = this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText;
        if (looksRelevant(t)) scanObj(JSON.parse(t), 0);
      } catch (e) {}
    });
    return xo.apply(this, arguments);
  };

  // ---- morceau en cours : lien « /track/123 » de la barre de lecture, sinon la dernière valeur reçue
  const currentTrackId = () => {
    const sel = ['[data-test="footer-player"] a[href*="/track/"]', '[data-test="footer-track-title"] a[href*="/track/"]',
      'footer a[href*="/track/"]', '[class*="player" i] a[href*="/track/"]', '[class*="nowPlaying" i] a[href*="/track/"]'];
    for (const s of sel) {
      const a = document.querySelector(s);
      const m = a && (a.getAttribute('href') || '').match(/\\/track\\/(\\d+)/);
      if (m) return m[1];
    }
    return null;
  };

  // ---- volume : appliqué par la couche « volume général » (voir plus haut), sous le nom « rg »
  const applyAll = () => { if (window.__studioVol) window.__studioVol.set('rg', cfg.enabled ? factor : 1); };
  // trigger : 'net' (valeur reçue), 'track' (nouveau morceau qui démarre), 'tick' (vérification), 'cfg' (réglage changé)
  let currentG = null;
  function update(trigger) {
    const id = currentTrackId();
    let g;
    if (id) {
      g = gains.get(id);
      if (!g) return;                       // pas encore reçu pour ce morceau : on garde la correction actuelle
    } else if (trigger === 'track' || (trigger === 'net' && !currentG)) {
      g = lastGain;                         // on ne sait pas quel morceau joue : dernière valeur reçue, au démarrage du morceau
    } else {
      g = currentG;                         // sinon on ne change rien (Tidal précharge le morceau suivant à l'avance)
    }
    if (!g) return;
    const key = (id || '?') + ':' + g.rg + ':' + cfg.target + ':' + cfg.enabled;
    if (key === currentKey) return;
    currentKey = key;
    currentG = g;
    // ReplayGain vise -18 LUFS ; on décale vers le volume cible choisi, et on ne fait que baisser (volume ≤ 100 %)
    const db = g.rg + (cfg.target + 18);
    factor = Math.min(1, Math.pow(10, db / 20));
    applyAll();
    log((cfg.enabled ? 'volume ajusté à ' + Math.round(factor * 100) + ' %' : 'égaliseur coupé') + (id ? ' pour le morceau ' + id : ''));
  }
  window.addEventListener('message', e => {
    const s = e.source === window && e.data && e.data.__studioVN;
    if (s) { cfg = { ...cfg, ...s }; currentKey = null; update('cfg'); }
  });
  document.addEventListener('play', () => update('track'), true);
  document.addEventListener('loadedmetadata', () => update('track'), true);
  setInterval(() => update('tick'), 1000);
  window.__studioRG = { gains, get factor() { return factor; }, update };
})();`);
}
