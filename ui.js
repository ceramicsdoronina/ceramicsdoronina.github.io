// ui.js
(function () {
  // ─────────────────────────────────────────────
  // NAVBAR: hamburger open/close
  // ─────────────────────────────────────────────
  function initNavbarToggle() {
    const body = document.body;
    const toggle =
      document.getElementById("nav-toggle") || document.querySelector(".nav-toggle-btn");

    if (!toggle) {
      console.warn("[UI] nav toggle button not found");
      return;
    }

    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      console.log("[UI] nav-open now:", isOpen, "body class:", body.className);
    });
  }

  // Chiudi menu quando clicchi fuori dal menu (mobile)
  function initNavbarAutoClose() {
    document.addEventListener("click", (e) => {
      const body = document.body;
      if (!body.classList.contains("nav-open")) return;

      const nav = document.querySelector("header");
      const toggle =
        document.getElementById("nav-toggle") || document.querySelector(".nav-toggle-btn");

      const clickedInsideHeader = nav && nav.contains(e.target);
      const clickedToggle = toggle && toggle.contains(e.target);

      // Se clicco sul toggle, ci pensa initNavbarToggle
      if (clickedToggle) return;

      // Se clicco dentro l'header ma NON sul menu UL, chiudi
      // (così clic su logo/lingua chiude)
      if (clickedInsideHeader) {
        const menu = document.querySelector("header nav ul");
        if (menu && !menu.contains(e.target)) {
          body.classList.remove("nav-open");
          if (toggle) toggle.setAttribute("aria-expanded", "false");
          return;
        }
      }

      // Se clicco fuori header, chiudi
      if (!clickedInsideHeader) {
        body.classList.remove("nav-open");
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
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
  // SHOPIFY: Checkout-based cart + custom drawer
  // (stabile: non usa ShopifyBuy.UI.createComponent('cart'))
  // ─────────────────────────────────────────────
  const SHOP_DOMAIN = "ceramicsdoronina.myshopify.com";
  const STOREFRONT_TOKEN = "de1ab17005ca54e662d4c86543f523cd"; // <-- il tuo token Storefront
  const CHECKOUT_KEY = "cd_checkout_id_v1";

  function toStorefrontVariantId(id) {
    const s = String(id || "").trim();
    if (!s) return "";

    // già gid
    if (s.startsWith("gid://shopify/ProductVariant/")) return s;

    // già base64 (tipicamente Z2lkOi8v...)
    if (s.startsWith("Z2lkOi8v")) return s;

    // numero -> gid base64
    return btoa(`gid://shopify/ProductVariant/${s}`);
  }

  function getLang() {
    // prova CD.i18n, poi html lang, poi fallback
    return (window.CD?.i18n?.currentLang)
        || document.documentElement.lang
        || "it";
  }
  
  function t(keyPath) {
    const lang = getLang();
    const all = window.CD?.i18n?.messages || {};
    const dict = all[lang] || all.it || {};
    return keyPath.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), dict);
  }


  function $(id) {
    return document.getElementById(id);
  }

  window.CD = window.CD || {};

  window.CD.shop = {
    client: null,
    checkoutId: null,
    isReady: false,

    async init() {
      if (this.isReady) return;

      if (typeof ShopifyBuy === "undefined" || !ShopifyBuy.buildClient) {
        console.error("❌ [SHOP] ShopifyBuy non disponibile. Hai caricato buy-button-storefront.min.js?");
        return;
      }

      this.client = ShopifyBuy.buildClient({
        domain: SHOP_DOMAIN,
        storefrontAccessToken: STOREFRONT_TOKEN
      });

      // 🧪 DEBUG: verifica quali variant sono visibili allo Storefront
      try {
        const products = await this.client.product.fetchAll(10);
        console.log("🧪 [SHOP] prodotti visibili:", products.length);
        products.forEach(p => {
          console.log(" -", p.title);
          p.variants.forEach(v => console.log("    variant.id =", v.id));
        });
      } catch (e) {
        console.error("❌ [SHOP] fetchAll products FAILED:", e);
      }

      // riprendi checkout precedente
      const saved = localStorage.getItem(CHECKOUT_KEY);
      if (saved) this.checkoutId = saved;

      // crea checkout se manca
      if (!this.checkoutId) {
        const co = await this.client.checkout.create();
        this.checkoutId = co.id;
        localStorage.setItem(CHECKOUT_KEY, this.checkoutId);
      }

      this.isReady = true;
      console.log("✅ [SHOP] Checkout/cart pronto:", this.checkoutId);

      // Render iniziale (così se hai già prodotti salvati li vedi)
      await this.renderDrawer();
    },

    async addVariant(variantId, qty = 1) {
      await this.init();
      if (!this.client || !this.checkoutId) return null;

      const storefrontId = toStorefrontVariantId(variantId);
      if (!storefrontId) {
        console.warn("⚠️ [SHOP] variantId vuoto:", variantId);
        return null;
      }

      console.log("🧾 [SHOP] add-to-cart", JSON.stringify({ variantId, storefrontId, qty }));

      try {
        await this.client.checkout.addLineItems(this.checkoutId, [
          { variantId: storefrontId, quantity: qty }
        ]);
        await this.renderDrawer();
        this.openDrawer();
        return true;
      } catch (err) {
        console.error("❌ [SHOP] addLineItems FAILED (raw):", err);
        try {
          console.error("❌ [SHOP] addLineItems FAILED (json):", JSON.stringify(err, Object.getOwnPropertyNames(err)));
        } catch (_) {}
        if (err && err.errors) console.error("❌ [SHOP] err.errors:", err.errors);
        if (err && err.message) console.error("❌ [SHOP] err.message:", err.message);
        return null;
      }
    },

    async renderDrawer() {
      if (!this.client || !this.checkoutId) return;

      const itemsEl = $("cart-items");
      const totalEl = $("cart-total");
      const checkoutBtn = $("cart-checkout-btn");

      // Se il drawer markup non esiste, non fare nulla
      if (!itemsEl || !totalEl || !checkoutBtn) return;

      const co = await this.client.checkout.fetch(this.checkoutId);

      // link checkout
      checkoutBtn.href = co.webUrl;

      // total (subtotal)
      const amount = co?.subtotalPriceV2?.amount ?? co?.subtotalPrice ?? "0";
      const currency = co?.subtotalPriceV2?.currencyCode ?? "";
      totalEl.textContent = `${amount} ${currency}`.trim();

      const lineItems = co.lineItems || [];
      if (!lineItems.length) {
        itemsEl.innerHTML = `<div style="color:var(--muted)">${t("cart.empty") || "Il carrello è vuoto"}</div>`;
        return;
      }

      const titleEl = document.querySelector(".cart-drawer__title");
      if (titleEl) titleEl.textContent = t("cart.title") || "Carrello";
      
      const totalLabel = document.querySelector(".cart-drawer__total span:first-child");
      if (totalLabel) totalLabel.textContent = t("cart.total") || "Totale";
      
      if (checkoutBtn) checkoutBtn.textContent = t("cart.checkout") || "Checkout";

      itemsEl.innerHTML = lineItems
        .map((li) => {
          const img = li?.variant?.image?.src || "";
          const lang = getLang();
          const variantNumeric = li?.variant?.id
            ? String(li.variant.id).split("/").pop()
            : "";
          
          const localName =
            window.CD?.shop?.nameByVariant?.[variantNumeric]?.[lang];
          
          const title = localName || li?.title || "Item";
          const q = li?.quantity || 1;
          const price = li?.variant?.priceV2?.amount || li?.variant?.price || "";
          const cur = li?.variant?.priceV2?.currencyCode || "";
          return `
            <div class="cart-item">
              ${img ? `<img class="cart-item__img" src="${img}" alt="">` : ""}
              <div class="cart-item__meta">
                <div class="cart-item__title">${title}</div>
                <div class="cart-item__sub">${t("cart.qty") || "Qty"}: ${q} · ${price} ${cur}</div>
              </div>
            </div>
          `;
        })
        .join("");
    },

    openDrawer() {
      const drawer = $("cart-drawer");
      if (!drawer) return;
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
    },

    closeDrawer() {
      const drawer = $("cart-drawer");
      if (!drawer) return;
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
    }
  };

  // ─────────────────────────────────────────────
  // CART BUTTON: open/close drawer (navbar + drawer)
  // ─────────────────────────────────────────────
  function initCartOpenButton() {
    const openBtn = $("cart-open-btn");
    const closeBtn = $("cart-close-btn");
    const drawer = $("cart-drawer");

    if (!openBtn) {
      console.warn("⚠️ [SHOP] #cart-open-btn non trovato (navbar)");
      return;
    }

    openBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await window.CD.shop.init();
      window.CD.shop.openDrawer();
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.CD.shop.closeDrawer();
      });
    }

    if (drawer) {
      drawer.addEventListener("click", (e) => {
        if (e.target === drawer) window.CD.shop.closeDrawer();
      });
    }
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

