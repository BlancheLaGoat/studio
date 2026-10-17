// Requêtes vers les API des plateformes : jeton, rafraîchissement auto, et patience en cas de limite (429).
const sleep = ms => new Promise(r => setTimeout(r, ms));

class ApiError extends Error {
  constructor(status, message, body) { super(message); this.status = status; this.body = body; }
}

/**
 * @param {object} o
 * @param {string} o.base     URL de base de l'API
 * @param {() => Promise<string>} o.getToken   jeton valide (rafraîchi si besoin)
 * @param {() => Promise<string>} o.forceRefresh  jeton neuf après un 401
 * @param {object} [o.headers]
 */
function makeClient({ base, getToken, forceRefresh, headers = {}, label = 'API' }) {
  async function request(method, path, { query, body, contentType = 'application/json' } = {}) {
    let url = path.startsWith('http') ? path : base.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path);
    if (query) {
      const u = new URL(url);
      for (const [k, v] of Object.entries(query)) {
        if (v == null) continue;
        if (Array.isArray(v)) v.forEach(x => u.searchParams.append(k, x));
        else u.searchParams.set(k, v);
      }
      url = u.toString();
    }

    let token = await getToken();
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: contentType,
          ...(body !== undefined ? { 'Content-Type': contentType } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (res.status === 401 && !refreshed) { refreshed = true; token = await forceRefresh(); continue; }
      if (res.status === 429 && attempt < 8) {
        const wait = Math.min(30, Number(res.headers.get('retry-after')) || 2 ** attempt);
        await sleep(wait * 1000 + 250);
        continue;
      }
      if (res.status >= 500 && attempt < 3) { await sleep(1000 * (attempt + 1)); continue; }

      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) {
        const detail = json && (json.error?.message || json.errors?.[0]?.detail || json.errors?.[0]?.title || json.error_description);
        throw new ApiError(res.status, `${label} : erreur ${res.status}${detail ? ` — ${detail}` : ''}`, json || text);
      }
      return json;
    }
  }
  return {
    get: (p, o) => request('GET', p, o),
    post: (p, o) => request('POST', p, o),
    request,
  };
}

module.exports = { makeClient, ApiError, sleep };
