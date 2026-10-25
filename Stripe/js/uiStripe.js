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
    btn.textContent = checkoutBusy
      ? (t("cart.processing") || "…")
      : (t("cart.checkout") || "Checkout");
    btn.setAttribute("href", "#");
    btn.dataset.disabled = disabled ? "1" : "0";
    btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    btn.style.pointerEvents = disabled ? "none" : "";
    btn.style.opacity = disabled ? "0.6" : "";
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

  // Aggiunge la voce di QUESTA sessione alla mappa (le altre restano; voci > 24 h potate).
  function storePending(sessionId, ids) {
    try {
      const map = cartLib.addPending(readPendingMap(), sessionId, ids, Date.now());
      localStorage.setItem(PENDING_KEY, JSON.stringify(map));
    } catch (err) {
      console.warn("[CHECKOUT] cd_checkout_pending non salvato:", err);
    }
  }

  async function createCheckoutSession(items, signal) {
    const endpoint = window.CD?.config?.checkoutEndpoint;
    if (!endpoint) throw new Error("CD.config.checkoutEndpoint mancante");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, locale: getLang() }),
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

  // 400 con item_id: toglie quella riga dal carrello e, se il server dice "item_sold", segna
  // l'articolo venduto per questa sessione (ri-render: niente piu' pulsante Compra).
  async function dropUnavailableItem(itemId, serverError) {
    writeCart(cartLib.removeLine(readCart(), itemId));
    if (serverError === "item_sold") {
      util().markSold(itemId);
      try {
        if (window.CD?.app?.renderData) window.CD.app.renderData(getLang());
      } catch (err) {
        console.error("[CHECKOUT] ri-render dopo articolo venduto fallito:", err);
      }
    }
    await shop.renderDrawer();
    showNotice(t("cart.removedUnavailable") || "Some items are no longer available and were removed.");
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

    checkoutBusy = true;
    applyCheckoutButtonState();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECKOUT_TIMEOUT_MS);

    try {
      const items = cart.map((ci) => ({ id: ci.id, quantity: ci.quantity }));
      const out = await createCheckoutSession(items, ctrl.signal);

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
      if (err && err.status === 400 && isValidId(err.itemId)) {
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
      return removed;
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
        const unit = p && cartLib.validPrice(p.priceCents) ? p.priceCents : ci.unit_amount;
        const lineCents = unit * ci.quantity;
        totalCents += lineCents;

        return `
          <div class="cart-item">
            ${ci.image ? `<img class="cart-item__img" src="${esc(ci.image)}" alt="">` : ""}
            <div class="cart-item__meta">
              <div class="cart-item__title">${esc(title)}</div>
              <div class="cart-item__sub">${esc(t("cart.qty") || "Qty")}: ${ci.quantity} · <span class="nowrap">${esc(formatMoney(lineCents))}</span></div>
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
      shop.renderDrawer();
    });
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
