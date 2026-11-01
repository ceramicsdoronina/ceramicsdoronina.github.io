// masterclass.js
(function () {

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  const IMG_DIR = "images/masterclass";
  const PLACEHOLDER_IMG = "images/placeholder.svg";

  function imgUrl(mc) {
    const fn = String(mc.img1 == null ? "" : mc.img1).trim();
    return fn && fn !== "-" ? `${IMG_DIR}/${encodeURIComponent(fn)}` : PLACEHOLDER_IMG;
  }

  // Persone scelte per id (sopravvivono ai re-render: cambio lingua, dati live arrivati dopo)
  const selectedPersons = {};

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

    // Registro (forma unica): masterclass = servizio digitale prenotato per PERSONE; i prezzi sono
    // a gruppo (tiersCents, 1..20 persone), maxQty = max persone prenotabili.
    const b = CD.util.bookingFromRow(mc);
    const sold = CD.util.isSoldFlag(mc.venduto) || b.sold;
    if (!b.priceCents && !CD.util.isSoldFlag(mc.venduto)) {
      console.error("[MASTERCLASS] nessun prezzo valido", pid, JSON.stringify(mc.price_1 != null ? mc.price_1 : mc.price));
    }
    return CD.util.registerProduct("masterclass", {
      id: pid,
      type: "digital",
      sold,
      titles,
      priceCents: b.priceCents,
      tiersCents: b.tiersCents,
      seatsFree: b.seatsFree,
      seatsTotal: b.seatsTotal,
      legacy: b.legacy,
      currency: "EUR",
      img: imgUrl(mc),
      maxQty: b.maxQty
    });
  }

  // Selettore persone + totale/prezzo a persona (testo grezzo: chi lo inserisce nell'HTML usa esc()).
  function totalText(p, n, lang) {
    const tr = (key) => (window.CD?.i18n?.t?.(key, lang)) || "";
    const fmt = (cents) => CD.money.format(cents, lang);
    const total = CD.cart.tierCents(p, n);
    if (total === null) return "";
    if (n === 1) return CD.util.fillTemplate(tr("masterclass.total"), { total: fmt(total) });
    // a persona arrotondato al centesimo (il totale e' quello che si paga)
    return CD.util.fillTemplate(tr("masterclass.totalPer"), { total: fmt(total), per: fmt(Math.round(total / n)) });
  }

  function initialPersons(p) {
    const offered = CD.cart.offeredPersons(p);
    if (!offered.length) return 0;
    return offered.includes(selectedPersons[p.id]) ? selectedPersons[p.id] : offered[0];
  }

  function bookingHtml(p, lang, esc) {
    const tr = (key) => (window.CD?.i18n?.t?.(key, lang)) || "";
    const offered = CD.cart.offeredPersons(p);
    if (p.sold || !offered.length) return "";
    const n = initialPersons(p);
    const pid = esc(p.id);
    const options = offered.map((k) =>
      `<option value="${k}"${k === n ? " selected" : ""}>${esc(CD.util.personsLabel(k, lang, (key, l) => window.CD.i18n.t(key, l)))}</option>`
    ).join("");
    return `<div class="mc-booking">
      <label class="mc-persons">${esc(tr("masterclass.persons"))}
        <select data-persons="${pid}" aria-label="${esc(tr("masterclass.persons"))}">${options}</select>
      </label>
      <p class="mc-price" data-persons-total="${pid}" aria-live="polite"><strong>${esc(totalText(p, n, lang))}</strong></p>
    </div>`;
  }

  // Posti liberi / "Completo" (solo dove i posti sono tracciati; legacy: il testo "spots" del foglio)
  function seatsHtml(mc, p, lang, esc) {
    const tr = (key) => (window.CD?.i18n?.t?.(key, lang)) || "";
    if (p.legacy) {
      const spots = String(mc.spots || "").trim();
      return spots ? `<p>${esc(spots)}</p>` : "";
    }
    if (p.seatsFree === null) return `<p class="mc-seats">${esc(tr("masterclass.seatsAvailable"))}</p>`;   // posti illimitati: nessun numero
    if (p.seatsFree === 0 || CD.util.isSoldOverride(p.id)) return `<p class="mc-seats mc-seats--full"><strong>${esc(tr("masterclass.soldOut"))}</strong></p>`;
    const key = p.seatsFree === 1 ? "masterclass.seatsFreeOne" : "masterclass.seatsFree";
    return `<p class="mc-seats">${esc(CD.util.fillTemplate(tr(key), { n: p.seatsFree }))}</p>`;
  }

  // Cambio persone: aggiorna totale e selettori gemelli (scheda e modale) di quell'id
  function onPersonsChange(e) {
    const sel = e.target && e.target.closest ? e.target.closest("select[data-persons]") : null;
    if (!sel) return;
    const id = sel.getAttribute("data-persons");
    const p = window.CD?.shop?.products?.[id];
    const n = parseInt(sel.value, 10);
    if (!p || !CD.cart.offeredPersons(p).includes(n)) return;
    selectedPersons[id] = n;
    const lang = CD.i18n.getCurrentLang();
    document.querySelectorAll("select[data-persons]").forEach((el) => {
      if (el.getAttribute("data-persons") === id) el.value = String(n);
    });
    document.querySelectorAll("[data-persons-total]").forEach((el) => {
      if (el.getAttribute("data-persons-total") === id) el.innerHTML = `<strong>${CD.util.escapeHtml(totalText(p, n, lang))}</strong>`;
    });
  }

  function bindPersonsDelegate(el) {
    if (!el || !el.addEventListener || (el.dataset && el.dataset.personsBound === "1")) return;
    if (el.dataset) el.dataset.personsBound = "1";
    el.addEventListener("change", onPersonsChange);
  }

  // ─────────────────────────────────────────────
  // Carica ODS
  // ─────────────────────────────────────────────
  // Lancia in caso di errore (nessun fallback silenzioso a lista vuota)
  async function loadRows() {
    const data = await CD.util.loadOdsRows("catalogue/masterclass.ods", ["price"].concat(Array.from({ length: 20 }, (_, i) => "price_" + (i + 1))));
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

    const buyLabel = msgs?.masterclass?.book || msgs?.catalogue?.addToCart || "Prenota";
    const detailsLabel = msgs?.workshops?.details || "Dettagli";
    const ctaMailLabel = msgs?.workshops?.cta || "Scrivimi";

    const esc = CD.util.escapeHtml;
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

      let metaHtml = "";
      if (date || time) metaHtml += `<p><strong>${esc(date)}</strong>${time ? " · " + esc(time) : ""}</p>`;
      if (level) metaHtml += `<p>${esc(level)}</p>`;
      metaHtml += seatsHtml(mc, p, lang, esc);
      const bookHtml = bookingHtml(p, lang, esc);

      const canBuy = !!(window.CD?.shop?.addProduct && !p.sold && CD.cart.offeredPersons(p).length);
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
          ${bookHtml}
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
                ${bookHtml}
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

    bindPersonsDelegate(grid);
    bindPersonsDelegate(modalRoot);

    // Click “Compra” → aggiungi al carrello Stripe (delegato unico)
    CD.util.bindAddToCart("[data-add-to-cart]");
    return shown;
  }

  // Export
  window.CD = window.CD || {};
  window.CD.masterclass = {
    loadRows,
    render,
    bookingHtml,
    seatsHtml,
    totalText
  };
})();
