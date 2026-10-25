// Stripe/js/catalogueStripe.js
// Versione "Stripe" del catalogue: mantiene layout e modali, ma i pulsanti Compra
// aggiungono al carrello locale (CD.shop) invece che a Shopify.
(function () {

  const IMG_DIR = "images/catalogue";
  const PLACEHOLDER_IMG = "images/placeholder.svg";
  const PRICE_KEYS = ["price_old", "price_new"];

  // Carica il file ODS. Lancia in caso di errore: il chiamante distingue
  // "catalogo vuoto" da "catalogo non caricato".
  async function loadRows() {
    const data = await CD.util.loadOdsRows("catalogue/vasi.ods", PRICE_KEYS);
    console.log("Dati caricati dal file ODS:", data.length, "righe");
    return data;
  }

  // Valore di una colonna spec: vuoto se "-" o se uguale al nome della colonna (placeholder)
  function specValue(vase, column) {
    const v = String(vase[column] == null ? "" : vase[column]).trim();
    if (!v || v === "-" || v.toLowerCase() === column.toLowerCase()) return "";
    return v;
  }

  function pickFieldByLang(vase, baseKey, lang) {
    if (lang === "en") return specValue(vase, `${baseKey}-en`);
    if (lang === "ru") return specValue(vase, `${baseKey}-ru`);
    return specValue(vase, baseKey);
  }

  function imgUrl(fn) {
    return `${IMG_DIR}/${encodeURIComponent(fn)}`;
  }

  function vaseImages(vase) {
    return [vase.img1, vase.img2, vase.img3, vase.img4, vase.img5, vase.img6]
      .map(x => String(x == null ? "" : x).trim())
      .filter(x => x && x !== "-")
      .map(imgUrl);
  }

  function textOrFallback(vase, base, lang) {
    const v = vase[`${base}_${lang}`];
    return v && v !== "-" ? v : (vase[`${base}_ru`] || "");
  }

  // Rende il catalogo nella griglia e crea i modali.
  // Ritorna il numero di prodotti registrati, oppure false se il rendering non e' possibile.
  function render(items, lang) {
    const grid = document.getElementById("catalogue-grid");
    const modalRoot = document.getElementById("modal-container");

    if (!grid) {
      console.warn("catalogue-grid non trovato nel DOM");
      return false;
    }

    const allMessages = window.CD && CD.i18n && CD.i18n.messages ? CD.i18n.messages : null;
    if (!allMessages) {
      console.warn("Messaggi di traduzione non disponibili");
      return false;
    }
    const msgs = allMessages[lang] || allMessages.it;
    const esc = CD.util.escapeHtml;
    const fmt = (cents) => CD.money.format(cents, lang);
    const tr = (key, fallback) => CD.i18n.t(key, lang) || fallback;

    // ordina una COPIA: prima non venduti (sort stabile)
    const sorted = (Array.isArray(items) ? items : []).slice().sort((a, b) => {
      const aSold = CD.util.isSoldFlag(a.venduto);
      const bSold = CD.util.isSoldFlag(b.venduto);
      if (aSold === bSold) return 0;
      return aSold ? 1 : -1;
    });

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    // registro prodotti per il carrello: si ricostruisce ad ogni render (regola unica per sorgente)
    CD.util.clearProducts("catalogue");

    const seenIds = new Set();
    let firstCardDone = false;
    let registered = 0;

    sorted.forEach(vase => {
      const productId = String(vase.id == null ? "" : vase.id).trim();
      if (!productId || !CD.util.isValidId(productId)) {
        console.error("[CATALOGUE] id mancante o non valido, riga saltata:", JSON.stringify(vase.id), vase.name_it || vase.name_ru || "");
        return;
      }
      if (seenIds.has(productId)) {
        console.error("[CATALOGUE] id duplicato, riga saltata:", productId, vase.name_it || vase.name_ru || "");
        return;
      }
      seenIds.add(productId);

      const name  = textOrFallback(vase, "name", lang);
      const short = textOrFallback(vase, "short", lang);
      const long  = textOrFallback(vase, "long", lang);

      const sold = CD.util.isSoldFlag(vase.venduto) || CD.util.isSoldOverride(productId);
      const priceOldStr = vase.price_old && vase.price_old !== "-" ? vase.price_old : null;
      const priceNewStr = vase.price_new && vase.price_new !== "-" ? vase.price_new : null;

      const newCents = CD.money.cellToCents(vase, "price_new");
      const oldCents = CD.money.cellToCents(vase, "price_old");
      const priceCents = sold ? null : newCents;
      CD.util.warnBadPrice("CATALOGUE", productId, vase, "price_new", newCents, sold);
      CD.util.warnBadPrice("CATALOGUE", productId, vase, "price_old", oldCents, sold);

      const cardImgs = vaseImages(vase);
      const img = cardImgs[0] || PLACEHOLDER_IMG;

      const pick = (l) => {
        const v = vase[`name_${l}`];
        return v && v !== "-" ? v : (vase.name_ru || "");
      };
      CD.util.registerProduct("catalogue", {
        id: productId,
        type: "physical",
        sold: !!sold,
        priceCents,
        currency: "EUR",
        img,
        maxQty: 1,
        titles: { it: pick("it"), en: pick("en"), ru: vase.name_ru && vase.name_ru !== "-" ? vase.name_ru : "" }
      });
      registered++;

      let discount = null;
      if (!sold && oldCents && newCents && oldCents > newCents) {
        discount = Math.round((1 - newCents / oldCents) * 100);
      }

      // prezzi mostrati: da centesimi validi (CD.money.format), altrimenti il testo della cella (escaped)
      const oldShown = oldCents ? fmt(oldCents) : (priceOldStr || "");
      const newShown = newCents ? fmt(newCents) : (priceNewStr || "");

      let cardStatusBlock = "";
      if (sold) {
        cardStatusBlock = `
          <p class="card-status card-status-sold">
            ${esc(msgs.status.sold)}
          </p>
        `;
      } else if (priceNewStr) {
        const discountBlock = discount !== null
          ? `<span class="price-discount">-${discount}%</span>`
          : "";
        if (priceOldStr) {
          cardStatusBlock = `
            <div class="card-price">
              <span class="price-old">${esc(oldShown)}</span>
              <span class="price-current">${esc(newShown)}</span>
              ${discountBlock}
            </div>
          `;
        } else {
          cardStatusBlock = `
            <div class="card-price">
              <span class="price-current">${esc(newShown)}</span>
              ${discountBlock}
            </div>
          `;
        }
      }

      const primaryLabel   = esc(msgs.catalogue.addToCart);
      const secondaryLabel = esc(msgs.catalogue.viewPhotos);

      // immagini card: la prima immagine della prima card e' eager (LCP), le altre lazy;
      // le slide dopo la prima usano data-src e vengono caricate quando mostrate.
      const isFirstCard = !firstCardDone;
      firstCardDone = true;

      const cardGalleryHtml = cardImgs.length
        ? cardImgs.map((src, idx) => {
            const alt = esc(`${name} ${idx + 1}`);
            const cls = `card-img ${idx === 0 ? "active" : ""}`;
            if (idx === 0) {
              const lazy = isFirstCard ? "" : ` loading="lazy" decoding="async"`;
              return `<img src="${esc(src)}" alt="${alt}" class="${cls}"${lazy}>`;
            }
            return `<img data-src="${esc(src)}" alt="${alt}" class="${cls}" loading="lazy" decoding="async">`;
          }).join("")
        : `<img src="${PLACEHOLDER_IMG}" alt="${esc(name)}" class="card-img active" loading="lazy" decoding="async">`;

      const hasMultiple = cardImgs.length > 1;
      const vid = esc(productId);

      let actionsHtml = "";
      // ✅ Vendibile via Stripe solo se ho id + prezzo valido e non e' venduto
      const canSell = !sold && !!(priceCents && priceCents > 0);

      if (!canSell) {
        actionsHtml = `
          <div class="card-actions">
            <button class="card-btn secondary" data-modal-target="modal-${vid}">
              ${secondaryLabel}
            </button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="card-actions">
            <button class="card-btn primary"
                    type="button"
                    data-add-to-cart="${vid}"
                    data-vase-name="${esc(name)}">
              ${primaryLabel}
            </button>
            <button class="card-btn secondary" data-modal-target="modal-${vid}">
              ${secondaryLabel}
            </button>
          </div>`;
      }

      const card = document.createElement("article");
      card.className = "card";

      card.innerHTML = `
        <div class="media media-carousel" data-card-gallery="${vid}">
          <div class="card-gallery">
            ${cardGalleryHtml}
          </div>

          ${hasMultiple ? `
            <button type="button" class="card-gallery-btn prev" data-card-prev="${vid}" data-i18n-aria-label="gallery.prev" aria-label="${esc(tr("gallery.prev", "Previous image"))}">‹</button>
            <button type="button" class="card-gallery-btn next" data-card-next="${vid}" data-i18n-aria-label="gallery.next" aria-label="${esc(tr("gallery.next", "Next image"))}">›</button>
            <div class="card-gallery-counter" data-card-counter="${vid}">1/${cardImgs.length}</div>
          ` : ``}
        </div>

        <div class="body">
          <h4>${esc(name)}</h4>
          <p>${esc(short)}</p>
          ${cardStatusBlock}
          ${actionsHtml}
        </div>
      `;

      grid.appendChild(card);

      // ---------- MODALE ----------
      if (!modalRoot) return;

      const imgs = cardImgs;

      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = `modal-${productId}`;

      let priceBlock = "";
      if (sold) {
        priceBlock = `
          <div class="vase-price-row">
            <span class="vase-price">${esc(msgs.status.sold)}</span>
          </div>
        `;
      } else if (priceNewStr) {
        const discountBlock = discount !== null
          ? `<span class="vase-discount">-${discount}%</span>`
          : "";
        if (priceOldStr) {
          priceBlock = `
            <div class="vase-price-row">
              <span class="vase-old-price">${esc(oldShown)}</span>
              <span class="vase-price">${esc(newShown)}</span>
              ${discountBlock}
            </div>
          `;
        } else {
          priceBlock = `
            <div class="vase-price-row">
              <span class="vase-price">${esc(newShown)}</span>
              ${discountBlock}
            </div>
          `;
        }
      }

      const spec = msgs.catalogue.spec;

      // immagini del modale: data-src, il src viene impostato all'apertura del modale
      const galleryImgsHtml = imgs.map((src, idx) => `
        <img data-src="${esc(src)}" alt="${esc(`${name} ${idx + 1}`)}" data-index="${idx}" class="${idx === 0 ? "active" : ""}" decoding="async">
      `).join("");

      const specRow = (label, value) => value ? `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>` : "";

      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h2 class="vase-title">${esc(name)}</h2>
            <button type="button" data-modal-close data-i18n-aria-label="modal.close" aria-label="${esc(tr("modal.close", "Close"))}">×</button>
          </div>
          <div class="modal-body">
            <div class="modal-body-inner">
              <div class="vase-detail-panel">
                <h3 class="vase-subtitle">${esc(short)}</h3>
                ${priceBlock}
                <div class="vase-actions">
                  ${canSell ? `
                    <button type="button" class="vase-btn-primary"
                            data-add-to-cart="${vid}"
                            data-vase-name="${esc(name)}">
                      ${primaryLabel}
                    </button>
                  ` : ""}
                  <button class="vase-btn-outline">${secondaryLabel}</button>
                </div>

                <button class="accordion-header" data-acc-target="desc-${vid}">
                  <span>${esc(msgs.detail.description)}</span>
                  <span>›</span>
                </button>
                <div class="accordion-panel" id="desc-${vid}">
                  <p>${esc(long)}</p>
                </div>

                <button class="accordion-header" data-acc-target="spec-${vid}">
                  <span>${esc(msgs.detail.characteristics)}</span>
                  <span>›</span>
                </button>
                <div class="accordion-panel" id="spec-${vid}">
                  <div class="vase-specs">
                    <dl>
                      ${specRow(spec.height, specValue(vase, "height"))}
                      ${specRow(spec.diameter, specValue(vase, "diameter"))}
                      ${specRow(spec.material, pickFieldByLang(vase, "material", lang))}
                      ${specRow(spec.technique, pickFieldByLang(vase, "technique", lang))}
                      ${specRow(spec.finish, pickFieldByLang(vase, "finish", lang))}
                    </dl>
                  </div>
                </div>

                <button class="accordion-header" data-acc-target="del-${vid}">
                  <span>${esc(msgs.detail.delivery)}</span>
                  <span>›</span>
                </button>
                <div class="accordion-panel" id="del-${vid}">
                  <p>${esc(msgs.detail.deliveryText)}</p>
                </div>
              </div>

              <div class="modal-gallery">
                <div class="modal-gallery-main">
                  ${galleryImgsHtml}
                </div>
                <div class="modal-gallery-counter" data-gallery-counter="${vid}">
                  ${imgs.length ? `1 / ${imgs.length}` : ""}
                </div>
                <div class="modal-gallery-controls" data-gallery-controls="${vid}">
                  <button type="button" data-gallery-prev data-i18n-aria-label="gallery.prev" aria-label="${esc(tr("gallery.prev", "Previous image"))}">←</button>
                  <button type="button" data-gallery-next data-i18n-aria-label="gallery.next" aria-label="${esc(tr("gallery.next", "Next image"))}">→</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      modalRoot.appendChild(modal);
    });

    CD.util.bindAddToCart("[data-add-to-cart]");

    // aggiorna testi del drawer (es: cambio lingua)
    if (window.CD?.shop?.renderDrawer) window.CD.shop.renderDrawer();
    return registered;
  }

  // Mostra "catalogo non disponibile" nella griglia (caricamento fallito)
  function renderUnavailable() {
    CD.util.renderUnavailable("catalogue-grid");
  }


  // --- Card galleries (identico alla tua logica, con protezioni) ---
  function initCardGalleries() {
    document.querySelectorAll(".media-carousel").forEach(block => {
      const id = block.getAttribute("data-card-gallery");
      const imgs = Array.from(block.querySelectorAll(".card-img"));
      const counter = block.querySelector(`[data-card-counter="${id}"]`);
      if (imgs.length <= 1) return;

      let index = 0;
      const state = {};
      const show = (i, dir) => {
        if (i < 0) i = imgs.length - 1;
        if (i >= imgs.length) i = 0;
        index = i;
        // carica la slide richiesta e la vicina; la slide precedente resta visibile fino al load
        CD.util.loadNeighbours(imgs, index, dir);
        CD.util.activateSlide(imgs, index, state);
        if (counter) counter.textContent = `${index + 1}/${imgs.length}`;
      };

      block.addEventListener("click", (e) => {
        if (e.target.closest("button") || e.target.closest("a")) return;
        if (e.target.closest(".card-actions")) return;

        const rect = block.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const isLeft = x < rect.width * 0.33;

        e.preventDefault();
        e.stopPropagation();

        if (isLeft) show(index - 1, -1);
        else show(index + 1, 1);
      });

      let touchStartX = 0;
      let touchEndX = 0;

      block.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].clientX;
      }, { passive: true });

      block.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].clientX;
        const delta = touchEndX - touchStartX;
        const threshold = 30;
        if (Math.abs(delta) < threshold) return;
        if (delta > 0) show(index - 1, -1);
        else show(index + 1, 1);
      }, { passive: true });
    });
  }

  function initAccordions() {
    document.querySelectorAll(".accordion-header").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.accTarget;
        const panel = document.getElementById(targetId);
        if (!panel) return;
        const isOpen = panel.classList.contains("active");
        document.querySelectorAll(".accordion-panel").forEach(p => p.classList.remove("active"));
        if (!isOpen) panel.classList.add("active");
      });
    });
  }

  function initGalleries() {
    document.querySelectorAll(".modal").forEach(modal => {
      const imgs = Array.from(modal.querySelectorAll(".modal-gallery-main img"));
      if (!imgs.length) return;

      const counterEl = modal.querySelector("[data-gallery-counter]");
      const controls = modal.querySelector("[data-gallery-controls]");
      const galleryMain = modal.querySelector(".modal-gallery-main");
      if (!controls) return;

      let current = Math.max(0, imgs.findIndex(img => img.classList.contains("active")));
      const state = {};

      function getCurrentIndex() {
        return current;
      }

      function updateGallery(newIndex, dir) {
        if (newIndex < 0) newIndex = imgs.length - 1;
        if (newIndex >= imgs.length) newIndex = 0;
        current = newIndex;

        // carica la slide richiesta e la vicina; la precedente resta visibile fino al load
        CD.util.loadNeighbours(imgs, newIndex, dir);
        CD.util.activateSlide(imgs, newIndex, state);

        if (counterEl) counterEl.textContent = `${newIndex + 1} / ${imgs.length}`;
      }

      const prevBtn = controls.querySelector("[data-gallery-prev]");
      const nextBtn = controls.querySelector("[data-gallery-next]");

      if (prevBtn) {
        prevBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          updateGallery(getCurrentIndex() - 1, -1);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          updateGallery(getCurrentIndex() + 1, 1);
        });
      }

      if (galleryMain) {
        galleryMain.addEventListener("click", (e) => {
          e.stopPropagation();
          updateGallery(getCurrentIndex() + 1, 1);
        });
        galleryMain.style.cursor = "pointer";
      }
    });
  }

  function initBehaviour() {
    console.log("🔍 [CATALOGUE/STRIPE] Inizializzazione comportamenti...");
    CD.util.bindModalDelegate();
    CD.util.bindAddToCart("[data-add-to-cart]");
    initAccordions();
    initGalleries();
    initCardGalleries();
    console.log("✅ [CATALOGUE/STRIPE] Comportamenti inizializzati");
  }

  window.CD = window.CD || {};
  window.CD.catalogue = {
    loadRows,
    render,
    renderUnavailable,
    initBehaviour
  };

})();
