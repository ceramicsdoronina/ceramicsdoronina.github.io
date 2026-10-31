// Stripe/js/liveCatalogue.js
// Overlay di prezzo e stato "venduto" letti dall'endpoint pubblico del catalogo (Google Sheet)
// sopra le righe ODS. Caricabile anche in Node (vedi test/liveCatalogue.test.js).
//
// L'ODS resta la sorgente di descrizioni, dimensioni, immagini e id; l'endpoint porta solo
// prezzo e venduto. Se l'endpoint non risponde, fetchLive ritorna una mappa vuota e il sito
// usa i valori ODS (il server resta l'unica fonte di verita' per cio' che viene addebitato).
(function (root) {
  const DEFAULT_TIMEOUT_MS = 5000;
  const ID_RE = /^[A-Za-z0-9_-]+$/;

  function money() {
    if (root.CD && root.CD.money) return root.CD.money;
    return require("./money.js");
  }

  // Valida una voce; ritorna {priceCents, sold} oppure null (voce ignorata).
  function validEntry(e) {
    if (!e || typeof e !== "object") return null;
    if (typeof e.id !== "string" || !ID_RE.test(e.id)) return null;
    if (!Number.isInteger(e.priceCents) || e.priceCents <= 0 || e.priceCents > money().MAX_CENTS) return null;
    if (typeof e.sold !== "boolean") return null;
    return { id: e.id, priceCents: e.priceCents, sold: e.sold };
  }

  // Valida il payload: version 1 e items array, altrimenti null. Voci errate scartate.
  function parsePayload(body) {
    if (!body || typeof body !== "object" || body.version !== 1 || !Array.isArray(body.items)) return null;
    const map = new Map();
    for (const raw of body.items) {
      const e = validEntry(raw);
      if (e) map.set(e.id, { priceCents: e.priceCents, sold: e.sold });
    }
    return map;
  }

  // Mai lancia: in caso di errore, timeout o forma non valida ritorna una Map vuota (console.warn).
  async function fetchLive(fetchImpl, url, timeoutMs) {
    const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
    let timer;
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    try {
      if (typeof fetchImpl !== "function" || !url) throw new Error("endpoint non configurato");
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          if (ctrl) ctrl.abort();
          reject(new Error("timeout " + ms + " ms"));
        }, ms);
      });
      const work = (async () => {
        const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
        if (!res || !res.ok) throw new Error("HTTP " + (res && res.status));
        return parsePayload(await res.json());
      })();
      work.catch(() => {});   // evita unhandled rejection se vince il timeout
      const map = await Promise.race([work, timeout]);
      if (!map) throw new Error("risposta non valida");
      return map;
    } catch (err) {
      console.warn("[LIVE] catalogo live non disponibile, uso i dati ODS:", err && err.message ? err.message : err);
      return new Map();
    } finally {
      clearTimeout(timer);
    }
  }

  // Ritorna COPIE delle righe ODS con prezzo e venduto aggiornati per gli id presenti nella mappa.
  // Id, immagini, testi non vengono mai toccati; id sconosciuti nella mappa sono ignorati.
  // Regola "venduto": con dato live per quell'id il live e' AUTORITATIVO (cosi' dal foglio si puo'
  // rimettere in vendita un pezzo segnato venduto nell'ODS); senza dato live vale l'ODS.
  // Prezzo: price_new__raw in euro (letto da money.cellToCents) + testo con money.format.
  function applyOverlay(rows, map) {
    const list = Array.isArray(rows) ? rows : [];
    if (!map || typeof map.get !== "function" || !map.size) return list;
    const m = money();
    return list.map((row) => {
      const id = row && row.id == null ? "" : String(row && row.id).trim();
      const live = id ? map.get(id) : null;
      if (!live) return row;
      return Object.assign({}, row, {
        price_new: m.format(live.priceCents, "it"),
        price_new__raw: live.priceCents / 100,
        venduto: live.sold ? "si" : ""
      });
    });
  }

  const api = { fetchLive, applyOverlay, parsePayload, DEFAULT_TIMEOUT_MS };
  root.CD = root.CD || {};
  root.CD.liveCatalogue = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
