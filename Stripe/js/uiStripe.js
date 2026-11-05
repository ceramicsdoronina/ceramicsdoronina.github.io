// Stripe/js/uiStripe.js
(function () {
  const SUPPORTED_LOCALES = ["it", "en", "ru"];

  // ─────────────────────────────────────────────
  // NAVBAR + VIEW TOGGLE
  // ─────────────────────────────────────────────
  function initNavbarToggle() {
    const body = document.body;
    const toggle = document.getElementById("nav-toggle") || document.querySelector(".nav-toggle-btn");
    const navUl = document.querySelector("header nav ul");

    if (!toggle || !navUl) {
      console.warn("[UI] nav toggle elements not found");
      return;
    }

    if (toggle.dataset.bound === "1") return;
    toggle.dataset.bound = "1";

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  function initNavbarAutoClose() {
    document.addEventListener("click", (e) => {
      const body = document.body;
      if (!body.classList.contains("nav-open")) return;

      const clickedToggle = e.target.closest("#nav-toggle, .nav-toggle-btn");
      const clickedInsideMenu = e.target.closest("header nav ul");
      if (clickedToggle || clickedInsideMenu) return;

      body.classList.remove("nav-open");
    });

    document.addEventListener("click", (e) => {
      const link = e.target.closest("header nav a");
      if (!link) return;
      document.body.classList.remove("nav-open");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") document.body.classList.remove("nav-open");
    });
  }

  function setViewMode(mode) {
    if (mode === "mobile") document.body.classList.add("mobile-view");
    else document.body.classList.remove("mobile-view");
    try {
      localStorage.setItem("cd_view", mode);
    } catch (err) {
      console.warn("[UI] cd_view non salvato (storage non disponibile):", err);
    }
    updateViewToggleLabel();
  }

  // Il pulsante mostra la modalita' verso cui si passa; testo via messages.js (view.*)
  function updateViewToggleLabel() {
    const btn = document.getElementById("view-toggle-btn");
    if (!btn) return;
    const key = document.body.classList.contains("mobile-view") ? "view.desktop" : "view.mobile";
    btn.setAttribute("data-i18n", key);
    const label = t(key);
    if (label) btn.textContent = label;
  }

  function initViewToggle() {
    let saved = null;
    try {
      saved = localStorage.getItem("cd_view");
    } catch (err) {
      console.warn("[UI] cd_view non leggibile:", err);
    }
    if (saved === "mobile" || saved === "desktop") setViewMode(saved);
    else updateViewToggleLabel();

    const btn = document.getElementById("view-toggle-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      setViewMode(document.body.classList.contains("mobile-view") ? "desktop" : "mobile");
    });
  }

  // ─────────────────────────────────────────────
  // I18N helper (lingua: unico accessore CD.i18n.getCurrentLang)
  // ─────────────────────────────────────────────
  function getLang() {
    const l = window.CD?.i18n?.getCurrentLang?.() || document.documentElement.lang || "it";
    return SUPPORTED_LOCALES.includes(l) ? l : "it";
  }

  function t(keyPath) {
    return window.CD?.i18n?.t?.(keyPath, getLang()) || null;
  }

  // ─────────────────────────────────────────────
  // STRIPE CART (strato DOM/localStorage; la logica pura sta in cart.js) + checkout via endpoint
  // Il server possiede prezzi, immagini, spedizione e stato "venduto":
  // il client invia solo {id, quantity} + locale. I campi di prezzo/nome
  // salvati nel carrello servono solo per la visualizzazione.
  // ─────────────────────────────────────────────
  const cartLib = window.CD.cart;                  // Stripe/js/cart.js (caricato prima di questo file)
  const CART_KEY = cartLib.CART_KEY;               // stessa chiave in stripe-success.html
  const PENDING_KEY = cartLib.PENDING_KEY;         // mappa {"<session_id>": {ids, ts}}
  const CHECKOUT_TIMEOUT_MS = 20000;
  const REDIRECT_FALLBACK_MS = 12000;

  const util = () => window.CD.util;
  const isValidId = (id) => cartLib.isValidId(id);

  // Fallback in memoria se localStorage non e' disponibile (modalita' privata, quota, ...)
  let memoryCart = null;
  let storageBroken = false;
  let droppedOnRead = 0;

  function readCart() {
    let arr = [];
    if (storageBroken && memoryCart) {
      arr = memoryCart;
    } else {
      try {
        const raw = localStorage.getItem(CART_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        arr = Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.warn("[CART] lettura carrello fallita, uso carrello vuoto:", err);
        arr = memoryCart || [];
      }
    }
    const res = cartLib.sanitizeCart(arr);
    droppedOnRead = res.dropped;
    return res.cart;
  }

  function writeCart(arr) {
    memoryCart = arr.map((x) => Object.assign({}, x));
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(arr));
      storageBroken = false;
    } catch (err) {
      storageBroken = true;
      console.warn("[CART] scrittura localStorage fallita, carrello solo in memoria:", err);
    }
  }

  function normalizeId(x) {
    return String(x || "").trim();
  }

  function formatMoney(amountCents) {
    return window.CD.money.format(amountCents, getLang());
  }

  function productTitle(p, id) {
    const lang = getLang();
    const titles = (p && p.titles) || {};
    return titles[lang] || titles.it || titles.en || titles.ru || id;
  }

  // firma delle righe: serve a rilevare un carrello cambiato (altra scheda) tra drawer e click
  const lineSig = (cart) => JSON.stringify(cart.map((c) => [c.id, c.quantity]));
  let renderedSig = null;

  // ── messaggi nel drawer ──
  let noticeTimer = null;
  function showNotice(msg, open = true) {
    const el = document.getElementById("cart-notice");
    if (!el) { window.alert(msg); return; }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { el.textContent = ""; el.hidden = true; }, 8000);
    if (open) shop.openDrawer();
  }

  // ── checkout ──
  let checkoutBusy = false;
  let redirecting = false;
  let redirectTimer = null;

  function applyCheckoutButtonState() {
    const btn = document.getElementById("cart-checkout-btn");
    if (!btn) return;
    const empty = readCart().length === 0;
    const disabled = empty || checkoutBusy;
    // senza informativa accettata il pulsante e' "disabilitato" per gli assistivi e attenuato, ma resta
    // cliccabile: il click mostra l'errore accanto alla casella (niente alert del browser)
    const needsConsent = !disabled && !privacyChecked();
    btn.textContent = checkoutBusy
      ? (t("cart.processing") || "…")
      : (t("cart.checkout") || "Checkout");
    btn.setAttribute("href", "#");
    btn.dataset.disabled = disabled ? "1" : "0";
    btn.setAttribute("aria-disabled", disabled || needsConsent ? "true" : "false");
    btn.dataset.needsConsent = needsConsent ? "1" : "0";
    btn.style.pointerEvents = disabled ? "none" : "";
    btn.style.opacity = disabled || needsConsent ? "0.6" : "";
  }

  // ── consensi (mai salvati: ad ogni apertura/pageshow tornano ai valori predefiniti) ──
  const CONSENT_BOXES = {
    privacy: "cart-consent-privacy",
    email_marketing: "cart-consent-email",
    other_channels: "cart-consent-channels",
    third_party: "cart-consent-third"
  };
  function consentChecked(key) {
    const el = document.getElementById(CONSENT_BOXES[key]);
    return !!(el && el.checked);
  }
  function privacyChecked() { return consentChecked("privacy"); }
  function readConsentState() {
    const st = {};
    for (const k of Object.keys(CONSENT_BOXES)) st[k] = consentChecked(k);
    return st;
  }
  function showConsentError(show) {
    const el = document.getElementById("cart-consent-error");
    if (el) el.hidden = !show;
    const box = document.getElementById("cart-consent-privacy");
    if (box) box.setAttribute("aria-invalid", show ? "true" : "false");
    if (show && box) box.focus();
  }
  function showConsentErrorSilently() {
    const el = document.getElementById("cart-consent-error");
    if (el) el.hidden = true;
    const box = document.getElementById("cart-consent-privacy");
    if (box) box.setAttribute("aria-invalid", "false");
  }
  function resetConsents() {
    // valori predefiniti: privacy e e-mail selezionate, altri canali e terzi no
    for (const k of Object.keys(CONSENT_BOXES)) {
      const el = document.getElementById(CONSENT_BOXES[k]);
      if (el) el.checked = cartLib.CONSENT_DEFAULTS[k] === true;
    }
    showConsentErrorSilently();
    applyCheckoutButtonState();
  }

  function readPendingMap() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return cartLib.normalizePending(raw ? JSON.parse(raw) : null);
    } catch (err) {
      console.warn("[CHECKOUT] cd_checkout_pending non leggibile:", err);
      return {};
    }
  }

  // Aggiunge la voce di QUESTA sessione alla mappa (le altre restano; nessuna scadenza per eta').
  function storePending(sessionId, ids) {
    try {
      const map = cartLib.addPending(readPendingMap(), sessionId, ids, Date.now());
      localStorage.setItem(PENDING_KEY, JSON.stringify(map));
    } catch (err) {
      console.warn("[CHECKOUT] cd_checkout_pending non salvato:", err);
    }
  }

  // ── pagamento completato: svuota il carrello da solo ──
  // Per ogni sessione "in sospeso" di questo browser chiede alla funzione session-status {paid, status}. Se paid:true toglie dal
  // carrello SOLO le righe di quell'ordine (come stripe-success.html); se la sessione e' scaduta toglie solo il marcatore.
  // Errori di rete/HTTP: silenziosi, si riprova al prossimo evento. Mai nulla per paid:false.
  const STATUS_GAP_EVENT_MS = 10000;   // al massimo una richiesta ogni 10 s per sessione (load/pageshow/visibilitychange)
  const STATUS_GAP_POLL_MS = 4500;     // il polling gira ogni 5 s
  const POLL_INTERVAL_MS = 5000;
  const POLL_WINDOW_MS = 2 * 60 * 1000;
  const STATUS_TIMEOUT_MS = 8000;
  const statusLastChecked = {};
  const statusInflight = new Set();
  let pollTimer = null;
  let pollUntil = 0;

  function writePendingMap(map) {
    try {
      if (Object.keys(map).length) localStorage.setItem(PENDING_KEY, JSON.stringify(map));
      else localStorage.removeItem(PENDING_KEY);
    } catch (err) {
      console.warn("[CHECKOUT] cd_checkout_pending non salvato:", err);
    }
  }

  async function fetchSessionStatus(sid) {
    const url = cartLib.sessionStatusUrl(window.CD?.config?.sessionStatusEndpoint, sid);
    if (!url) return null;
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), STATUS_TIMEOUT_MS) : null;
    try {
      const res = await fetch(url, { method: "GET", credentials: "omit", cache: "no-store", signal: ctrl ? ctrl.signal : undefined });
      if (!res.ok) return null;
      const data = await res.json();
      return data && typeof data.paid === "boolean" ? { paid: data.paid, status: String(data.status || "") } : null;
    } catch (_) {
      return null; // silenzioso: si riprova
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function checkPendingSessions(minGapMs) {
    const now = Date.now();
    const due = cartLib.pendingToCheck(readPendingMap(), statusLastChecked, now, minGapMs).filter((sid) => !statusInflight.has(sid));
    if (!due.length) return;
    const answers = {};
    await Promise.all(due.map(async (sid) => {
      statusInflight.add(sid);
      statusLastChecked[sid] = now;
      try {
        const a = await fetchSessionStatus(sid);
        if (a) answers[sid] = a;
      } finally {
        statusInflight.delete(sid);
      }
    }));
    if (!Object.keys(answers).length) return;
    // stato FRESCO dopo le richieste (un'altra scheda puo' aver cambiato carrello o marcatore nel frattempo)
    const res = cartLib.resolvePending(readPendingMap(), readCart(), answers);
    if (!res.cleared.length && !res.dropped.length) return;
    if (res.cleared.length) writeCart(res.cart);
    writePendingMap(res.map);
    await shop.renderDrawer();
  }

  function stopPendingPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function pollTick() {
    if (document.hidden) return; // pagina non visibile: niente richieste
    if (Date.now() > pollUntil || !Object.keys(readPendingMap()).length) { stopPendingPoll(); return; }
    checkPendingSessions(STATUS_GAP_POLL_MS);
  }

  // Da chiamare a caricamento, pageshow e quando la pagina torna visibile: controllo subito + polling leggero per ~2 minuti.
  function startPendingWatch() {
    if (!window.CD?.config?.sessionStatusEndpoint) return;
    if (!Object.keys(readPendingMap()).length) return;
    checkPendingSessions(STATUS_GAP_EVENT_MS);
    pollUntil = Date.now() + POLL_WINDOW_MS;
    if (!pollTimer) pollTimer = setInterval(pollTick, POLL_INTERVAL_MS);
  }

  async function createCheckoutSession(items, consents, signal) {
    const endpoint = window.CD?.config?.checkoutEndpoint;
    if (!endpoint) throw new Error("CD.config.checkoutEndpoint mancante");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, locale: getLang(), consents }),
      signal
    });

    let data = null;
    try { data = await res.json(); } catch (_) { /* corpo non JSON */ }

    if (!res.ok) {
      const err = new Error(`Checkout API error: HTTP ${res.status}`);
      err.status = res.status;
      err.requestId = data && data.request_id;
      err.serverError = data && data.error;
      err.itemId = data && typeof data.item_id === "string" ? data.item_id : null;
      throw err;
    }
    return data;
  }

  // Messaggi per i 400 delle masterclass (codici del server)
  const BOOKING_ERROR_KEYS = {
    not_enough_seats: "cart.notEnoughSeats",
    sold_out: "cart.soldOut",
    group_size_unavailable: "cart.groupUnavailable"
  };

  // 400 con item_id: toglie quella riga dal carrello e, se il server dice "item_sold" o "sold_out",
  // segna l'articolo venduto per questa sessione (ri-render: niente piu' pulsante Compra).
  async function dropUnavailableItem(itemId, serverError) {
    writeCart(cartLib.removeLine(readCart(), itemId));
    if (serverError === "item_sold" || serverError === "sold_out") {
      util().markSold(itemId);
      try {
        if (window.CD?.app?.renderData) window.CD.app.renderData(getLang());
      } catch (err) {
        console.error("[CHECKOUT] ri-render dopo articolo venduto fallito:", err);
      }
    }
    await shop.renderDrawer();
    const bookingKey = BOOKING_ERROR_KEYS[serverError];
    showNotice((bookingKey && t(bookingKey)) || t("cart.removedUnavailable") || "Some items are no longer available and were removed.");
  }

  async function startCheckout() {
    if (checkoutBusy) return;
    const cart = readCart();
    if (!cart.length) return;

    // il carrello letto ora deve coincidere con le righe mostrate nel drawer
    // (altrimenti e' cambiato altrove, es. altra scheda): ridisegna e avvisa invece di inviare
    if (renderedSig !== null && lineSig(cart) !== renderedSig) {
      await shop.renderDrawer();
      showNotice(t("cart.changed") || "Your cart was updated. Please review it and try again.");
      return;
    }

    const consents = cartLib.buildConsents(readConsentState());
    if (!consents) {
      showConsentError(true);
      applyCheckoutButtonState();
      return;
    }

    checkoutBusy = true;
    applyCheckoutButtonState();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECKOUT_TIMEOUT_MS);

    try {
      const items = cart.map((ci) => ({ id: ci.id, quantity: ci.quantity }));
      const out = await createCheckoutSession(items, consents, ctrl.signal);

      const url = out && typeof out.url === "string" ? out.url : "";
      if (!cartLib.isStripeUrl(url) || typeof out.session_id !== "string") {
        throw new Error("Risposta checkout non valida");
      }

      storePending(out.session_id, items.map((i) => i.id));
      redirecting = true;
      window.location.href = url;

      // se la pagina e' ancora viva dopo 12 s (redirect bloccato, ecc.) sblocca il pulsante
      clearTimeout(redirectTimer);
      redirectTimer = setTimeout(() => {
        redirecting = false;
        checkoutBusy = false;
        applyCheckoutButtonState();
      }, REDIRECT_FALLBACK_MS);
    } catch (err) {
      console.error("[CHECKOUT] errore:", err && err.message, err && err.requestId ? `request_id=${err.requestId}` : "");
      if (err && err.status === 400 && err.serverError === "privacy_required") {
        showConsentError(true);
        showNotice(t("consent.privacyRequired") || "You must accept the privacy notice to continue.");
      } else if (err && err.status === 400 && err.serverError === "item_held") {
        // pezzo unico in questo momento nel checkout di un altro cliente: resta nel carrello (tornera' disponibile se quel pagamento non va a buon fine)
        showNotice(t("cart.itemHeld") || "Someone else is completing the purchase of this piece. Please try again in about 30 minutes.");
      } else if (err && err.status === 400 && isValidId(err.itemId)) {
        await dropUnavailableItem(err.itemId, err.serverError);
      } else {
        const key = err && err.status === 400 ? "checkoutStatus.itemUnavailable" : "checkoutStatus.error";
        showNotice(t(key) || "Could not start payment. Please try again or contact me.");
      }
    } finally {
      clearTimeout(timer);
      if (!redirecting) {
        checkoutBusy = false;
        applyCheckoutButtonState();
      }
    }
  }

  window.CD = window.CD || {};
  const existingShop = window.CD.shop || {};

  // CD.shop espone: addProduct, removeLineItem, renderDrawer, reconcileCart,
  // openDrawer/closeDrawer, showNotice, products.
  const shop = Object.assign(existingShop, {
    // Registro prodotti (popolato da catalogueStripe.js, masterclass.js, certificati.js via
    // CD.util.registerProduct). Forma unica: products[id] = { id, type: "physical"|"digital",
    //   titles: {it,en,ru}, priceCents, currency, img, maxQty?, sold?, source }
    products: existingShop.products || {},

    showNotice,

    // Aggiunge un prodotto del registro al carrello. Ritorna true se il carrello e' coerente
    // (anche se la riga esisteva gia'), false se il prodotto non e' acquistabile.
    async addProduct(productId, qty = 1) {
      const id = normalizeId(productId);
      if (!isValidId(id)) {
        console.warn("[CART] id prodotto non valido:", id);
        return false;
      }

      const p = shop.products[id];
      if (!p) {
        console.warn("[CART] prodotto non registrato:", id);
        return false;
      }

      const res = cartLib.mergeAdd(readCart(), p, qty, { name: productTitle(p, id) });

      if (res.status === "invalid") {
        console.warn("[CART] prodotto non acquistabile (venduto o prezzo non valido):", id);
        return false;
      }
      if (res.status === "already") {
        showNotice(t("cart.alreadyInCart") || "Already in your cart.");
        await shop.renderDrawer();
        return true;
      }
      if (res.status === "max") {
        showNotice(t("cart.maxQty") || "Maximum quantity reached.");
        return true;
      }

      writeCart(res.cart);
      await shop.renderDrawer();
      shop.openDrawer();
      return true;
    },

    // Allinea il carrello salvato al registro: scarta prodotti sconosciuti/venduti e avvisa.
    // opts.physicalKnown / opts.digitalKnown = false se il relativo catalogo non e' noto
    // (in quel caso non si tocca nulla di quel tipo).
    reconcileCart(opts = {}) {
      const cart = readCart();
      const res = cartLib.reconcile(cart, shop.products, Object.assign({}, opts, { nameFor: productTitle }));
      const removed = droppedOnRead + res.removed;

      if (res.changed || droppedOnRead > 0) writeCart(res.cart);
      shop.renderDrawer();
      if (removed > 0) showNotice(t("cart.removedUnavailable") || "Some items are no longer available.");
      else if (res.adjusted > 0) showNotice(t("cart.bookingAdjusted") || "A booking was reduced to match the free seats.");
      return removed;
    },

    // Cambia le persone di una prenotazione masterclass nel carrello (prezzo = tier di quel N).
    async setPersons(productId, persons) {
      const id = normalizeId(productId);
      const res = cartLib.setPersons(readCart(), shop.products[id], id, persons);
      if (res.status !== "ok") { await shop.renderDrawer(); return false; }
      writeCart(res.cart);
      await shop.renderDrawer();
      return true;
    },

    async removeLineItem(productId) {
      const id = normalizeId(productId);
      writeCart(cartLib.removeLine(readCart(), id));
      await shop.renderDrawer();
    },

    async renderDrawer() {
      const itemsEl = document.getElementById("cart-items");
      const totalEl = document.getElementById("cart-total");
      const checkoutBtn = document.getElementById("cart-checkout-btn");
      if (!itemsEl || !totalEl || !checkoutBtn) return;

      const esc = util().escapeHtml;
      const cart = readCart();
      renderedSig = lineSig(cart);
      const emptyHtml = () => `<div style="color:var(--muted)">${esc(t("cart.empty") || "Il carrello e' vuoto")}</div>`;

      if (!cart.length) {
        itemsEl.innerHTML = emptyHtml();
        totalEl.textContent = formatMoney(0);
        applyCheckoutButtonState();
        return;
      }

      let totalCents = 0;
      const rows = cart.map((ci) => {
        const p = shop.products[ci.id];
        const title = p ? productTitle(p, ci.id) : ci.name;
        // masterclass: prezzo del gruppo (tier) per N persone, mai unitario x quantita'
        const lineCents = cartLib.lineTotalCents(ci, p) || 0;
        totalCents += lineCents;
        const booking = cartLib.isBooking(p);
        const personsLbl = esc(t("cart.persons") || "People");
        let qtyHtml;
        if (booking && cartLib.personsInput(p) === "number") {
          // lineare illimitato / massimo > 20: campo numerico
          qtyHtml = `<label>${personsLbl}: <input type="number" class="cart-item__persons" data-line-id="${esc(ci.id)}" min="1" max="${cartLib.personsCap(p)}" step="1" inputmode="numeric" autocomplete="off" value="${ci.quantity}" aria-label="${personsLbl}"></label>`;
        } else if (booking) {
          qtyHtml = `<label>${personsLbl}: <select class="cart-item__persons" data-line-id="${esc(ci.id)}" aria-label="${personsLbl}">${
            cartLib.offeredPersons(p).map((k) => `<option value="${k}"${k === ci.quantity ? " selected" : ""}>${esc(util().personsLabel(k, getLang(), (key, l) => window.CD.i18n.t(key, l)))}</option>`).join("")
          }</select></label>`;
        } else {
          qtyHtml = `${esc(t("cart.qty") || "Qty")}: ${ci.quantity}`;
        }

        return `
          <div class="cart-item">
            ${ci.image ? `<img class="cart-item__img" src="${esc(ci.image)}" alt="">` : ""}
            <div class="cart-item__meta">
              <div class="cart-item__title">${esc(title)}</div>
              <div class="cart-item__sub">${qtyHtml} · <span class="nowrap">${esc(formatMoney(lineCents))}</span></div>
              <button type="button" class="cart-item__remove" data-line-id="${esc(ci.id)}">
                ${esc(t("cart.remove") || "Remove")}
              </button>
            </div>
          </div>
        `;
      }).join("");

      itemsEl.innerHTML = rows || emptyHtml();
      totalEl.textContent = formatMoney(totalCents);
      applyCheckoutButtonState();
    },

    openDrawer() {
      const drawer = document.getElementById("cart-drawer");
      if (!drawer) return;
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
    },

    closeDrawer() {
      const drawer = document.getElementById("cart-drawer");
      if (!drawer) return;
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }
  });
  window.CD.shop = shop;

  // ─────────────────────────────────────────────
  // CART OPEN/CLOSE BUTTONS + checkout (bind una sola volta)
  // ─────────────────────────────────────────────
  function initCartOpenButton() {
    const drawer = document.getElementById("cart-drawer");
    if (!drawer) {
      console.warn("[UI] #cart-drawer non trovato");
      return;
    }

    if (drawer.dataset.bound === "1") return;
    drawer.dataset.bound = "1";

    async function openCart(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      await shop.renderDrawer();
      shop.openDrawer();
    }

    function closeCart(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      shop.closeDrawer();
    }

    document.addEventListener("click", (e) => {
      const openBtn = e.target.closest("#cart-open-btn");
      if (openBtn) return openCart(e);

      const closeBtn = e.target.closest("#cart-close-btn");
      if (closeBtn) return closeCart(e);

      // click sullo sfondo: chiudi se clicchi fuori dal pannello
      if (e.target && e.target.id === "cart-drawer") return closeCart(e);

      // checkout (delegato: il pulsante resta lo stesso nodo, ma e' indipendente da renderDrawer)
      if (e.target.closest("#cart-checkout-btn")) {
        e.preventDefault();
        e.stopPropagation();
        const btn = document.getElementById("cart-checkout-btn");
        if (btn && btn.dataset.disabled === "1") return;
        startCheckout();
        return;
      }

      // rimozione riga
      const rm = e.target.closest(".cart-item__remove");
      if (rm) {
        e.preventDefault();
        e.stopPropagation();
        const lineId = rm.dataset.lineId;
        if (lineId) shop.removeLineItem(lineId);
      }
    }, false);

    // casella privacy: aggiorna il pulsante e nasconde l'errore
    document.addEventListener("change", (e) => {
      if (!e.target || e.target.id !== "cart-consent-privacy") return;
      if (privacyChecked()) showConsentErrorSilently();
      applyCheckoutButtonState();
    });

    // persone di una prenotazione masterclass nel drawer
    document.addEventListener("change", (e) => {
      const sel = e.target && e.target.closest ? e.target.closest(".cart-item__persons") : null;
      if (!sel || !sel.dataset.lineId) return;
      let n = parseInt(sel.value, 10);
      if (sel.tagName === "INPUT") {
        // campo numerico: vuoto / non numerico -> 1, sopra il massimo -> massimo
        const p = shop.products[normalizeId(sel.dataset.lineId)];
        n = cartLib.fitPersons(p, Number.isInteger(n) && n > 0 ? n : 1) || 1;
      }
      shop.setPersons(sel.dataset.lineId, n);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!drawer.classList.contains("is-open")) return;
      closeCart(e);
    });

    // carrello modificato in un'altra scheda: ridisegna il drawer (key null = storage svuotato)
    window.addEventListener("storage", (e) => {
      if (e.key === null || e.key === CART_KEY) shop.renderDrawer();
    });

    // bfcache (Back dopo il redirect a Stripe): sblocca il pulsante e ridisegna
    window.addEventListener("pageshow", () => {
      clearTimeout(redirectTimer);
      redirecting = false;
      checkoutBusy = false;
      resetConsents(); // dopo il Back da Stripe le caselle ripartono vuote
      shop.renderDrawer();
      startPendingWatch();
    });

    // pagina di nuovo visibile (cambio scheda, ritorno dall'app dei pagamenti): ricontrolla le sessioni in sospeso
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) startPendingWatch();
    });

    // al caricamento: un ordine pagato in un'altra scheda/pagina svuota subito il carrello
    startPendingWatch();
  }

  // ─────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────
  window.CD.ui = {
    initNavbarToggle,
    initNavbarAutoClose,
    initViewToggle,
    initCartOpenButton
  };
})();
