// catalogue.js
(function () {

  // Carica il file ODS
  async function loadCsv() {
    try {
      const res = await fetch("catalogue/vasi.ods", { cache: "no-store" });
      if (!res.ok) {
        console.error("Impossibile caricare vasi.ods");
        return [];
      }

      // Leggi il file come ArrayBuffer
      const arrayBuffer = await res.arrayBuffer();
      
      // Usa SheetJS per parsare l'ODS
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      // Prendi il primo foglio
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Converti in array di oggetti
      const data = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false,  // converte tutto in stringhe
        defval: ""   // valore predefinito per celle vuote
      });
      
      console.log("Dati caricati dal file ODS:", data.length, "righe");
      return data;
      
    } catch (error) {
      console.error("Errore nel caricamento del file ODS:", error);
      return [];
    }
  }

  function pickFieldByLang(vase, baseKey, lang) {
    // baseKey: "material" | "technique" | "finish"
    // colonne: material / material-en / material-ru (stesso schema per technique e finish)
    if (lang === "en") return (vase[`${baseKey}-en`] || "").trim();
    if (lang === "ru") return (vase[`${baseKey}-ru`] || "").trim();
    return (vase[baseKey] || "").trim(); // it (default)
  }

  // Rende il catalogo nella griglia e crea i modali
  function render(items, lang) {
    const grid = document.getElementById("catalogue-grid");
    const modalRoot = document.getElementById("modal-container");

    if (!grid) {
      console.warn("catalogue-grid non trovato nel DOM");
      return;
    }

    const allMessages = window.CD && CD.i18n && CD.i18n.messages ? CD.i18n.messages : null;
    if (!allMessages) {
      console.warn("Messaggi di traduzione non disponibili");
      return;
    }
    const msgs = allMessages[lang] || allMessages.it;

    // ordina: prima non venduti
    items.sort((a, b) => {
      const aSold = (a.venduto || "").trim().toLowerCase() === "si";
      const bSold = (b.venduto || "").trim().toLowerCase() === "si";
      if (aSold === bSold) return 0;
      return aSold ? 1 : -1;
    });

    grid.innerHTML = "";
    if (modalRoot) modalRoot.innerHTML = "";

    items.forEach(vase => {
      const name  = vase[`name_${lang}`]  && vase[`name_${lang}`]  !== "-" ? vase[`name_${lang}`]  : vase.name_ru;
      const short = vase[`short_${lang}`] && vase[`short_${lang}`] !== "-" ? vase[`short_${lang}`] : vase.short_ru;
      const long  = vase[`long_${lang}`]  && vase[`long_${lang}`]  !== "-" ? vase[`long_${lang}`]  : vase.long_ru;

      const sold = (vase.venduto || "").trim().toLowerCase() === "si";

      // const img1 = vase.img1 && vase.img1 !== "-" ? `images/catalogue/${vase.img1}` : "images/placeholder.jpg";
      // Modifica

      const cardImgs = [
        vase.img1, vase.img2, vase.img3,
        vase.img4, vase.img5, vase.img6
      ].filter(x => x && x !== "-")
       .map(fn => `images/catalogue/${fn}`);

      // Fine Modifica

      const priceOldStr = vase.price_old && vase.price_old !== "-" ? vase.price_old : null;
      const priceNewStr = vase.price_new && vase.price_new !== "-" ? vase.price_new : null;

      let discount = null;
      if (!sold && priceOldStr && priceNewStr) {
        const oldNum = parseFloat(String(priceOldStr).replace(",", "."));
        const newNum = parseFloat(String(priceNewStr).replace(",", "."));
        if (!isNaN(oldNum) && !isNaN(newNum) && oldNum > newNum) {
          discount = Math.round((1 - newNum / oldNum) * 100);
        }
      }

      let cardStatusBlock = "";
      if (sold) {
        cardStatusBlock = `
          <p class="card-status card-status-sold">
            ${msgs.status.sold}
          </p>
        `;
      } else if (priceNewStr) {
        const discountBlock = discount !== null
          ? `<span class="price-discount">-${discount}%</span>`
          : "";
        if (priceOldStr) {
          cardStatusBlock = `
            <div class="card-price">
              <span class="price-old">${priceOldStr}€</span>
              <span class="price-current">${priceNewStr}€</span>
              ${discountBlock}
            </div>
          `;
        } else {
          cardStatusBlock = `
            <div class="card-price">
              <span class="price-current">${priceNewStr}€</span>
              ${discountBlock}
            </div>
          `;
        }
      }

      const primaryLabel   = msgs.catalogue.addToCart;
      const secondaryLabel = msgs.catalogue.viewPhotos;

      let actionsHtml = "";
      if (sold) {
        actionsHtml = `
          <div class="card-actions">
            <button class="card-btn secondary" data-modal-target="modal-${vase.id}">
              ${secondaryLabel}
            </button>
          </div>`;
      } else {
        actionsHtml = `
          <div class="card-actions">
            <button class="card-btn primary" data-modal-target="modal-${vase.id}">
              ${primaryLabel}
            </button>
            <button class="card-btn secondary" data-modal-target="modal-${vase.id}">
              ${secondaryLabel}
            </button>
          </div>`;
      }

      const card = document.createElement("article");
      card.className = "card";

//      card.innerHTML = `
//        <div class="media media-single" data-modal-target="modal-${vase.id}">
//          <img src="${img1}" alt="${name}">
//        </div>
//        <div class="body">
//          <h4>${name}</h4>
//          <p>${short}</p>
//          ${cardStatusBlock}
//          ${actionsHtml}
//        </div>
//      `;

         const cardGalleryHtml = cardImgs.length
           ? cardImgs.map((src, idx) => `
               <img src="${src}" alt="${name} ${idx+1}" class="card-img ${idx===0 ? "active" : ""}">
             `).join("")
           : `<img src="images/placeholder.jpg" alt="${name}" class="card-img active">`;
         
         const hasMultiple = cardImgs.length > 1;
         
         card.innerHTML = `
           <div class="media media-carousel" data-card-gallery="${vase.id}">
             <div class="card-gallery">
               ${cardGalleryHtml}
             </div>
         
             ${hasMultiple ? `
               <button type="button" class="card-gallery-btn prev" data-card-prev="${vase.id}" aria-label="Previous image">‹</button>
               <button type="button" class="card-gallery-btn next" data-card-next="${vase.id}" aria-label="Next image">›</button>
               <div class="card-gallery-counter" data-card-counter="${vase.id}">1/${cardImgs.length}</div>
             ` : ``}
           </div>
         
           <div class="body">
             <h4>${name}</h4>
             <p>${short}</p>
             ${cardStatusBlock}
             ${actionsHtml}
           </div>
         `;
// Fine Modifica


      grid.appendChild(card);

      // ---------- MODALE ----------
      if (!modalRoot) return;

      const imgs = [
        vase.img1, vase.img2, vase.img3,
        vase.img4, vase.img5, vase.img6
      ].filter(x => x && x !== "-")
       .map(fn => `images/catalogue/${fn}`);

      const modal = document.createElement("div");
      modal.className = "modal";
      modal.id = `modal-${vase.id}`;

      let priceBlock = "";
      if (sold) {
        priceBlock = `
          <div class="vase-price-row">
            <span class="vase-price">${msgs.status.sold}</span>
          </div>
        `;
      } else if (priceNewStr) {
        const discountBlock = discount !== null
          ? `<span class="vase-discount">-${discount}%</span>`
          : "";
        if (priceOldStr) {
          priceBlock = `
            <div class="vase-price-row">
              <span class="vase-old-price">${priceOldStr}€</span>
              <span class="vase-price">${priceNewStr}€</span>
              ${discountBlock}
            </div>
          `;
        } else {
          priceBlock = `
            <div class="vase-price-row">
              <span class="vase-price">${priceNewStr}€</span>
              ${discountBlock}
            </div>
          `;
        }
      }

      const spec = msgs.catalogue.spec;

      const galleryImgsHtml = imgs.map((src, idx) => `
        <img src="${src}" alt="${name} ${idx + 1}" data-index="${idx}" class="${idx === 0 ? "active" : ""}">
      `).join("");

      modal.innerHTML = `
        <div class="modal-dialog">
          <div class="modal-header">
            <h2 class="vase-title">${name}</h2>
            <button type="button" data-modal-close>×</button>
          </div>
          <div class="modal-body">
            <div class="modal-body-inner">
              <div class="vase-detail-panel">
                <h3 class="vase-subtitle">${short}</h3>
                ${priceBlock}
                <div class="vase-actions">
                  <button class="vase-btn-primary">${primaryLabel}</button>
                  <button class="vase-btn-outline">${secondaryLabel}</button>
                </div>

                <button class="accordion-header" data-acc-target="desc-${vase.id}">
                  <span>${msgs.detail.description}</span>
                  <span>›</span>
                </button>
                <div class="accordion-panel" id="desc-${vase.id}">
                  <p>${long}</p>
                </div>

                <button class="accordion-header" data-acc-target="spec-${vase.id}">
                  <span>${msgs.detail.characteristics}</span>
                  <span>›</span>
                </button>
                <div class="accordion-panel" id="spec-${vase.id}">
                  <div class="vase-specs">
                    <dl>
                      ${vase.height    && vase.height    !== "-" ? `<dt>${spec.height}</dt><dd>${vase.height}</dd>`       : ""}
                      ${vase.diameter  && vase.diameter  !== "-" ? `<dt>${spec.diameter}</dt><dd>${vase.diameter}</dd>`   : ""}
                      ${(() => {
                        const v = pickFieldByLang(vase, "material", lang);
                        return v && v !== "-" ? `<dt>${spec.material}</dt><dd>${v}</dd>` : "";
                      })()}
                      ${(() => {
                        const v = pickFieldByLang(vase, "technique", lang);
                        return v && v !== "-" ? `<dt>${spec.technique}</dt><dd>${v}</dd>` : "";
                      })()}
                      ${(() => {
                        const v = pickFieldByLang(vase, "finish", lang);
                        return v && v !== "-" ? `<dt>${spec.finish}</dt><dd>${v}</dd>` : "";
                      })()}
                    </dl>
                  </div>
                </div>

                <button class="accordion-header" data-acc-target="del-${vase.id}">
                  <span>${msgs.detail.delivery}</span>
                  <span>›</span>
                </button>
                <div class="accordion-panel" id="del-${vase.id}">
                  <p>${msgs.detail.deliveryText}</p>
                </div>
              </div>

              <div class="modal-gallery">
                <div class="modal-gallery-main">
                  ${galleryImgsHtml}
                </div>
                <div class="modal-gallery-counter" data-gallery-counter="${vase.id}">
                  ${imgs.length ? `1 / ${imgs.length}` : ""}
                </div>
                <div class="modal-gallery-controls" data-gallery-controls="${vase.id}">
                  <button type="button" data-gallery-prev>←</button>
                  <button type="button" data-gallery-next>→</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      modalRoot.appendChild(modal);
    });
  }

function initCardGalleries() {
  document.querySelectorAll(".media-carousel").forEach(block => {
    const id = block.getAttribute("data-card-gallery");
    const imgs = Array.from(block.querySelectorAll(".card-img"));
    const counter = block.querySelector(`[data-card-counter="${id}"]`);
    if (imgs.length <= 1) return;

    let index = 0;
    const show = (i) => {
      if (i < 0) i = imgs.length - 1;
      if (i >= imgs.length) i = 0;
      index = i;
      imgs.forEach((img, k) => img.classList.toggle("active", k === index));
      if (counter) counter.textContent = `${index + 1}/${imgs.length}`;
    };

    block.addEventListener("click", (e) => {
      // evita che click su bottoni di card (se presenti) faccia casino
      if (e.target.closest("button") || e.target.closest("a")) return;
    
      const rect = block.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const isLeft = x < rect.width * 0.33; // terzo sinistro
    
      e.preventDefault();
      e.stopPropagation();
    
      if (isLeft) show(index - 1);
      else show(index + 1); // centro + destra
    });

    // ---- SWIPE MOBILE ----
    let touchStartX = 0;
    let touchEndX = 0;
    
    block.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    block.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
      const delta = touchEndX - touchStartX;
      const threshold = 30; // px minimi per considerare swipe
    
      if (Math.abs(delta) < threshold) return;
    
      if (delta > 0) {
        // swipe destra → sinistra logica inversa
        show(index - 1);
      } else {
        show(index + 1);
      }
    }

  });
}

  // Inizializza modali, accordion e gallery (chiamata dopo render)
function initModals() {
  console.log("🔍 [CATALOGUE] Inizializzazione modali con delegazione eventi...");
  
  // Rimuovi eventuali listener precedenti
  document.removeEventListener("click", handleModalClick);
  
  // Aggiungi listener sul document (delegazione)
  document.addEventListener("click", handleModalClick);
  
  console.log("✅ [CATALOGUE] Modali inizializzati con delegazione");
}

// Handler separato per i click
function handleModalClick(e) {
  const target = e.target;
  
  // Apertura modal - click su bottone o immagine con data-modal-target
  const modalTrigger = target.closest("[data-modal-target]");
  if (modalTrigger) {
    e.preventDefault();
    e.stopPropagation();
    const id = modalTrigger.dataset.modalTarget;
    console.log("🔍 [CATALOGUE] Click su trigger, apertura modal:", id);
    const modal = document.getElementById(id);
    if (modal) {
      console.log("✅ [CATALOGUE] Modal trovato, apertura...");
      modal.classList.add("open");
      console.log("✅ [CATALOGUE] Classe 'open' aggiunta");
    } else {
      console.error("❌ [CATALOGUE] Modal non trovato con ID:", id);
    }
    return;
  }
  
  // Chiusura modal - click su X
  const closeBtn = target.closest("[data-modal-close]");
  if (closeBtn) {
    e.preventDefault();
    e.stopPropagation();
    console.log("🔍 [CATALOGUE] Click su close, chiusura modal");
    const modal = closeBtn.closest(".modal");
    if (modal) {
      modal.classList.remove("open");
      console.log("✅ [CATALOGUE] Modal chiuso");
    }
    return;
  }
  
  // Chiusura modal - click sullo sfondo
  if (target.classList.contains("modal")) {
    console.log("🔍 [CATALOGUE] Click su sfondo modal, chiusura");
    target.classList.remove("open");
  }
}


/*
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
      if (e.target.classList && e.target.classList.contains("modal") && e.target === e.currentTarget) {
        e.target.classList.remove("open");
      }
    });
  }
*/

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
  
      function getCurrentIndex() {
        return imgs.findIndex(img => img.classList.contains("active"));
      }
  
      function updateGallery(newIndex) {
        if (newIndex < 0) newIndex = imgs.length - 1;
        if (newIndex >= imgs.length) newIndex = 0;
        
        imgs.forEach(img => img.classList.remove("active"));
        imgs[newIndex].classList.add("active");
        
        if (counterEl) {
          counterEl.textContent = `${newIndex + 1} / ${imgs.length}`;
        }
      }
  
      const prevBtn = controls.querySelector("[data-gallery-prev]");
      const nextBtn = controls.querySelector("[data-gallery-next]");
  
      if (prevBtn) {
        prevBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const currentIndex = getCurrentIndex();
          updateGallery(currentIndex - 1);
        });
      }
      
      if (nextBtn) {
        nextBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const currentIndex = getCurrentIndex();
          updateGallery(currentIndex + 1);
        });
      }
  
      if (galleryMain) {
        galleryMain.addEventListener("click", (e) => {
          e.stopPropagation();
          const currentIndex = getCurrentIndex();
          updateGallery(currentIndex + 1);
        });
        galleryMain.style.cursor = "pointer";
      }
    });
  }

function initBehaviour() {
  console.log("🔍 [CATALOGUE] Inizializzazione comportamenti...");
  initModals();
  initAccordions();
  initGalleries();
  initCardGalleries();  // card
  console.log("✅ [CATALOGUE] Comportamenti inizializzati");
}

/*
  function initBehaviour() {
    initModals();
    initAccordions();
    initGalleries();
  }
*/

  // Espone le API nel namespace globale CD
  window.CD = window.CD || {};
  window.CD.catalogue = {
    loadCsv,
    render,
    initBehaviour
  };

})();

