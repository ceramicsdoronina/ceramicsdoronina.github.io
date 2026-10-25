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

  const pickLangField = (obj, base, lang, fallback) => CD.util.pickLangField(obj, base, lang, fallback);

  function ensureShopProductRegistered(mc) {
    // gli id dei prodotti sono unici fra vasi (v*), masterclass (mc*) e carte regalo (gc-*)
    const pid = String(mc.id == null ? "" : mc.id).trim();
    if (!pid || !CD.util.isValidId(pid)) {
      console.error("[MASTERCLASS] id mancante o non valido, riga saltata:", JSON.stringify(mc.id));
      return null;
    }

    const titles = {
      it: pickLangField(mc, "name", "it", "it"),
      en: pickLangField(mc, "name", "en", "it"),
      ru: pickLangField(mc, "name", "ru", "it"),
    };

    // Registro (forma unica): masterclass = servizio digitale, quantita' max = posti
    const sold = CD.util.isSoldFlag(mc.venduto);
    const priceCents = CD.money.cellToCents(mc, "price");
    CD.util.warnBadPrice("MASTERCLASS", pid, mc, "price", priceCents, sold);
    return CD.util.registerProduct("masterclass", {
      id: pid,
      type: "digital",
      sold,
      titles,
      priceCents,
      currency: "EUR",
      img: imgUrl(mc),
      maxQty: seatsOf(mc)
    });
  }

  // ─────────────────────────────────────────────
  // Carica ODS
  // ─────────────────────────────────────────────
  // Lancia in caso di errore (nessun fallback silenzioso a lista vuota)
  async function loadRows() {
    const data = await CD.util.loadOdsRows("catalogue/masterclass.ods", ["price"]);
    console.log("Dati caricati da masterclass.ods:", data.length, "righe");
    return data;
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  // Ritorna il numero di masterclass mostrate (0 = nessuna data in programma), o false se non
  // si puo' rendere.
  function render(items, lang) {
    const grid = document.getElementById("masterclass-grid");
    const modalRoot = document.getElementById("masterclass-modal-container");
    if (!grid) {
      console.warn("masterclass-grid non trovato nel DOM");
      return false;
    }

    const allMessages = window.CD && CD.i18n && CD.i18n.messages ? CD.i18n.messages : null;
    const msgs = allMessages ? (allMessages[lang] || allMessages.it) : null;

    const buyLabel = msgs?.catalogue?.addToCart || "Compra";      // riuso etichetta già tradotta
    const detailsLabel = msgs?.workshops?.details || "Dettagli";
    const ctaMailLabel = msgs?.workshops?.cta || "Scrivimi";

    const esc = CD.util.escapeHtml;
    const fmt = (cents) => CD.money.format(cents, lang);
    const tr = (key, fallback) => (window.CD?.i18n?.t?.(key, lang)) || fallback;

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    // regola unica: si svuotano i prodotti di questa sorgente (eventi nel frattempo scaduti)
    CD.util.clearProducts("masterclass");
    let shown = 0;

    (Array.isArray(items) ? items : []).forEach(mc => {
      // eventi con data gia' passata (fuso Europe/Rome, fino a fine giornata): non mostrati ne' acquistabili
      if (CD.util.isPastEvent(mc.date)) return;

      const p = ensureShopProductRegistered(mc);
      if (!p) return;
      const productId = p.id;
      shown++;

      const name = pickLangField(mc, "name", lang, "it");
      const shortText = pickLangField(mc, "short", lang, "it");
      const longText  = pickLangField(mc, "long", lang, "it");

      const img = imgUrl(mc);

      const date = mc.date || "";
      const time = mc.time || "";
      const level = mc.level || "";
      const spots = mc.spots || "";
      // prezzo mostrato: da centesimi validi, altrimenti il testo della cella
      const priceText = String(mc.price == null ? "" : mc.price).trim();
      const price = p.priceCents ? fmt(p.priceCents) : (priceText && priceText !== "-" ? priceText : "");

      let metaHtml = "";
      if (date || time) metaHtml += `<p><strong>${esc(date)}</strong>${time ? " · " + esc(time) : ""}</p>`;
      if (level) metaHtml += `<p>${esc(level)}</p>`;
      if (spots) metaHtml += `<p>${esc(spots)}</p>`;
      if (price) metaHtml += `<p><strong>${esc(price)}</strong></p>`;

      const canBuy = !!(window.CD?.shop?.addProduct && !p.sold && p.priceCents > 0);
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
                ? `<button class="card-btn primary" type="button" data-add-to-cart="${pidAttr}">${esc(buyLabel)}</button>`
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
            <button type="button" data-modal-close data-i18n-aria-label="modal.close" aria-label="${esc(tr("modal.close", "Close"))}">×</button>
          </div>
          <div class="modal-body">
            <div class="modal-body-inner">
              <div class="vase-detail-panel">
                <h3 class="vase-subtitle">${esc(shortText)}</h3>
                ${metaHtml}
                <div class="vase-actions">
                  ${
                    canBuy
                      ? `<button type="button" class="vase-btn-primary" data-add-to-cart="${pidAttr}">${esc(buyLabel)}</button>`
                      : `<a class="vase-btn-primary" href="${mailtoHref}" data-i18n="workshops.cta">${esc(ctaMailLabel)}</a>`
                  }
                </div>
                <div class="accordion-panel active">
                  <p>${esc(longText)}</p>
                </div>
              </div>

              <div class="modal-gallery">
                <div class="modal-gallery-main">
                  <img data-src="${esc(img)}" alt="${esc(name)}" class="active" decoding="async">
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      modalRoot.appendChild(modal);
    });

    // nessuna data in programma: nota tradotta (il mailto "Scrivimi" della sezione resta raggiungibile)
    // e lead "scegli una data" nascosto
    const lead = document.getElementById("masterclass-lead");
    if (lead) lead.hidden = shown === 0;
    if (shown === 0) {
      grid.innerHTML = `<p class="catalogue-empty" role="status" data-i18n="workshops.noEvents">${esc(tr("workshops.noEvents", "No dates scheduled right now, write to me to arrange one."))}</p>`;
    }

    // Click “Compra” → aggiungi al carrello Stripe (delegato unico)
    CD.util.bindAddToCart("[data-add-to-cart]");
    return shown;
  }

  // Export
  window.CD = window.CD || {};
  window.CD.masterclass = {
    loadRows,
    render
  };
})();
