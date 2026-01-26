// certificati.js
(function () {

  const CERT_IMG_DIR = "images/certificati";
  const FALLBACK_IMG = "images/giftcard.jpg"; // fallback già presente nel tuo sito

  function getLang() {
    return (
      window.CD?.i18n?.lang ||
      window.CD?.i18n?.currentLang ||
      document.documentElement.lang ||
      "it"
    );
  }

  function moneyToCents(priceStr) {
    const s = String(priceStr || "").trim();
    if (!s || s === "-") return 0;
    const cleaned = s.replace(/\s/g, "").replace("€", "").replace(",", ".");
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
  }
  
  function ensureGiftcardRegistered(gc) {
    // id separato dai vasi e dalle masterclass
    const pid = `gc:${String(gc.id || "").trim()}`;
    if (!pid || pid === "gc:") return null;
  
    window.CD = window.CD || {};
    window.CD.shop = window.CD.shop || {};
    window.CD.shop.products = window.CD.shop.products || {};
  
    if (window.CD.shop.products[pid]) return pid;
  
    const titles = {
      it: pickLangField(gc, "name", "it", "it"),
      en: pickLangField(gc, "name", "en", "it"),
      ru: pickLangField(gc, "name", "ru", "it"),
    };
  
    const img = safeImg(gc.img1);
    const priceCents = moneyToCents(gc.amount_eur);
    const currency = "eur";
  
    window.CD.shop.products[pid] = {
      id: pid,
      type: "digital",     // <-- IMPORTANTISSIMO: no shipping
      titles,
      priceCents,
      currency,
      img
    };
  
    return pid;
  }

  async function loadCsv() {
    try {
      const res = await fetch("catalogue/certificati.ods", { cache: "no-store" });
      if (!res.ok) {
        console.error("Impossibile caricare catalogue/certificati.ods");
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
  
      console.log("Dati caricati da certificati.ods:", data.length, "righe");
      return data;
    } catch (error) {
      console.error("Errore nel caricamento di certificati.ods:", error);
      return [];
    }
  }

  async function load1Csv() {
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
    const ctaMailLabel = msgs?.giftcards?.cta || "Write me";

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    items.forEach(gc => {
      const name = pickLangField(gc, "name", lang, "it");
      const shortText = pickLangField(gc, "short", lang, "it");
      const longText  = pickLangField(gc, "long", lang, "it");

      const img = safeImg(gc.img1);
      const amount = gc.amount_eur && gc.amount_eur !== "-" ? `${gc.amount_eur}€` : "";
      const productId = ensureGiftcardRegistered(gc);
      const canBuy = !!(productId && window.CD?.shop?.addItem);
      const priceCents = moneyToCents(gc.amount_eur);

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
            ${
              canBuy && priceCents > 0
                ? `<button class="card-btn primary" type="button" data-add-giftcard="${productId}">${buyLabel}</button>`
                : `<a class="card-btn primary" href="${mailtoHref}" data-i18n="giftcards.buy">${buyLabel}</a>`
            }
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
                   ${
                     canBuy && priceCents > 0
                       ? `<button type="button" class="vase-btn-primary" data-add-giftcard="${productId}">${buyLabel}</button>`
                       : `<a class="vase-btn-primary" href="${mailtoHref}" data-i18n="giftcards.buy">${buyLabel}</a>`
                   }
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
  
      if (!window.CD?.shop?.addItem) {
        console.warn("CD.shop.addItem non disponibile");
        return;
      }
  
      const p = window.CD?.shop?.products?.[pid];
      if (!p || !p.priceCents) {
        console.warn("Giftcard non registrata o priceCents mancante:", pid);
        return;
      }
  
      try {
        const lang = getLang();
        await window.CD.shop.addItem({
          id: pid,
          type: "digital",
          quantity: 1,
          name: (p.titles && (p.titles[lang] || p.titles.it || p.titles.en || p.titles.ru)) || pid,
          currency: (p.currency || "eur").toLowerCase(),
          unit_amount: Number(p.priceCents),
          image: p.img || ""
        });
      } catch (err) {
        console.error("[GIFTCARDS] Errore add-to-cart", err);
      }
    }, false);
  }

  window.CD = window.CD || {};
  window.CD.certificati = {
    loadCsv,
    render
  };

})();

