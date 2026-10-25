// certificati.js
(function () {

  const CERT_IMG_DIR = "images/certificati";
  const FALLBACK_IMG = "images/giftcard.jpg"; // fallback già presente nel tuo sito

  function ensureGiftcardRegistered(gc) {
    // id unici fra vasi (v*), masterclass (mc*) e carte regalo (gc-*)
    const pid = String(gc.id == null ? "" : gc.id).trim();
    if (!pid || !CD.util.isValidId(pid)) {
      console.error("[GIFTCARDS] id mancante o non valido, riga saltata:", JSON.stringify(gc.id));
      return null;
    }

    const titles = {
      it: pickLangField(gc, "name", "it", "it"),
      en: pickLangField(gc, "name", "en", "it"),
      ru: pickLangField(gc, "name", "ru", "it"),
    };

    // Registro (forma unica): carta regalo = prodotto digitale, no spedizione
    const sold = CD.util.isSoldFlag(gc.venduto);
    const priceCents = CD.money.cellToCents(gc, "amount_eur");
    CD.util.warnBadPrice("GIFTCARDS", pid, gc, "amount_eur", priceCents, sold);
    return CD.util.registerProduct("certificati", {
      id: pid,
      type: "digital",
      sold,
      titles,
      priceCents,
      currency: "EUR",
      img: safeImg(gc.img1),
      maxQty: 10
    });
  }

  // Lancia in caso di errore (nessun fallback silenzioso a lista vuota)
  async function loadRows() {
    const data = await CD.util.loadOdsRows("catalogue/certificati.ods", ["amount_eur"]);
    console.log("Dati caricati da certificati.ods:", data.length, "righe");
    return data;
  }

  function safeImg(src) {
    // torna sempre una stringa sensata
    const fn = String(src == null ? "" : src).trim();
    if (!fn || fn === "-") return FALLBACK_IMG;
    return `${CERT_IMG_DIR}/${encodeURIComponent(fn)}`;
  }

  const pickLangField = (obj, base, lang, fallback) => CD.util.pickLangField(obj, base, lang, fallback);

  // Ritorna il numero di carte registrate, o false se non si puo' rendere.
  function render(items, lang) {
    const grid = document.getElementById("certificati-grid");
    const modalRoot = document.getElementById("certificati-modal-container");
    if (!grid) {
      console.warn("certificati-grid non trovato nel DOM");
      return false;
    }

    const allMessages = window.CD && CD.i18n && CD.i18n.messages ? CD.i18n.messages : null;
    const msgs = allMessages ? (allMessages[lang] || allMessages.it) : null;

    // etichette
    const buyLabel     = msgs?.giftcards?.buy     || "Buy";
    const detailsLabel = msgs?.giftcards?.details || "Details";
    const modalTitle   = msgs?.giftcards?.modalTitle || "Gift Card";
    const ctaMailLabel = msgs?.giftcards?.cta || "Write me";

    const esc = CD.util.escapeHtml;
    const tr = (key, fallback) => (window.CD?.i18n?.t?.(key, lang)) || fallback;

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    // regola unica: si svuotano i prodotti di questa sorgente prima di ri-registrare
    CD.util.clearProducts("certificati");
    let registered = 0;

    (Array.isArray(items) ? items : []).forEach(gc => {
      const p = ensureGiftcardRegistered(gc);
      if (!p) return;
      const productId = p.id;
      registered++;

      const name = pickLangField(gc, "name", lang, "it");
      const shortText = pickLangField(gc, "short", lang, "it");
      const longText  = pickLangField(gc, "long", lang, "it");

      const img = safeImg(gc.img1);
      // importo: da centesimi validi (CD.money.format), altrimenti il testo della cella
      const amountText = String(gc.amount_eur == null ? "" : gc.amount_eur).trim();
      const amount = p.priceCents
        ? CD.money.format(p.priceCents, lang)
        : (amountText && amountText !== "-" ? amountText : "");
      const canBuy = !!(window.CD?.shop?.addProduct && !p.sold && p.priceCents > 0);
      const pidAttr = esc(productId);

      const subject = `${modalTitle} ${amount}`.trim();
      const body = `${name}${amount ? " — " + amount : ""}`.trim();
      const mailtoHref = esc(
        `mailto:ceramist.doronina@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      );

      // CARD
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="media media-single" data-modal-target="gc-modal-${pidAttr}">
          <img src="${esc(img)}" alt="${esc(name)}" loading="lazy" decoding="async"
               onerror="this.onerror=null;this.src='images/giftcard.jpg';">
        </div>
        <div class="body">
          <h4>${esc(name)}</h4>
          <p>${esc(shortText)}</p>
          ${amount ? `<div class="card-price"><span class="price-current">${esc(amount)}</span></div>` : ""}
          <div class="card-actions">
            ${
              canBuy
                ? `<button class="card-btn primary" type="button" data-add-to-cart="${pidAttr}">${esc(buyLabel)}</button>`
                : `<a class="card-btn primary" href="${mailtoHref}" data-i18n="giftcards.buy">${esc(buyLabel)}</a>`
            }
            <button class="card-btn secondary" data-modal-target="gc-modal-${pidAttr}" data-i18n="giftcards.details">${esc(detailsLabel)}</button>
          </div>
        </div>
      `;
      grid.appendChild(card);

      // MODAL
      if (!modalRoot) return;

      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = `gc-modal-${productId}`;
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
                ${amount ? `<div class="vase-price-row"><span class="vase-price">${esc(amount)}</span></div>` : ""}
                <div class="vase-actions">
                   ${
                     canBuy
                       ? `<button type="button" class="vase-btn-primary" data-add-to-cart="${pidAttr}">${esc(buyLabel)}</button>`
                       : `<a class="vase-btn-primary" href="${mailtoHref}" data-i18n="giftcards.buy">${esc(buyLabel)}</a>`
                   }
                </div>
                <div class="accordion-panel active">
                  <p>${esc(longText)}</p>
                </div>
              </div>

              <div class="modal-gallery">
                <div class="modal-gallery-main">
                  <img data-src="${esc(img)}" alt="${esc(name)}" class="active" decoding="async"
                       onerror="this.onerror=null;this.src='images/giftcard.jpg';">
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      modalRoot.appendChild(modal);
    });
    CD.util.bindAddToCart("[data-add-to-cart]");
    return registered;
  }

  window.CD = window.CD || {};
  window.CD.certificati = {
    loadRows,
    render
  };

})();
