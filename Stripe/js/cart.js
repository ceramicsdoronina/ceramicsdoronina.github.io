// Stripe/js/cart.js
// Logica PURA del carrello (nessun DOM, nessun localStorage): testabile in Node
// (test/cart.test.js). uiStripe.js e' lo strato DOM che la usa.
//
// Carrello: array di righe {id, type, quantity, name, currency, unit_amount, image}.
// Registro prodotti: products[id] = {id, type, titles, priceCents, img, maxQty?, sold?}.
// Marcatore "checkout in sospeso" (localStorage cd_checkout_pending): MAPPA
//   { "<session_id>": { ids: [...], ts: <ms> } }   (voci piu' vecchie di 24 h potate in scrittura)
(function (root) {
  const CART_KEY = "cd_stripe_cart_v1";
  const PENDING_KEY = "cd_checkout_pending";
  const DEFAULT_DIGITAL_MAX_QTY = 6;
  const MAX_LINE_QTY = 99;
  const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
  const STRIPE_HOST = "checkout.stripe.com";
  const ID_RE = /^[A-Za-z0-9_-]+$/;

  function isValidId(id) {
    return typeof id === "string" && ID_RE.test(id);
  }

  function positiveInt(n) {
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  function validPrice(c) {
    return Number.isInteger(c) && c > 0;
  }

  // Vasi: sempre 1. Digitali: maxQty del registro (posti / default 6).
  function maxQtyFor(p) {
    if (!p || p.type !== "digital") return 1;
    return positiveInt(p.maxQty) || DEFAULT_DIGITAL_MAX_QTY;
  }

  // Riga grezza (da localStorage) -> riga valida, oppure null.
  function sanitizeLine(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!isValidId(id)) return null;
    const quantity = raw.quantity;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;
    const unit = Number.isInteger(raw.unit_amount) && raw.unit_amount > 0 ? raw.unit_amount : 0;
    const image = typeof raw.image === "string" && /^images\/[^\s"'<>]+$/.test(raw.image) ? raw.image : "";
    return {
      id,
      type: raw.type === "digital" ? "digital" : "physical",
      quantity: Math.min(MAX_LINE_QTY, quantity),
      name: typeof raw.name === "string" && raw.name ? raw.name.slice(0, 200) : id,
      currency: "eur",
      unit_amount: unit,   // solo visualizzazione
      image
    };
  }

  // Array grezzo -> {cart, dropped}: righe non valide e id duplicati scartati.
  function sanitizeCart(arr) {
    const seen = new Set();
    const cart = [];
    let dropped = 0;
    for (const raw of Array.isArray(arr) ? arr : []) {
      const line = sanitizeLine(raw);
      if (!line || seen.has(line.id)) { dropped++; continue; }
      seen.add(line.id);
      cart.push(line);
    }
    return { cart, dropped };
  }

  function titleOf(p, id) {
    const titles = (p && p.titles) || {};
    return titles.it || titles.en || titles.ru || id;
  }

  // Aggiunge un prodotto. Ritorna {cart, status}:
  //   "added" | "already" (vaso gia' nel carrello) | "max" (digitale al massimo) | "invalid"
  // opts.name = titolo da salvare (di default titles.it/en/ru).
  function mergeAdd(cart, p, qty, opts) {
    const base = Array.isArray(cart) ? cart : [];
    if (!p || !isValidId(p.id) || p.sold || !validPrice(p.priceCents)) return { cart: base, status: "invalid" };

    const type = p.type === "digital" ? "digital" : "physical";
    const maxQty = maxQtyFor(p);
    const addQty = positiveInt(qty) || 1;
    const out = base.map((x) => Object.assign({}, x));
    const line = out.find((x) => x.id === p.id);

    if (line) {
      if (type === "physical") return { cart: base, status: "already" };
      if (line.quantity >= maxQty) return { cart: base, status: "max" };
      line.quantity = Math.min(maxQty, line.quantity + addQty);
      return { cart: out, status: "added" };
    }

    out.push({
      id: p.id,
      type,
      quantity: Math.min(maxQty, addQty),
      name: (opts && opts.name) || titleOf(p, p.id),
      currency: "eur",
      unit_amount: p.priceCents,   // solo visualizzazione
      image: typeof p.img === "string" ? p.img : ""
    });
    return { cart: out, status: "added" };
  }

  // Allinea il carrello al registro: scarta sconosciuti / venduti / tipo diverso / prezzo non valido,
  // limita la quantita'. opts.physicalKnown / opts.digitalKnown === false: quel tipo non si tocca.
  // opts.nameFor(p, id) = titolo da mostrare. Ritorna {cart, removed, changed}.
  function reconcile(cart, products, opts) {
    const o = opts || {};
    const reg = products || {};
    const nameFor = typeof o.nameFor === "function" ? o.nameFor : titleOf;
    const out = [];
    let removed = 0;
    let changed = false;

    for (const line of Array.isArray(cart) ? cart : []) {
      const p = reg[line.id];
      const known = line.type === "physical" ? o.physicalKnown !== false : o.digitalKnown !== false;
      if (!known) { out.push(line); continue; }

      if (!p || p.sold || !validPrice(p.priceCents) || (p.type || "physical") !== line.type) {
        removed++;
        changed = true;
        continue;
      }

      const quantity = Math.min(line.quantity, maxQtyFor(p));
      const name = nameFor(p, line.id);
      if (quantity !== line.quantity || name !== line.name || p.priceCents !== line.unit_amount) changed = true;
      out.push(Object.assign({}, line, { quantity, name, unit_amount: p.priceCents }));
    }
    return { cart: out, removed, changed };
  }

  function removeLine(cart, id) {
    return (Array.isArray(cart) ? cart : []).filter((x) => x && x.id !== id);
  }

  function removeIds(cart, ids) {
    const set = new Set((ids || []).map(String));
    return (Array.isArray(cart) ? cart : []).filter((x) => !(x && set.has(String(x.id))));
  }

  // ── marcatore checkout in sospeso (mappa) ──

  // Valore grezzo letto da localStorage -> mappa valida. Accetta anche il vecchio formato
  // a slot singolo {session_id, ids, ts}.
  function normalizePending(raw) {
    const map = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return map;
    if (typeof raw.session_id === "string" && Array.isArray(raw.ids)) {
      map[raw.session_id] = { ids: raw.ids.map(String), ts: Number.isFinite(raw.ts) ? raw.ts : 0 };
      return map;
    }
    for (const sid of Object.keys(raw)) {
      const e = raw[sid];
      if (e && typeof e === "object" && Array.isArray(e.ids)) {
        map[sid] = { ids: e.ids.map(String), ts: Number.isFinite(e.ts) ? e.ts : 0 };
      }
    }
    return map;
  }

  function prunePending(map, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const out = {};
    for (const sid of Object.keys(map || {})) {
      if (t - map[sid].ts <= PENDING_TTL_MS) out[sid] = map[sid];
    }
    return out;
  }

  // Aggiunge/sovrascrive la voce della sessione e pota le voci > 24 h. Ritorna una NUOVA mappa.
  function addPending(map, sessionId, ids, now) {
    const t = Number.isFinite(now) ? now : Date.now();
    const out = prunePending(map, t);
    out[sessionId] = { ids: (ids || []).map(String), ts: t };
    return out;
  }

  // Pagina di successo: se sessionId corrisponde a una voce, rimuove dal carrello SOLO i suoi id
  // ed elimina SOLO quella voce. Altrimenti non cambia nulla.
  // Ritorna {map, cart, matched} (nuovi oggetti; gli input non vengono modificati).
  function pendingAfterSuccess(map, sessionId, cart) {
    const m = map || {};
    if (typeof sessionId !== "string" || !sessionId || !Object.prototype.hasOwnProperty.call(m, sessionId)) {
      return { map: m, cart: cart, matched: false };
    }
    const nextMap = Object.assign({}, m);
    const entry = nextMap[sessionId];
    delete nextMap[sessionId];
    return { map: nextMap, cart: removeIds(cart, entry.ids), matched: true };
  }

  // Redirect consentito solo verso https://checkout.stripe.com/... (host esatto, niente credenziali).
  function isStripeUrl(url) {
    if (typeof url !== "string") return false;
    let u;
    try { u = new URL(url); } catch (_) { return false; }
    return u.protocol === "https:" && u.hostname === STRIPE_HOST && !u.username && !u.password && !u.port;
  }

  const api = {
    CART_KEY, PENDING_KEY, PENDING_TTL_MS, MAX_LINE_QTY, DEFAULT_DIGITAL_MAX_QTY,
    isValidId, positiveInt, validPrice, maxQtyFor,
    sanitizeLine, sanitizeCart, mergeAdd, reconcile, removeLine, removeIds,
    normalizePending, prunePending, addPending, pendingAfterSuccess, isStripeUrl
  };
  root.CD = root.CD || {};
  root.CD.cart = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
