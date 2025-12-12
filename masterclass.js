// masterclass.js
(function () {

  // Carica il CSV delle masterclass
  async function loadCsv() {
    // se preferisci un’altra cartella, cambia il path qui
    const res = await fetch("catalogue/masterclass.csv", { cache: "no-store" });
    if (!res.ok) {
      console.error("Impossibile caricare masterclass.csv");
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

  // Rende le card e i popup delle masterclass
  function render(items, lang) {
    const grid = document.getElementById("masterclass-grid");
    const modalRoot = document.getElementById("masterclass-modal-container");
    if (!grid) {
      console.warn("masterclass-grid non trovato nel DOM");
      return;
    }

    const allMessages = window.CD && CD.i18n && CD.i18n.messages ? CD.i18n.messages : null;
    const msgs = allMessages ? (allMessages[lang] || allMessages.it) : null;
    const ctaLabel = msgs && msgs.workshops && msgs.workshops.cta
      ? msgs.workshops.cta
      : "Write to join";
    const detailsLabel = msgs && msgs.workshops && msgs.workshops.details
      ? msgs.workshops.details
      : "Details";

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    items.forEach(mc => {
      const name =
        (mc[`name_${lang}`] && mc[`name_${lang}`] !== "-" ? mc[`name_${lang}`] : null) ||
        mc.name_en || mc.name_it || mc.name_ru || "";

      const shortText =
        (mc[`short_${lang}`] && mc[`short_${lang}`] !== "-" ? mc[`short_${lang}`] : null) ||
        mc.short_en || mc.short_it || mc.short_ru || "";

      const longText =
        (mc[`long_${lang}`] && mc[`long_${lang}`] !== "-" ? mc[`long_${lang}`] : null) ||
        mc.long_en || mc.long_it || mc.long_ru || "";

      const img = mc.img1 && mc.img1 !== "-" ? `images/masterclass/${mc.img1}` : "images/placeholder.jpg";

      const date = mc.date || "";
      const time = mc.time || "";
      const level = mc.level || "";
      const spots = mc.spots || "";
      const price = mc.price || "";

      let metaHtml = "";
      if (date || time) {
        metaHtml += `<p><strong>${date}</strong>${time ? " · " + time : ""}</p>`;
      }
      if (level) metaHtml += `<p>${level}</p>`;
      if (spots) metaHtml += `<p>${spots}</p>`;
      if (price) metaHtml += `<p><strong>${price}</strong></p>`;

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
            <a
              class="card-btn primary"
              href="${mailtoHref}"
              data-i18n="workshops.cta"
            >
              ${ctaLabel}
            </a>
            <button
              class="card-btn secondary"
              data-modal-target="mc-modal-${mc.id}"
              data-i18n="workshops.details"
            >
              ${detailsLabel}
            </button>
          </div>
        </div>
      `;

      grid.appendChild(card);

      // POPUP
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
                   <a
                     class="vase-btn-primary"
                     href="mailto:ceramist.doronina@gmail.com?subject=Masterclass: ${encodeURIComponent(name)}"
                     data-i18n="workshops.cta"
                   >
                     Scrivimi per iscriverti
                   </a>
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
    initModals();
  }

  function initModals() {
    document.querySelectorAll("[data-modal-target]").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.modalTarget;
        const m = document.getElementById(id);
        if (m) m.classList.add("open");
      });
    });

    document.querySelectorAll("[data-modal-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.closest(".modal")?.classList.remove("open");
      });
    });

    document.addEventListener("click", e => {
      if (e.target.classList?.contains("modal")) {
        e.target.classList.remove("open");
      }
    });
  }

  // esponiamo nel namespace globale
  window.CD = window.CD || {};
  window.CD.masterclass = {
    loadCsv,
    render
  };
})();

