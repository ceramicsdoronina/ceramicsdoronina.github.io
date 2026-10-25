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

    window.CD = window.CD || {};
    window.CD.shop = window.CD.shop || {};
    window.CD.shop.products = window.CD.shop.products || {};

    const titles = {
      it: pickLangField(gc, "name", "it", "it"),
      en: pickLangField(gc, "name", "en", "it"),
      ru: pickLangField(gc, "name", "ru", "it"),
    };

    // Registro (forma unica): carta regalo = prodotto digitale, no spedizione
    window.CD.shop.products[pid] = {
      id: pid,
      type: "digital",
      sold: CD.util.isSoldFlag(gc.venduto),
      titles,
      priceCents: CD.money.cellToCents(gc, "amount_eur"),
      currency: "EUR",
      img: safeImg(gc.img1),
      maxQty: 10
    };

    return pid;
  }

  // Lancia in caso di errore (nessun fallback silenzioso a lista vuota)
  async function loadCsv() {
    const data = await CD.util.loadOdsRows("catalogue/certificati.ods", ["amount_eur"]);
    console.log("Dati caricati da certificati.ods:", data.length, "righe");
    return data;
  }

  // Event delegation: funziona anche per elementi creati dinamicamente,
  // e non crea listener duplicati ad ogni render.
  function initModalsOnce() {
    if (window.__cd_cert_modals_inited) return;
    window.__cd_cert_modals_inited = true;

    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-modal-target]");
      if (target) {
        const id = target.dataset.modalTarget;
        const m = document.getElementById(id);
        if (m) m.classList.add("open");
        return;
      }

      const close = e.target.closest("[data-modal-close]");
      if (close) {
        close.closest(".modal")?.classList.remove("open");
        return;
      }

      if (e.target.classList && e.target.classList.contains("modal")) {
        e.target.classList.remove("open");
      }
    });
  }

  function safeImg(src) {
    // torna sempre una stringa sensata
    const fn = String(src == null ? "" : src).trim();
    if (!fn || fn === "-") return FALLBACK_IMG;
    return `${CERT_IMG_DIR}/${encodeURIComponent(fn)}`;
  }

  function pickLangField(obj, base, lang, fallbackBase = "it") {
    const v1 = obj[`${base}_${lang}`];
    if (v1 && v1 !== "-") return v1;
    const v2 = obj[`${base}_${fallbackBase}`];
    if (v2 && v2 !== "-") return v2;
    // ultimo fallback: prova en/ru
    return obj[`${base}_en`] || obj[`${base}_ru`] || "";
  }

  function render(items, lang) {
    initModalsOnce();

    const grid = document.getElementById("certificati-grid");
    const modalRoot = document.getElementById("certificati-modal-container");
    if (!grid) {
      console.warn("certificati-grid non trovato nel DOM");
      return;
    }

    const allMessages = window.CD && CD.i18n && CD.i18n.messages ? CD.i18n.messages : null;
    const msgs = allMessages ? (allMessages[lang] || allMessages.it) : null;

    // etichette
    const buyLabel     = msgs?.giftcards?.buy     || "Buy";
    const detailsLabel = msgs?.giftcards?.details || "Details";
    const modalTitle   = msgs?.giftcards?.modalTitle || "Gift Card";
    const ctaMailLabel = msgs?.giftcards?.cta || "Write me";

    const esc = CD.util.escapeHtml;

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    (Array.isArray(items) ? items : []).forEach(gc => {
      const productId = ensureGiftcardRegistered(gc);
      if (!productId) return;

      const name = pickLangField(gc, "name", lang, "it");
      const shortText = pickLangField(gc, "short", lang, "it");
      const longText  = pickLangField(gc, "long", lang, "it");

      const img = safeImg(gc.img1);
      const amount = gc.amount_eur && gc.amount_eur !== "-" ? `${gc.amount_eur}€` : "";
      const p = window.CD.shop.products[productId];
      const canBuy = !!(window.CD?.shop?.addProduct && p && !p.sold && p.priceCents > 0);
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
                ? `<button class="card-btn primary" type="button" data-add-giftcard="${pidAttr}">${esc(buyLabel)}</button>`
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
            <button type="button" data-modal-close>×</button>
          </div>
          <div class="modal-body">
            <div class="modal-body-inner">
              <div class="vase-detail-panel">
                <h3 class="vase-subtitle">${esc(shortText)}</h3>
                ${amount ? `<div class="vase-price-row"><span class="vase-price">${esc(amount)}</span></div>` : ""}
                <div class="vase-actions">
                   ${
                     canBuy
                       ? `<button type="button" class="vase-btn-primary" data-add-giftcard="${pidAttr}">${esc(buyLabel)}</button>`
                       : `<a class="vase-btn-primary" href="${mailtoHref}" data-i18n="giftcards.buy">${esc(buyLabel)}</a>`
                   }
                </div>
                <div class="accordion-panel active">
                  <p>${esc(longText)}</p>
                </div>
              </div>

              <div class="modal-gallery">
                <div class="modal-gallery-main">
                  <img src="${esc(img)}" alt="${esc(name)}" class="active" loading="lazy" decoding="async"
                       onerror="this.onerror=null;this.src='images/giftcard.jpg';">
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      modalRoot.appendChild(modal);
    });
    initBuyGiftcardOnce();
  }

  function initBuyGiftcardOnce() {
    if (window.__cd_giftcard_buy_inited) return;
    window.__cd_giftcard_buy_inited = true;

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-add-giftcard]");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const pid = String(btn.dataset.addGiftcard || "").trim();
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
          console.warn("[GIFTCARDS] Non aggiunto:", pid);
          notifyFail();
        }
      } catch (err) {
        console.error("[GIFTCARDS] Errore add-to-cart", err);
        notifyFail();
      }
    }, false);
  }

  window.CD = window.CD || {};
  window.CD.certificati = {
    loadCsv,
    render
  };

})();
