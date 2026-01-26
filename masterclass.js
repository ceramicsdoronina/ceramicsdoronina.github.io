// masterclass.js
(function () {

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  function getLang() {
    return (
      window.CD?.i18n?.lang ||
      window.CD?.i18n?.currentLang ||
      document.documentElement.lang ||
      "it"
    );
  }

  function moneyToCents(priceStr) {
    // Accetta "100€", "100", "100.00", "100,00", "€100"
    const s = String(priceStr || "").trim();
    if (!s || s === "-") return 0;
    const cleaned = s.replace(/\s/g, "").replace("€", "").replace(",", ".");
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
  }

  function pickLangField(obj, base, lang, fallback = "it") {
    const v1 = obj[`${base}_${lang}`];
    if (v1 && v1 !== "-") return v1;
    const v2 = obj[`${base}_${fallback}`];
    if (v2 && v2 !== "-") return v2;
    return obj[`${base}_en`] || obj[`${base}_ru`] || "";
  }

  function ensureShopProductRegistered(mc) {
    // crea un id separato dai vasi
    const pid = `mc:${String(mc.id || "").trim()}`;
    if (!pid || pid === "mc:") return null;

    window.CD = window.CD || {};
    window.CD.shop = window.CD.shop || {};
    window.CD.shop.products = window.CD.shop.products || {};

    // già registrato
    if (window.CD.shop.products[pid]) return pid;

    const titles = {
      it: pickLangField(mc, "name", "it", "it"),
      en: pickLangField(mc, "name", "en", "it"),
      ru: pickLangField(mc, "name", "ru", "it"),
    };

    const img = (mc.img1 && mc.img1 !== "-")
      ? `images/masterclass/${mc.img1}`
      : "images/placeholder.jpg";

    const priceCents = moneyToCents(mc.price);
    const currency = "EUR";

    // Registra come prodotto "non fisico" (utile dopo per shipping)
    window.CD.shop.products[pid] = {
      id: pid,
      type: "digital",          // <-- masterclass = servizio
      titles,
      priceCents,
      currency,
      img
    };

    return pid;
  }

  // ─────────────────────────────────────────────
  // Carica ODS
  // ─────────────────────────────────────────────
  async function loadCsv() {
    try {
      const res = await fetch("catalogue/masterclass.ods", { cache: "no-store" });
      if (!res.ok) {
        console.error("Impossibile caricare masterclass.ods");
        return [];
      }

      const arrayBuffer = await res.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const data = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: ""
      });

      console.log("Dati caricati da masterclass.ods:", data.length, "righe");
      return data;
    } catch (error) {
      console.error("Errore nel caricamento di masterclass.ods:", error);
      return [];
    }
  }

  // ─────────────────────────────────────────────
  // Modals: delegazione eventi (una volta sola)
  // ─────────────────────────────────────────────
  function initModalsOnce() {
    if (window.__cd_masterclass_modals_inited) return;
    window.__cd_masterclass_modals_inited = true;

    document.addEventListener("click", (e) => {
      const trg = e.target.closest("[data-modal-target]");
      if (trg) {
        const id = trg.dataset.modalTarget;
        const m = document.getElementById(id);
        if (m) m.classList.add("open");
        return;
      }

      const close = e.target.closest("[data-modal-close]");
      if (close) {
        close.closest(".modal")?.classList.remove("open");
        return;
      }

      if (e.target.classList?.contains("modal")) {
        e.target.classList.remove("open");
      }
    });
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  function render(items, lang) {
    initModalsOnce();

    const grid = document.getElementById("masterclass-grid");
    const modalRoot = document.getElementById("masterclass-modal-container");
    if (!grid) {
      console.warn("masterclass-grid non trovato nel DOM");
      return;
    }

    const allMessages = window.CD && CD.i18n && CD.i18n.messages ? CD.i18n.messages : null;
    const msgs = allMessages ? (allMessages[lang] || allMessages.it) : null;

    const buyLabel = msgs?.catalogue?.addToCart || "Compra";      // riuso etichetta già tradotta
    const detailsLabel = msgs?.workshops?.details || "Dettagli";
    const ctaMailLabel = msgs?.workshops?.cta || "Scrivimi";

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    items.forEach(mc => {
      const name = pickLangField(mc, "name", lang, "it");
      const shortText = pickLangField(mc, "short", lang, "it");
      const longText  = pickLangField(mc, "long", lang, "it");

      const img = (mc.img1 && mc.img1 !== "-")
        ? `images/masterclass/${mc.img1}`
        : "images/placeholder.jpg";

      const date = mc.date || "";
      const time = mc.time || "";
      const level = mc.level || "";
      const spots = mc.spots || "";
      const price = mc.price || "";

      let metaHtml = "";
      if (date || time) metaHtml += `<p><strong>${date}</strong>${time ? " · " + time : ""}</p>`;
      if (level) metaHtml += `<p>${level}</p>`;
      if (spots) metaHtml += `<p>${spots}</p>`;
      if (price) metaHtml += `<p><strong>${price}</strong></p>`;

      // registra prodotto per Stripe-cart (se c'è CD.shop)
      const productId = ensureShopProductRegistered(mc);
      const canBuy = !!(productId && window.CD?.shop?.addItem);

      // CARD
      const card = document.createElement("article");
      card.className = "card";

      const mailtoHref =
        `mailto:ceramist.doronina@gmail.com?subject=Masterclass: ${encodeURIComponent(name)}`;

      card.innerHTML = `
        <div class="media media-single" data-modal-target="mc-modal-${mc.id}">
          <img src="${img}" alt="${name}">
        </div>
        <div class="body">
          <h4>${name}</h4>
          <p>${shortText}</p>
          ${metaHtml}
          <div class="card-actions">
            ${
              canBuy
                ? `<button class="card-btn primary" type="button" data-add-masterclass="${productId}">${buyLabel}</button>`
                : `<a class="card-btn primary" href="${mailtoHref}" data-i18n="workshops.cta">${ctaMailLabel}</a>`
            }
            <button class="card-btn secondary" data-modal-target="mc-modal-${mc.id}" data-i18n="workshops.details">
              ${detailsLabel}
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);

      // MODAL
      if (!modalRoot) return;

      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = `mc-modal-${mc.id}`;

      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h2 class="vase-title">${name}</h2>
            <button type="button" data-modal-close>×</button>
          </div>
          <div class="modal-body">
            <div class="modal-body-inner">
              <div class="vase-detail-panel">
                <h3 class="vase-subtitle">${shortText}</h3>
                ${metaHtml}
                <div class="vase-actions">
                  ${
                    canBuy
                      ? `<button type="button" class="vase-btn-primary" data-add-masterclass="${productId}">${buyLabel}</button>`
                      : `<a class="vase-btn-primary" href="${mailtoHref}" data-i18n="workshops.cta">${ctaMailLabel}</a>`
                  }
                </div>
                <div class="accordion-panel active">
                  <p>${longText}</p>
                </div>
              </div>

              <div class="modal-gallery">
                <div class="modal-gallery-main">
                  <img src="${img}" alt="${name}">
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      modalRoot.appendChild(modal);
    });

    // Click “Compra” masterclass → aggiungi al carrello Stripe
    initBuyButtonsOnce();
  }

  function initBuyButtonsOnce() {
    if (window.__cd_masterclass_buy_inited) return;
    window.__cd_masterclass_buy_inited = true;

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-add-masterclass]");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const pid = String(btn.dataset.addMasterclass || "").trim();
      if (!pid) return;

      if (!window.CD?.shop?.addVariant) {
        console.warn("CD.shop.addVariant non disponibile");
        return;
      }

      try {
        const p = window.CD.shop.products[pid];
        if (!p) return;
        
        await window.CD.shop.addItem({
          id: pid,
          type: "digital",
          quantity: 1,
          name: p.titles[getLang()] || p.titles.it || pid,
          currency: p.currency,
          unit_amount: p.priceCents,
          image: p.img
        });
      } catch (err) {
        console.error("[MASTERCLASS] Errore add-to-cart", err);
      }
    }, false);
  }

  // Export
  window.CD = window.CD || {};
  window.CD.masterclass = {
    loadCsv,
    render
  };
})();

