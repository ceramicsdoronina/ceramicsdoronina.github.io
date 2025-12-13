// certificati.js
(function () {

  const CERT_IMG_DIR = "images/certificati";
  const FALLBACK_IMG = "images/giftcard.jpg"; // fallback già presente nel tuo sito

  async function loadCsv() {
    const res = await fetch("catalogue/certificati.csv", { cache: "no-store" });
    if (!res.ok) {
      console.error("Impossibile caricare catalogue/certificati.csv");
      return [];
    }

    const text = await res.text();
    const rows = text.trim().split(/\r?\n/).filter(r => r.trim().length > 0);
    if (rows.length < 2) return [];

    const firstLine = rows[0];
    const delimiter = (firstLine.includes(";") && !firstLine.includes(",")) ? ";" : ",";
    const header = firstLine.split(delimiter).map(h => h.trim());

    return rows.slice(1).map(line => {
      const cols = line.split(delimiter).map(c => c.trim());
      const obj = {};
      header.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
      return obj;
    });
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

      if (e.target.matches("[data-modal-close]")) {
        e.target.closest(".modal")?.classList.remove("open");
        return;
      }

      if (e.target.classList && e.target.classList.contains("modal")) {
        e.target.classList.remove("open");
      }
    });
  }

  function safeImg(src) {
    // torna sempre una stringa sensata
    if (!src || src === "-") return FALLBACK_IMG;
    // se nel CSV hai già "giftcard-50.jpg" ecc.
    return `${CERT_IMG_DIR}/${src}`;
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

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    items.forEach(gc => {
      const name = pickLangField(gc, "name", lang, "it");
      const shortText = pickLangField(gc, "short", lang, "it");
      const longText  = pickLangField(gc, "long", lang, "it");

      const img = safeImg(gc.img1);
      const amount = gc.amount_eur && gc.amount_eur !== "-" ? `${gc.amount_eur}€` : "";

      const subject = `${modalTitle} ${amount}`.trim();
      const body = `${name}${amount ? " — " + amount : ""}`.trim();
      const mailtoHref =
        `mailto:ceramist.doronina@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // CARD
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="media media-single" data-modal-target="gc-modal-${gc.id}">
          <img src="${img}" alt="${name}"
               onerror="this.onerror=null;this.src='images/giftcard.jpg';">
        </div>
        <div class="body">
          <h4>${name}</h4>
          <p>${shortText}</p>
          ${amount ? `<div class="card-price"><span class="price-current">${amount}</span></div>` : ""}
          <div class="card-actions">
            <a class="card-btn primary" href="${mailtoHref}" data-i18n="giftcards.buy">${buyLabel}</a>
            <button class="card-btn secondary" data-modal-target="gc-modal-${gc.id}" data-i18n="giftcards.details">${detailsLabel}</button>
          </div>
        </div>
      `;
      grid.appendChild(card);

      // MODAL
      if (!modalRoot) return;

      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = `gc-modal-${gc.id}`;
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
                ${amount ? `<div class="vase-price-row"><span class="vase-price">${amount}</span></div>` : ""}
                <div class="vase-actions">
                  <a class="vase-btn-primary" href="${mailtoHref}" data-i18n="giftcards.buy">${buyLabel}</a>
                </div>
                <div class="accordion-panel active">
                  <p>${longText}</p>
                </div>
              </div>

              <div class="modal-gallery">
                <div class="modal-gallery-main">
                  <img src="${img}" alt="${name}" class="active"
                       onerror="this.onerror=null;this.src='images/giftcard.jpg';">
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      modalRoot.appendChild(modal);
    });
  }

  window.CD = window.CD || {};
  window.CD.certificati = {
    loadCsv,
    render
  };

})();

