// ui.js
(function () {
  // ─────────────────────────────────────────────
  // NAVBAR: hamburger open/close
  // ─────────────────────────────────────────────
  function initNavbarToggle() {
    const body = document.body;
    const toggle = document.getElementById("nav-toggle") || document.querySelector(".nav-toggle-btn");
    const navUl = document.querySelector("header nav ul");

    if (!toggle || !navUl) {
      console.warn("[UI] nav toggle elements not found");
      return;
    }

    // evita doppio binding
    if (toggle.dataset.bound === "1") return;
    toggle.dataset.bound = "1";

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // chiudi menu cliccando fuori / su link
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

  // ─────────────────────────────────────────────
  // VIEW TOGGLE (mobile-view class)
  // ─────────────────────────────────────────────
  function setViewMode(mode) {
    if (mode === "mobile") document.body.classList.add("mobile-view");
    else document.body.classList.remove("mobile-view");
    localStorage.setItem("cd_view", mode);
  }

  function initViewToggle() {
    const saved = localStorage.getItem("cd_view");
    if (saved === "mobile" || saved === "desktop") setViewMode(saved);

    const btn = document.getElementById("view-toggle-btn");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const now = document.body.classList.contains("mobile-view") ? "desktop" : "mobile";
      setViewMode(now);
      btn.textContent = now === "mobile" ? "Desktop" : "Mobile";
    });
  }

  // ─────────────────────────────────────────────
  // SHOPIFY (Cart/Checkout adaptive)
  // ─────────────────────────────────────────────
  const SHOP_DOMAIN = "ceramicsdoronina.myshopify.com";
  const STOREFRONT_TOKEN = "de1ab17005ca54e662d4c86543f523cd";
  const CHECKOUT_KEY = "cd_checkout_id_v1";
  const CART_KEY     = "cd_cart_id_v1";
  
  function toStorefrontVariantId(id) {
    const s = String(id || "").trim();
    if (!s) return "";
    if (s.startsWith("gid://shopify/ProductVariant/")) return s;
    if (s.startsWith("Z2lkOi8v")) return s;
    return btoa(`gid://shopify/ProductVariant/${s}`);
  }
  
  function getCheckoutUrl(obj) {
    return (obj && (obj.checkoutUrl || obj.webUrl)) || "";
  }
  
  function getLang() {
    return (
      window.CD?.i18n?.lang ||
      window.CD?.i18n?.currentLang ||
      document.documentElement.lang ||
      "it"
    );
  }
  
  function t(keyPath) {
    const lang = getLang();
    const all = window.CD?.i18n?.messages || {};
    const dict = all[lang] || all.it || {};
    return keyPath.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), dict);
  }
  
  window.CD = window.CD || {};
  const existingShop = window.CD.shop || {};
  
  window.CD.shop = Object.assign(existingShop, {
    client: existingShop.client || null,
    storeId: existingShop.storeId || null, // cartId o checkoutId
    mode: existingShop.mode || null,
    isReady: existingShop.isReady || false,
    _initPromise: null,
    _addBusy: false,
  
    _api() {
      if (this.client && this.client.cart) return { api: this.client.cart, mode: "cart", key: CART_KEY };
      return { api: this.client.checkout, mode: "checkout", key: CHECKOUT_KEY };
    },
  
    async init(force = false) {
      if (this._initPromise && !force) return this._initPromise;

      this._initPromise = (async () => {
      
            if (typeof ShopifyBuy === "undefined" || !ShopifyBuy.buildClient) {
              console.error("❌ [SHOP] ShopifyBuy non disponibile (manca buy-button-storefront.min.js)");
              return;
            }
        
            if (!this.client || force) {
              this.client = ShopifyBuy.buildClient({
                domain: SHOP_DOMAIN,
                storefrontAccessToken: STOREFRONT_TOKEN
              });
            }
        
            const { api, mode, key } = this._api();
      
            this.mode = mode;
        
            const saved = localStorage.getItem(key);
      
            if (saved) this.storeId = saved;
        
            if (this.storeId) {
              try {
                const existing = await api.fetch(this.storeId);
                if (!existing) {
                  console.warn("⚠️ [SHOP] api.fetch null → reset id:", this.storeId);
                  localStorage.removeItem(key);
                  this.storeId = null;
                } else if (existing.completedAt) {
                  console.warn("⚠️ [SHOP] store completato → reset id:", this.storeId);
                  localStorage.removeItem(key);
                  this.storeId = null;
                }
              } catch (e) {
                // "Load failed" è spesso rete / troppi fetch in parallelo / Safari glitch
                const msg = String(e && (e.message || e)).toLowerCase();
                console.warn("⚠️ [SHOP] api.fetch errore:", e);
              
                if (msg.includes("load failed")) {
                  // NON resettare: lascia l'id e riprova più tardi
                  console.warn("⚠️ [SHOP] errore transitorio (Load failed) → NON resetto storeId");
                  return; // esci da init senza distruggere lo stato
                }
              
                // altri errori: qui sì resetti
                localStorage.removeItem(key);
                this.storeId = null;
              }
            }
        
            if (!this.storeId) {
              const created = await api.create();
              this.storeId = created.id;
              localStorage.setItem(key, this.storeId);
            }
        
            this.isReady = true;
            console.log("✅ [SHOP] Store pronto:", this.mode, this.storeId);
            console.log("🧪 [SHOP] mode:", this.mode, "has cart:", !!this.client.cart);
        
            await this.renderDrawer();
      })();
      const res = this._initPromise;
      try { await res; } finally { this._initPromise = null; }
      return res;
    },
  
    async resetCart() {
      this.closeDrawer();

      const { api, mode, key } = this._api();
      this.mode = mode;

      localStorage.removeItem(key);
      this.storeId = null;
      this.isReady = false;

      const created = await api.create();
      this.storeId = created.id;
      localStorage.setItem(key, this.storeId);

      this.isReady = true;
      console.log("✅ [SHOP] Store ricreato:", this.mode, this.storeId);
    },
  
    async addVariant(variantId, qty = 1) {
      if (this._addBusy) {
        console.warn("⚠️ [SHOP] addVariant ignorato (busy)");
        return false;
      }
      this._addBusy = true;
      try {
            await this.init();
            const { api } = this._api();
            if (!api || !this.storeId) return false;
        
            const storefrontId = toStorefrontVariantId(variantId);
            if (!storefrontId) return false;
        
            try {
              if (typeof api.addLineItems === "function") {
                await api.addLineItems(this.storeId, [{ variantId: storefrontId, quantity: qty }]);
              } else if (typeof api.addLines === "function") {
                await api.addLines(this.storeId, [{ merchandiseId: storefrontId, quantity: qty }]);
              } else {
                console.error("❌ [SHOP] Nessun metodo addLineItems/addLines");
                return false;
              }
        
              await this.renderDrawer();
              this.openDrawer();
              return true;
            } catch (err) {
              console.error("❌ [SHOP] add FAILED:", err);
        
              // retry una volta
              try {
                await this.resetCart();
                const { api: api2 } = this._api();
        
                if (typeof api2.addLineItems === "function") {
                  await api2.addLineItems(this.storeId, [{ variantId: storefrontId, quantity: qty }]);
                } else if (typeof api2.addLines === "function") {
                  await api2.addLines(this.storeId, [{ merchandiseId: storefrontId, quantity: qty }]);
                } else {
                  return false;
                }
        
                await this.renderDrawer();
                this.openDrawer();
                return true;
              } catch (err2) {
                console.error("❌ [SHOP] add retry FAILED:", err2);
                return false;
              }
            }
      } finally {
        this._addBusy = false;
      }
    },
  
    async removeLineItem(lineId) {
      await this.init();
      const { api } = this._api();
      if (!api || !this.storeId) return;
  
      try {
        if (typeof api.removeLineItems === "function") {
          await api.removeLineItems(this.storeId, [lineId]);
        } else if (typeof api.removeLines === "function") {
          await api.removeLines(this.storeId, [lineId]);
        } else {
          console.error("❌ [SHOP] Nessun metodo removeLineItems/removeLines");
          return;
        }
        await this.renderDrawer();
      } catch (err) {
        console.error("❌ [SHOP] remove FAILED:", err);
      }
    },
  
    async renderDrawer() {
      const itemsEl = document.getElementById("cart-items");
      const totalEl = document.getElementById("cart-total");
      const checkoutBtn = document.getElementById("cart-checkout-btn");
      if (!itemsEl || !totalEl || !checkoutBtn) return;
  
      if (!this.client || !this.storeId) return;
  
      const { api } = this._api();
  
      const obj = await api.fetch(this.storeId);
      if (!obj) {
        console.warn("⚠️ [SHOP] fetch null in renderDrawer → creo store nuovo e mostro carrello vuoto");
        await this.resetCart();
      
        // mostra vuoto e non loopare
        itemsEl.innerHTML = `<div style="color:var(--muted)">${t("cart.empty") || "Il carrello è vuoto"}</div>`;
        totalEl.textContent = "0";
        checkoutBtn.removeAttribute("href");
        return;
      }
  
      const url = getCheckoutUrl(obj);
      if (!url) {
        console.warn("⚠️ [SHOP] checkoutUrl/webUrl mancante → reset");
        await this.resetCart();
        return;
      }
      checkoutBtn.href = url;
  
      if (!checkoutBtn.dataset.boundCheckoutTrack) {
        checkoutBtn.dataset.boundCheckoutTrack = "1";
        checkoutBtn.addEventListener("click", () => {
          localStorage.setItem("cd_checkout_started", "1");
          localStorage.setItem("cd_checkout_ts", String(Date.now()));
        });
      }
  
      checkoutBtn.textContent = (window.CD?.i18n?.messages?.[getLang()]?.cart?.checkout) || "Checkout";
  
      // totale (minimo)
      const amount =
        obj?.subtotalPriceV2?.amount ||
        obj?.cost?.subtotalAmount?.amount ||
        "0";
      const currency =
        obj?.subtotalPriceV2?.currencyCode ||
        obj?.cost?.subtotalAmount?.currencyCode ||
        "";
      totalEl.textContent = `${amount} ${currency}`.trim();
  
      const lineItems = obj.lineItems || obj.lines || [];
      const arr = Array.isArray(lineItems)
        ? lineItems
        : (lineItems?.edges ? lineItems.edges.map(e => e.node) : []);
  
      if (!arr.length) {
        itemsEl.innerHTML = `<div style="color:var(--muted)">${t("cart.empty") || "Il carrello è vuoto"}</div>`;
        return;
      }
  
      const lang = getLang();
  
      itemsEl.innerHTML = arr.map((li) => {
        const id = li.id;
        const q = li.quantity || 1;
        const title = li.title || li.merchandise?.product?.title || "Item";
  
        const img =
          li?.variant?.image?.src ||
          li?.merchandise?.image?.src ||
          "";
  
        const variantNumeric =
          li?.variant?.id ? String(li.variant.id).split("/").pop()
          : (li?.merchandise?.id ? String(li.merchandise.id).split("/").pop() : "");
  
        const localName = window.CD?.shop?.nameByVariant?.[variantNumeric]?.[lang];
        const finalTitle = localName || title;
  
        return `
          <div class="cart-item">
            ${img ? `<img class="cart-item__img" src="${img}" alt="">` : ""}
            <div class="cart-item__meta">
              <div class="cart-item__title">${finalTitle}</div>
              <div class="cart-item__sub">${t("cart.qty") || "Qty"}: ${q}</div>
              <button type="button" class="cart-item__remove" data-line-id="${id}">
                ${t("cart.remove") || "Remove"}
              </button>
            </div>
          </div>
        `;
      }).join("");
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

  // ─────────────────────────────────────────────
  // CART OPEN/CLOSE BUTTONS
  // ─────────────────────────────────────────────
  function initCartOpenButton() {
    const drawer = document.getElementById("cart-drawer");
    if (!drawer) {
      console.warn("[UI] #cart-drawer non trovato");
      return;
    }
  
    // evita doppio binding
    if (drawer.dataset.bound === "1") return;
    drawer.dataset.bound = "1";
  
    async function openCart(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      await window.CD.shop.init();
      await window.CD.shop.renderDrawer();
      window.CD.shop.openDrawer();      // <-- usa is-open
    }
  
    function closeCart(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      window.CD.shop.closeDrawer();     // <-- usa is-open
    }
  
    document.addEventListener("click", (e) => {
      const openBtn = e.target.closest("#cart-open-btn");
      if (openBtn) return openCart(e);
  
      const closeBtn = e.target.closest("#cart-close-btn");
      if (closeBtn) return closeCart(e);
  
      // click sullo sfondo (il contenitore #cart-drawer)
      if (e.target.closest("[data-cart-backdrop]")) return closeCart(e);
    }, false);
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCart(e);
    });
  }

  // delegazione remove item
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".cart-item__remove");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const lineId = btn.dataset.lineId;
    if (!lineId) return;
    await window.CD.shop.removeLineItem(lineId);
  });

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

