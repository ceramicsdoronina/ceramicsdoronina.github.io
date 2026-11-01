// Stripe/js/cart.js
// Logica PURA del carrello (nessun DOM, nessun localStorage): testabile in Node
// (test/cart.test.js). uiStripe.js e' lo strato DOM che la usa.
//
// Carrello: array di righe {id, type, quantity, name, currency, unit_amount, image, kind?, line_amount?}.
// Registro prodotti: products[id] = {id, type, titles, priceCents, img, maxQty?, sold?, tiersCents?}.
// Masterclass (prodotto con tiersCents = [c1..c20, null dove quel gruppo non e' offerto]):
//   quantity = PERSONE (1..20; fino a 999 per il prezzo lineare, vedi sotto) e il prezzo della riga e'
//   tiersCents[quantity-1] (UNA riga, mai prezzo unitario x quantita'): e' lo stesso calcolo del server.
//   Prezzo lineare (pricing "linear" + linearCents = price_1, regola A): N x linearCents per qualsiasi N
//   fino a maxPersons = min(999, floor(99999999 / linearCents)) e, se limitati, ai posti liberi. kind "masterclass" e line_amount
//   (totale della riga) servono solo alla visualizzazione.
// Marcatore "checkout in sospeso" (localStorage cd_checkout_pending): MAPPA
//   { "<session_id>": { ids: [...], ts: <ms> } }   (voci piu' vecchie di 24 h potate in scrittura)
(function (root) {
  const CART_KEY = "cd_stripe_cart_v1";
  const PENDING_KEY = "cd_checkout_pending";
  const DEFAULT_DIGITAL_MAX_QTY = 6;
  const MAX_LINE_QTY = 99;
  const MAX_PERSONS = 20;            // tabelle e legacy: gruppi 1..20
  const MAX_LINEAR_PERSONS = 999;    // tetto tecnico del prezzo lineare
  const MAX_AMOUNT_CENTS = 99999999;
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

  // ── masterclass: prenotazione per numero di persone ──
  const isBooking = (p) => !!p && Array.isArray(p.tiersCents);

  // Prezzo lineare (regola A): price_1 valido e pricing "linear".
  const isLinear = (p) => isBooking(p) && p.pricing === "linear" && validPrice(p.linearCents);

  // Tetto tecnico del lineare: min(999, floor(99999999 / price_1)); 0 se non lineare.
  function linearMax(p) {
    return isLinear(p) ? Math.min(MAX_LINEAR_PERSONS, Math.floor(MAX_AMOUNT_CENTS / p.linearCents)) : 0;
  }

  // Totale del gruppo di n persone (senza guardare i posti), null se n non e' prezzabile.
  function tierCents(p, n) {
    if (!isBooking(p) || !Number.isInteger(n) || n < 1) return null;
    if (isLinear(p)) return n <= linearMax(p) ? p.linearCents * n : null;
    if (n > MAX_PERSONS) return null;
    const c = p.tiersCents[n - 1];
    return validPrice(c) ? c : null;
  }

  // Massimo di persone prenotabili (0 = non prenotabile): tabella/legacy = gruppo offerto piu' grande
  // entro maxQty (posti liberi se limitati, max 20); lineare = min(tetto tecnico, maxQty).
  function personsCap(p) {
    if (!isBooking(p) || p.sold) return 0;
    const q = Number.isInteger(p.maxQty) && p.maxQty > 0 ? p.maxQty : 0;
    if (isLinear(p)) return Math.min(linearMax(p), q);
    let best = 0;
    for (let n = 1; n <= Math.min(MAX_PERSONS, q); n++) if (tierCents(p, n) !== null) best = n;
    return best;
  }

  // Numeri di persone prenotabili: gruppi offerti (prezzo valido) entro il massimo.
  function offeredPersons(p) {
    const cap = personsCap(p);
    const out = [];
    for (let n = 1; n <= cap; n++) if (tierCents(p, n) !== null) out.push(n);
    return out;
  }

  // Il gruppo offerto piu' grande <= n (0 se non ce n'e').
  function fitPersons(p, n) {
    if (!Number.isInteger(n) || n < 1) return 0;
    if (isLinear(p)) return Math.min(n, personsCap(p));
    let best = 0;
    for (const k of offeredPersons(p)) if (k <= n) best = k;
    return best;
  }

  // Scelta del controllo persone: "select" (insieme discreto <= 20 valori: tabella, legacy, lineare
  // limitato con massimo <= 20), "number" (campo numerico: lineare illimitato o massimo > 20), "" (non prenotabile).
  function personsInput(p) {
    const cap = personsCap(p);
    if (!cap) return "";
    if (isLinear(p) && (p.seatsFree === null || cap > MAX_PERSONS)) return "number";
    return "select";
  }

  // Vasi: sempre 1. Masterclass: massimo di persone. Digitali: maxQty del registro (default 6).
  function maxQtyFor(p) {
    if (!p || p.type !== "digital") return 1;
    if (isBooking(p)) return personsCap(p);
    return positiveInt(p.maxQty) || DEFAULT_DIGITAL_MAX_QTY;
  }

  // Totale della riga in centesimi, uguale a quello che calcola il server; null se non calcolabile.
  // p = prodotto del registro (se assente si usano i valori salvati nella riga, solo visualizzazione).
  function lineTotalCents(line, p) {
    if (!line) return null;
    if (isBooking(p)) return tierCents(p, line.quantity);
    if (!p && line.kind === "masterclass") return validPrice(line.line_amount) ? line.line_amount : null;
    const unit = p && validPrice(p.priceCents) ? p.priceCents : line.unit_amount;
    return validPrice(unit) ? unit * line.quantity : null;
  }

  function cartTotalCents(cart, products) {
    const reg = products || {};
    let total = 0;
    for (const line of Array.isArray(cart) ? cart : []) total += lineTotalCents(line, reg[line.id]) || 0;
    return total;
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
    const booking = raw.kind === "masterclass" && raw.type === "digital";
    const out = {
      id,
      type: raw.type === "digital" ? "digital" : "physical",
      quantity: Math.min(booking ? MAX_LINEAR_PERSONS : MAX_LINE_QTY, quantity),
      name: typeof raw.name === "string" && raw.name ? raw.name.slice(0, 200) : id,
      currency: "eur",
      unit_amount: unit,   // solo visualizzazione
      image
    };
    if (booking) {
      out.kind = "masterclass";
      out.line_amount = Number.isInteger(raw.line_amount) && raw.line_amount > 0 ? raw.line_amount : 0;   // solo visualizzazione
    }
    return out;
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

  // Campi della riga che dipendono dal numero di persone (prezzo = tier, o N x price_1 se lineare).
  function bookingFields(p, n) {
    return { kind: "masterclass", quantity: n, unit_amount: p.priceCents, line_amount: tierCents(p, n) };
  }

  // Cambia le persone di una riga masterclass. Ritorna {cart, status}: "ok" | "invalid"
  // (riga assente, non una masterclass, o gruppo non offerto / oltre i posti liberi).
  function setPersons(cart, p, id, n) {
    const base = Array.isArray(cart) ? cart : [];
    if (!isBooking(p) || !(n >= 1) || fitPersons(p, n) !== n || !base.some((x) => x.id === id)) return { cart: base, status: "invalid" };
    return { cart: base.map((x) => (x.id === id ? Object.assign({}, x, bookingFields(p, n)) : x)), status: "ok" };
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

    // masterclass: le persone si SOMMANO entro i gruppi offerti / posti liberi
    if (isBooking(p)) {
      if (!maxQty) return { cart: base, status: "invalid" };
      const target = fitPersons(p, Math.min(maxQty, (line ? line.quantity : 0) + addQty));
      if (line) {
        if (target <= line.quantity) return { cart: base, status: "max" };
        Object.assign(line, bookingFields(p, target));
        return { cart: out, status: "added" };
      }
      if (!target) return { cart: base, status: "invalid" };
      out.push(Object.assign({
        id: p.id,
        type: "digital",
        name: (opts && opts.name) || titleOf(p, p.id),
        currency: "eur",
        image: typeof p.img === "string" ? p.img : ""
      }, bookingFields(p, target)));
      return { cart: out, status: "added" };
    }

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
  // opts.nameFor(p, id) = titolo da mostrare. Ritorna {cart, removed, changed, adjusted}:
  // adjusted = prenotazioni masterclass con meno persone (posti liberi / gruppi offerti diminuiti).
  // Masterclass: persone limitate al massimo (posti liberi, 20 per tabelle/legacy, tetto tecnico per il
  // lineare) e portate al gruppo offerto piu' vicino per difetto;
  // riga tolta se esaurita (solo posti limitati a 0 liberi: gli illimitati non sono mai esauriti)
  // o se nessun gruppo e' piu' offerto.
  function reconcile(cart, products, opts) {
    const o = opts || {};
    const reg = products || {};
    const nameFor = typeof o.nameFor === "function" ? o.nameFor : titleOf;
    const out = [];
    let removed = 0;
    let changed = false;
    let adjusted = 0;

    for (const line of Array.isArray(cart) ? cart : []) {
      const p = reg[line.id];
      const known = line.type === "physical" ? o.physicalKnown !== false : o.digitalKnown !== false;
      if (!known) { out.push(line); continue; }

      if (!p || p.sold || !validPrice(p.priceCents) || (p.type || "physical") !== line.type) {
        removed++;
        changed = true;
        continue;
      }

      if (isBooking(p)) {
        const persons = fitPersons(p, line.quantity);
        if (!persons) { removed++; changed = true; continue; }
        const nm = nameFor(p, line.id);
        if (persons < line.quantity) adjusted++;
        const next = Object.assign({}, line, { name: nm }, bookingFields(p, persons));
        if (next.quantity !== line.quantity || next.name !== line.name || next.unit_amount !== line.unit_amount || next.line_amount !== line.line_amount) changed = true;
        out.push(next);
        continue;
      }

      const quantity = Math.min(line.quantity, maxQtyFor(p));
      const name = nameFor(p, line.id);
      if (quantity !== line.quantity || name !== line.name || p.priceCents !== line.unit_amount) changed = true;
      out.push(Object.assign({}, line, { quantity, name, unit_amount: p.priceCents }));
    }
    return { cart: out, removed, changed, adjusted };
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
    CART_KEY, PENDING_KEY, PENDING_TTL_MS, MAX_LINE_QTY, DEFAULT_DIGITAL_MAX_QTY, MAX_PERSONS, MAX_LINEAR_PERSONS,
    isValidId, positiveInt, validPrice, maxQtyFor,
    isBooking, isLinear, linearMax, personsInput, tierCents, offeredPersons, personsCap, fitPersons, lineTotalCents, cartTotalCents, setPersons,
    sanitizeLine, sanitizeCart, mergeAdd, reconcile, removeLine, removeIds,
    normalizePending, prunePending, addPending, pendingAfterSuccess, isStripeUrl
  };
  root.CD = root.CD || {};
  root.CD.cart = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
