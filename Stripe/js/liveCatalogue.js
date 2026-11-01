// Stripe/js/liveCatalogue.js
// Catalogo letto dall'endpoint pubblico (Google Sheet). Caricabile anche in Node
// (vedi test/liveCatalogue.test.js).
//
// Versione 2: l'endpoint porta anche le righe dei tre fogli (tabs.vasi / masterclass / certificati),
// che il sito rende al posto degli ODS (stessa forma di riga di util.loadOdsRows, via
// util.normalizeRow). Per ogni foglio mancante (null) o non valido si usa l'ODS (chooseData).
// Versione 1 (solo items con prezzo/venduto): sopra le righe ODS si applica l'overlay (applyOverlay),
// MAI sulle righe che arrivano dal foglio. Se l'endpoint non risponde il sito usa i soli ODS
// (il server resta l'unica fonte di verita' per cio' che viene addebitato).
(function (root) {
  const DEFAULT_TIMEOUT_MS = 5000;
  const ID_RE = /^[A-Za-z0-9_-]+$/;

  function money() {
    if (root.CD && root.CD.money) return root.CD.money;
    return require("./money.js");
  }

  function util() {
    if (root.CD && root.CD.util) return root.CD.util;
    return require("./util.js");
  }

  // Colonne minime perche' un foglio sia considerato valido (required; anyOf = almeno uno dei gruppi
  // di colonne, per i fogli masterclass nello schema nuovo price_1 o in quello legacy price), e colonne
  // prezzo (per "<col>__raw")
  const TABS = {
    vasi:        { required: ["id", "name_it", "price_new", "venduto", "img1"], price: ["price_old", "price_new"] },
    masterclass: { required: ["id", "name_it", "date", "img1"], anyOf: [["price_1"], ["price"]],
                   price: ["price", "price_1", "price_2", "price_3", "price_4", "price_5", "price_6", "price_7", "price_8"] },
    certificati: { required: ["id", "name_it", "amount_eur", "img1"],           price: ["amount_eur"] }
  };
  const MAX_ROWS = 1000;
  const MAX_COLS = 100;

  // Valida una voce; ritorna {priceCents, sold} oppure null (voce ignorata).
  function validEntry(e) {
    if (!e || typeof e !== "object") return null;
    if (typeof e.id !== "string" || !ID_RE.test(e.id)) return null;
    if (!Number.isInteger(e.priceCents) || e.priceCents <= 0 || e.priceCents > money().MAX_CENTS) return null;
    if (typeof e.sold !== "boolean") return null;
    return { id: e.id, priceCents: e.priceCents, sold: e.sold };
  }

  // Valida un foglio {headers, rows}; ritorna le righe normalizzate (come loadOdsRows) oppure null
  // (=> si usa l'ODS). Righe scartate: non oggetti, id mancante/non valido/duplicato.
  // Se c'erano righe ma nessuna e' valida il foglio e' considerato non valido (schema rotto).
  function parseTab(name, tab) {
    const spec = TABS[name];
    if (!tab || typeof tab !== "object" || !Array.isArray(tab.headers) || !Array.isArray(tab.rows)) return null;
    const headers = tab.headers.filter((h) => typeof h === "string" && h && h !== "__proto__" && !/__raw$/.test(h));
    if (headers.length !== tab.headers.length || headers.length > MAX_COLS) return null;
    if (!spec.required.every((h) => headers.includes(h))) return null;
    if (spec.anyOf && !spec.anyOf.some((g) => g.every((h) => headers.includes(h)))) return null;
    if (tab.rows.length > MAX_ROWS) return null;

    const u = util();
    const seen = new Set();
    const rows = [];
    for (const raw of tab.rows) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const fmt = {};
      headers.forEach((h) => { fmt[h] = Object.prototype.hasOwnProperty.call(raw, h) ? raw[h] : ""; });
      const row = u.normalizeRow(fmt, null, spec.price);
      if (!ID_RE.test(row.id) || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
    if (tab.rows.length && !rows.length) return null;
    return rows;
  }

  function parseItems(items) {
    const map = new Map();
    for (const raw of items) {
      const e = validEntry(raw);
      if (e) map.set(e.id, { priceCents: e.priceCents, sold: e.sold });
    }
    return map;
  }

  function emptyLive() {
    return { items: new Map(), tabs: { vasi: null, masterclass: null, certificati: null } };
  }

  // Valida il payload (version 1 o 2, items array obbligatorio); null se non valido.
  // Ritorna {items: Map, tabs: {vasi, masterclass, certificati}} con ogni foglio = righe o null.
  // Version 1 (o tabs mancante) => tutti i fogli null. Un foglio non valido non invalida gli altri.
  function parseCatalogue(body) {
    if (!body || typeof body !== "object" || (body.version !== 1 && body.version !== 2) || !Array.isArray(body.items)) return null;
    const out = { items: parseItems(body.items), tabs: emptyLive().tabs };
    if (body.version === 2 && body.tabs && typeof body.tabs === "object") {
      Object.keys(TABS).forEach((name) => {
        const rows = parseTab(name, body.tabs[name]);
        if (rows === null && body.tabs[name] != null) console.warn("[LIVE] foglio non valido, uso l'ODS:", name);
        out.tabs[name] = rows;
      });
    }
    return out;
  }

  // Compatibilita': solo la mappa prezzo/venduto (null se payload non valido).
  function parsePayload(body) {
    const c = parseCatalogue(body);
    return c ? c.items : null;
  }

  // Mai lancia: in caso di errore, timeout o forma non valida ritorna emptyLive() (console.warn).
  async function fetchCatalogue(fetchImpl, url, timeoutMs) {
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
        return parseCatalogue(await res.json());
      })();
      work.catch(() => {});   // evita unhandled rejection se vince il timeout
      const live = await Promise.race([work, timeout]);
      if (!live) throw new Error("risposta non valida");
      return live;
    } catch (err) {
      console.warn("[LIVE] catalogo live non disponibile, uso i dati ODS:", err && err.message ? err.message : err);
      return emptyLive();
    } finally {
      clearTimeout(timer);
    }
  }

  // Compatibilita' (versione 1): solo la mappa prezzo/venduto.
  async function fetchLive(fetchImpl, url, timeoutMs) {
    return (await fetchCatalogue(fetchImpl, url, timeoutMs)).items;
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

  // Sceglie, per ciascun foglio, la sorgente delle righe. live = risultato di fetchCatalogue (o null),
  // ods = {vasi, masterclass, certificati} con array di righe oppure null/undefined (non caricato).
  // Foglio presente nel live => righe del foglio (prezzo/venduto gia' dentro: nessun overlay).
  // Altrimenti righe ODS; solo per i vasi, se ci sono items, overlay prezzo/venduto (una sola volta:
  // parte sempre dalle righe ODS originali). Ritorna {rows, sources} con sources[k] = "sheet" | "ods" | null.
  function chooseData(live, ods) {
    const l = live && live.tabs ? live : emptyLive();
    const o = ods || {};
    const rows = {};
    const sources = {};
    Object.keys(TABS).forEach((name) => {
      if (Array.isArray(l.tabs[name])) {
        rows[name] = l.tabs[name];
        sources[name] = "sheet";
      } else if (Array.isArray(o[name])) {
        rows[name] = name === "vasi" && l.items && l.items.size ? applyOverlay(o[name], l.items) : o[name];
        sources[name] = "ods";
      } else {
        rows[name] = null;   // ne' foglio ne' ODS: "non disponibile"
        sources[name] = null;
      }
    });
    return { rows, sources };
  }

  const api = { fetchCatalogue, fetchLive, applyOverlay, parsePayload, parseCatalogue, parseTab, chooseData, emptyLive, TABS, DEFAULT_TIMEOUT_MS };
  root.CD = root.CD || {};
  root.CD.liveCatalogue = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
