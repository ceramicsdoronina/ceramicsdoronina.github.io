// masterclass.js
(function () {

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  const IMG_DIR = "images/masterclass";
  const PLACEHOLDER_IMG = "images/placeholder.svg";
  const DEFAULT_SEATS = 6;

  function imgUrl(mc) {
    const fn = String(mc.img1 == null ? "" : mc.img1).trim();
    return fn && fn !== "-" ? `${IMG_DIR}/${encodeURIComponent(fn)}` : PLACEHOLDER_IMG;
  }

  // Posti massimi: primo numero in "spots" (es. "Max 6 persone"), altrimenti 6
  function seatsOf(mc) {
    const m = String(mc.spots || "").match(/\d+/);
    const n = m ? parseInt(m[0], 10) : DEFAULT_SEATS;
    return n > 0 ? n : DEFAULT_SEATS;
  }

  let registeredIds = [];

  function pickLangField(obj, base, lang, fallback = "it") {
    const v1 = obj[`${base}_${lang}`];
    if (v1 && v1 !== "-") return v1;
    const v2 = obj[`${base}_${fallback}`];
    if (v2 && v2 !== "-") return v2;
    return obj[`${base}_en`] || obj[`${base}_ru`] || "";
  }

  function ensureShopProductRegistered(mc) {
    // gli id dei prodotti sono unici fra vasi (v*), masterclass (mc*) e carte regalo (gc-*)
    const pid = String(mc.id == null ? "" : mc.id).trim();
    if (!pid || !CD.util.isValidId(pid)) {
      console.error("[MASTERCLASS] id mancante o non valido, riga saltata:", JSON.stringify(mc.id));
      return null;
    }

    window.CD = window.CD || {};
    window.CD.shop = window.CD.shop || {};
    window.CD.shop.products = window.CD.shop.products || {};

    const titles = {
      it: pickLangField(mc, "name", "it", "it"),
      en: pickLangField(mc, "name", "en", "it"),
      ru: pickLangField(mc, "name", "ru", "it"),
    };

    // Registro (forma unica): masterclass = servizio digitale, quantita' max = posti
    window.CD.shop.products[pid] = {
      id: pid,
      type: "digital",
      sold: CD.util.isSoldFlag(mc.venduto),
      titles,
      priceCents: CD.money.cellToCents(mc, "price"),
      currency: "EUR",
      img: imgUrl(mc),
      maxQty: seatsOf(mc)
    };

    return pid;
  }

  // ─────────────────────────────────────────────
  // Carica ODS
  // ─────────────────────────────────────────────
  // Lancia in caso di errore (nessun fallback silenzioso a lista vuota)
  async function loadCsv() {
    const data = await CD.util.loadOdsRows("catalogue/masterclass.ods", ["price"]);
    console.log("Dati caricati da masterclass.ods:", data.length, "righe");
    return data;
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

    const esc = CD.util.escapeHtml;

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    // ripulisce i prodotti registrati al render precedente (eventi nel frattempo scaduti)
    registeredIds.forEach(id => { if (window.CD?.shop?.products) delete window.CD.shop.products[id]; });
    registeredIds = [];

    (Array.isArray(items) ? items : []).forEach(mc => {
      // eventi con data (dd.mm.yyyy) gia' passata: non mostrati ne' acquistabili
      if (CD.util.isPastEvent(mc.date)) return;

      const productId = ensureShopProductRegistered(mc);
      if (!productId) return;
      registeredIds.push(productId);

      const name = pickLangField(mc, "name", lang, "it");
      const shortText = pickLangField(mc, "short", lang, "it");
      const longText  = pickLangField(mc, "long", lang, "it");

      const img = imgUrl(mc);

      const date = mc.date || "";
      const time = mc.time || "";
      const level = mc.level || "";
      const spots = mc.spots || "";
      const price = mc.price || "";

      let metaHtml = "";
      if (date || time) metaHtml += `<p><strong>${esc(date)}</strong>${time ? " · " + esc(time) : ""}</p>`;
      if (level) metaHtml += `<p>${esc(level)}</p>`;
      if (spots) metaHtml += `<p>${esc(spots)}</p>`;
      if (price) metaHtml += `<p><strong>${esc(price)}</strong></p>`;

      const p = window.CD.shop.products[productId];
      const canBuy = !!(window.CD?.shop?.addProduct && p && !p.sold && p.priceCents > 0);
      const pidAttr = esc(productId);

      // CARD
      const card = document.createElement("article");
      card.className = "card";

      const mailtoHref = esc(
        `mailto:ceramist.doronina@gmail.com?subject=${encodeURIComponent("Masterclass: " + name)}`
      );

      card.innerHTML = `
        <div class="media media-single" data-modal-target="mc-modal-${pidAttr}">
          <img src="${esc(img)}" alt="${esc(name)}" loading="lazy" decoding="async">
        </div>
        <div class="body">
          <h4>${esc(name)}</h4>
          <p>${esc(shortText)}</p>
          ${metaHtml}
          <div class="card-actions">
            ${
              canBuy
                ? `<button class="card-btn primary" type="button" data-add-masterclass="${pidAttr}">${esc(buyLabel)}</button>`
                : `<a class="card-btn primary" href="${mailtoHref}" data-i18n="workshops.cta">${esc(ctaMailLabel)}</a>`
            }
            <button class="card-btn secondary" data-modal-target="mc-modal-${pidAttr}" data-i18n="workshops.details">
              ${esc(detailsLabel)}
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);

      // MODAL
      if (!modalRoot) return;

      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = `mc-modal-${productId}`;

      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h2 class="vase-title">${esc(name)}</h2>
            <button type="button" data-modal-close>×</button>
          </div>
          <div class="modal-body">
            <div class="modal-body-inner">
              <div class="vase-detail-panel">
                <h3 class="vase-subtitle">${esc(shortText)}</h3>
                ${metaHtml}
                <div class="vase-actions">
                  ${
                    canBuy
                      ? `<button type="button" class="vase-btn-primary" data-add-masterclass="${pidAttr}">${esc(buyLabel)}</button>`
                      : `<a class="vase-btn-primary" href="${mailtoHref}" data-i18n="workshops.cta">${esc(ctaMailLabel)}</a>`
                  }
                </div>
                <div class="accordion-panel active">
                  <p>${esc(longText)}</p>
                </div>
              </div>

              <div class="modal-gallery">
                <div class="modal-gallery-main">
                  <img src="${esc(img)}" alt="${esc(name)}" loading="lazy" decoding="async">
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

      const notifyFail = () => {
        const msg = window.CD?.i18n?.t?.("cart.addFailed") || "Could not add the item to your cart. Please try again.";
        if (window.CD?.shop?.showNotice) window.CD.shop.showNotice(msg);
        else window.alert(msg);
      };

      // si controlla l'API effettivamente usata: addProduct
      if (!window.CD?.shop?.addProduct) {
        console.warn("CD.shop.addProduct non disponibile");
        notifyFail();
        return;
      }

      try {
        const ok = await window.CD.shop.addProduct(pid, 1);
        if (!ok) {
          console.warn("[MASTERCLASS] Non aggiunto:", pid);
          notifyFail();
        }
      } catch (err) {
        console.error("[MASTERCLASS] Errore add-to-cart", err);
        notifyFail();
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
