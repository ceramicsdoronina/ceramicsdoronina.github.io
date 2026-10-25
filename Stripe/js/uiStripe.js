// Stripe/js/uiStripe.js
(function () {
  const SUPPORTED_LOCALES = ["it", "en", "ru"];

  // ─────────────────────────────────────────────
  // NAVBAR + VIEW TOGGLE (copiati dal tuo ui.js)
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
  // STRIPE CART (client-side) + checkout via endpoint server-side
  // Il server possiede prezzi, immagini, spedizione e stato "venduto":
  // il client invia solo {id, quantity} + locale. I campi di prezzo/nome
  // salvati nel carrello servono solo per la visualizzazione.
  // ─────────────────────────────────────────────
  const CART_KEY = "cd_stripe_cart_v1";            // stessa chiave in stripe-success.html
  const PENDING_KEY = "cd_checkout_pending";       // {session_id, ids, ts}
  const DEFAULT_DIGITAL_MAX_QTY = 6;
  const MAX_LINE_QTY = 99;
  const CHECKOUT_TIMEOUT_MS = 20000;
  const STRIPE_URL_PREFIX = "https://checkout.stripe.com/";

  const util = () => window.CD.util;
  const isValidId = (id) => util().isValidId(id);

  // Fallback in memoria se localStorage non e' disponibile (modalita' privata, quota, ...)
  let memoryCart = null;
  let storageBroken = false;
  let droppedOnRead = 0;

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
    const seen = new Set();
    const clean = [];
    droppedOnRead = 0;
    for (const raw of arr) {
      const line = sanitizeLine(raw);
      if (!line || seen.has(line.id)) { droppedOnRead++; continue; }
      seen.add(line.id);
      clean.push(line);
    }
    return clean;
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

  function positiveInt(n) {
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  function validPrice(c) {
    return Number.isInteger(c) && c > 0;
  }

  function formatMoney(amountCents, currency) {
    const c = (currency || "EUR").toUpperCase();
    const v = (Number(amountCents || 0) / 100).toFixed(2);
    // stile semplice (evita Intl per compat)
    return c === "EUR" ? `${v} €` : `${v} ${c}`;
  }

  function productTitle(p, id) {
    const lang = getLang();
    const titles = (p && p.titles) || {};
    return titles[lang] || titles.it || titles.en || titles.ru || id;
  }

  function maxQtyFor(p) {
    if (!p || p.type !== "digital") return 1;            // pezzi unici: 1
    return positiveInt(p.maxQty) || DEFAULT_DIGITAL_MAX_QTY;
  }

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

  function storePending(sessionId, ids) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ session_id: sessionId, ids, ts: Date.now() }));
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
      throw err;
    }
    return data;
  }

  async function startCheckout() {
    if (checkoutBusy) return;
    const cart = readCart();
    if (!cart.length) return;

    checkoutBusy = true;
    applyCheckoutButtonState();

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECKOUT_TIMEOUT_MS);

    try {
      const items = cart.map((ci) => ({ id: ci.id, quantity: ci.quantity }));
      const out = await createCheckoutSession(items, ctrl.signal);

      const url = out && typeof out.url === "string" ? out.url : "";
      if (!url.startsWith(STRIPE_URL_PREFIX) || typeof out.session_id !== "string") {
        throw new Error("Risposta checkout non valida");
      }

      storePending(out.session_id, items.map((i) => i.id));
      redirecting = true;
      window.location.href = url;
    } catch (err) {
      console.error("[CHECKOUT] errore:", err && err.message, err && err.requestId ? `request_id=${err.requestId}` : "");
      const key = err && err.status === 400 ? "checkoutStatus.itemUnavailable" : "checkoutStatus.error";
      showNotice(t(key) || "Could not start payment, please try again or contact me.");
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

  // CD.shop espone: addProduct (+ alias addVariant/addItem), removeLineItem, renderDrawer,
  // resetCart, reconcileCart, openDrawer/closeDrawer, showNotice.
  const shop = Object.assign(existingShop, {
    isReady: true,

    // Registro prodotti (popolato da catalogueStripe.js, masterclass.js, certificati.js).
    // Forma unica: products[id] = { id, type: "physical"|"digital", titles: {it,en,ru},
    //                               priceCents, currency, img, maxQty?, sold? }
    products: existingShop.products || {},

    async init() {
      // no-op (il carrello e' locale)
      return true;
    },

    showNotice,

    async resetCart() {
      writeCart([]);
      await shop.renderDrawer();
    },

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
      if (p.sold) {
        console.warn("[CART] prodotto venduto:", id);
        return false;
      }
      if (!validPrice(p.priceCents)) {
        console.warn("[CART] prezzo non valido per", id, p.priceCents);
        return false;
      }

      const type = p.type === "digital" ? "digital" : "physical";
      const maxQty = maxQtyFor(p);
      const addQty = positiveInt(qty) || 1;

      const cart = readCart();
      const line = cart.find((x) => x.id === id);

      if (line) {
        if (type === "physical") {
          showNotice(t("cart.alreadyInCart") || "Already in your cart.");
          await shop.renderDrawer();
          return true;
        }
        if (line.quantity >= maxQty) {
          showNotice(t("cart.maxQty") || "Maximum quantity reached.");
          return true;
        }
        line.quantity = Math.min(maxQty, line.quantity + addQty);
      } else {
        cart.push({
          id,
          type,
          quantity: Math.min(maxQty, addQty),
          name: productTitle(p, id),
          currency: "eur",
          unit_amount: p.priceCents,   // solo visualizzazione
          image: typeof p.img === "string" ? p.img : ""
        });
      }

      writeCart(cart);
      await shop.renderDrawer();
      shop.openDrawer();
      return true;
    },

    // Alias per compatibilita' con codice che usa i vecchi nomi
    async addVariant(productId, qty = 1) {
      return shop.addProduct(productId, qty);
    },

    async addItem(item) {
      return shop.addProduct(item && item.id, item && (item.quantity ?? item.qty) || 1);
    },

    // Allinea il carrello salvato al registro: scarta prodotti sconosciuti/venduti e avvisa.
    // opts.physicalKnown / opts.digitalKnown = false se il relativo catalogo non e' stato caricato
    // (in quel caso non si tocca nulla di quel tipo).
    reconcileCart(opts = {}) {
      const cart = readCart();
      let removed = droppedOnRead;
      let changed = droppedOnRead > 0;
      const out = [];

      for (const line of cart) {
        const p = shop.products[line.id];
        const known = line.type === "physical" ? opts.physicalKnown !== false : opts.digitalKnown !== false;

        if (!known) { out.push(line); continue; }
        if (!p || p.sold || !validPrice(p.priceCents) || (p.type || "physical") !== line.type) {
          removed++;
          changed = true;
          continue;
        }

        const quantity = Math.min(line.quantity, maxQtyFor(p));
        const name = productTitle(p, line.id);
        if (quantity !== line.quantity || name !== line.name || p.priceCents !== line.unit_amount) changed = true;
        out.push(Object.assign({}, line, { quantity, name, unit_amount: p.priceCents }));
      }

      if (changed) writeCart(out);
      shop.renderDrawer();
      if (removed > 0) showNotice(t("cart.removedUnavailable") || "Some items are no longer available.");
      return removed;
    },

    async removeLineItem(productId) {
      const id = normalizeId(productId);
      writeCart(readCart().filter((x) => x.id !== id));
      await shop.renderDrawer();
    },

    async renderDrawer() {
      const itemsEl = document.getElementById("cart-items");
      const totalEl = document.getElementById("cart-total");
      const checkoutBtn = document.getElementById("cart-checkout-btn");
      if (!itemsEl || !totalEl || !checkoutBtn) return;

      const esc = util().escapeHtml;
      const cart = readCart();
      const emptyHtml = () => `<div style="color:var(--muted)">${esc(t("cart.empty") || "Il carrello e' vuoto")}</div>`;

      if (!cart.length) {
        itemsEl.innerHTML = emptyHtml();
        totalEl.textContent = "0";
        applyCheckoutButtonState();
        return;
      }

      let totalCents = 0;
      const rows = cart.map((ci) => {
        const p = shop.products[ci.id];
        const title = p ? productTitle(p, ci.id) : ci.name;
        const unit = p && validPrice(p.priceCents) ? p.priceCents : ci.unit_amount;
        const lineCents = unit * ci.quantity;
        totalCents += lineCents;

        return `
          <div class="cart-item">
            ${ci.image ? `<img class="cart-item__img" src="${esc(ci.image)}" alt="">` : ""}
            <div class="cart-item__meta">
              <div class="cart-item__title">${esc(title)}</div>
              <div class="cart-item__sub">${esc(t("cart.qty") || "Qty")}: ${ci.quantity} · ${esc(formatMoney(lineCents, "EUR"))}</div>
              <button type="button" class="cart-item__remove" data-line-id="${esc(ci.id)}">
                ${esc(t("cart.remove") || "Remove")}
              </button>
            </div>
          </div>
        `;
      }).join("");

      itemsEl.innerHTML = rows || emptyHtml();
      totalEl.textContent = formatMoney(totalCents, "EUR");
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
      await shop.init();
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

    // bfcache (Back dopo il redirect a Stripe): sblocca il pulsante e ridisegna
    window.addEventListener("pageshow", () => {
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
