/* ============================================================
   STATO LINGUA + VISTA (desktop/mobile)
============================================================ */

let currentLang = "it";
let viewMode = "desktop"; // "desktop" | "mobile"

function detectInitialLang(){
  const saved = localStorage.getItem("cd_lang");
  if (saved && messages[saved]) return saved;

  const browser = (navigator.language || navigator.userLanguage || "it").slice(0,2);
  if (messages[browser]) return browser;
  return "it";
}

/* applica testo a tutti i data-i18n */
function applyTranslations(lang){
  const dict = messages[lang];
  if (!dict) return;

  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const path = el.getAttribute("data-i18n").split(".");
    let cur = dict;
    for (const p of path){
      cur = cur && cur[p];
    }
    if (typeof cur === "string"){
      el.textContent = cur;
    }
  });

  const langSelect = document.getElementById("language-selector");
  if (langSelect){
    langSelect.value = lang;
  }
}

function setLanguage(lang){
  if (!messages[lang]) return;
  currentLang = lang;
  localStorage.setItem("cd_lang", lang);
  applyTranslations(lang);
  if (window.__catalogueData){
    renderCatalogue(window.__catalogueData, currentLang);
  }
}

/* ============================================================
   IMPORT CSV VASI
============================================================ */

async function loadCsv(){
  const res = await fetch("catalogue/vasi.csv", { cache: "no-store" });
  if (!res.ok){
    console.error("Impossibile caricare vasi.csv");
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
    header.forEach((h,i)=>{ obj[h] = cols[i] ?? ""; });
    return obj;
  });
}

/* ============================================================
   RENDER CATALOGO
============================================================ */
function renderCatalogue(items, lang){
  const grid = document.getElementById("catalogue-grid");
  const modalRoot = document.getElementById("modal-container");
  if (!grid){
    console.warn("catalogue-grid non trovato nel DOM");
    return;
  }

  // ordina: prima non venduti
  items.sort((a,b)=>{
    const aSold = (a.venduto || "").trim().toLowerCase() === "si";
    const bSold = (b.venduto || "").trim().toLowerCase() === "si";
    if (aSold === bSold) return 0;
    return aSold ? 1 : -1;
  });

  grid.innerHTML = "";
  if (modalRoot) modalRoot.innerHTML = "";

  items.forEach(vase=>{
    const name  = vase[`name_${lang}`]  && vase[`name_${lang}`]  !== "-" ? vase[`name_${lang}`]  : vase.name_ru;
    const short = vase[`short_${lang}`] && vase[`short_${lang}`] !== "-" ? vase[`short_${lang}`] : vase.short_ru;
    const long  = vase[`long_${lang}`]  && vase[`long_${lang}`]  !== "-" ? vase[`long_${lang}`]  : vase.long_ru;

    const sold = (vase.venduto || "").trim().toLowerCase() === "si";

    const img1 = vase.img1 && vase.img1 !== "-" ? `images/catalogue/${vase.img1}` : "images/placeholder.jpg";

    const priceOldStr = vase.price_old && vase.price_old !== "-" ? vase.price_old : null;
    const priceNewStr = vase.price_new && vase.price_new !== "-" ? vase.price_new : null;

    let discount = null;
    if (!sold && priceOldStr && priceNewStr){
      const oldNum = parseFloat(String(priceOldStr).replace(",", "."));
      const newNum = parseFloat(String(priceNewStr).replace(",", "."));
      if (!isNaN(oldNum) && !isNaN(newNum) && oldNum > newNum){
        discount = Math.round((1 - newNum/oldNum)*100);
      }
    }

    let cardStatusBlock = "";
    if (sold){
      cardStatusBlock = `
        <p class="card-status card-status-sold">
          ${messages[lang].status.sold}
        </p>
      `;
    } else if (priceNewStr){
      const discountBlock = discount !== null
        ? `<span class="price-discount">-${discount}%</span>`
        : "";
      if (priceOldStr){
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

    const primaryLabel   = messages[lang].catalogue.addToCart;
    const secondaryLabel = messages[lang].catalogue.viewPhotos;

    let actionsHtml = "";
    if (sold){
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

    card.innerHTML = `
      <div class="media media-single" data-modal-target="modal-${vase.id}">
        <img src="${img1}" alt="${name}">
      </div>
      <div class="body">
        <h4>${name}</h4>
        <p>${short}</p>
        ${cardStatusBlock}
        ${actionsHtml}
      </div>
    `;

    grid.appendChild(card);

    /* ---------- MODALE ---------- */
    if (!modalRoot) return;

    const imgs = [
      vase.img1,vase.img2,vase.img3,
      vase.img4,vase.img5,vase.img6
    ].filter(x=>x && x !== "-")
     .map(fn=>`images/catalogue/${fn}`);

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = `modal-${vase.id}`;

    let priceBlock = "";
    if (sold){
      priceBlock = `
        <div class="vase-price-row">
          <span class="vase-price">${messages[lang].status.sold}</span>
        </div>
      `;
    } else if (priceNewStr){
      const discountBlock = discount !== null
        ? `<span class="vase-discount">-${discount}%</span>`
        : "";
      if (priceOldStr){
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

    const spec = messages[lang].catalogue.spec;

    const galleryImgsHtml = imgs.map((src,idx)=>`
      <img src="${src}" alt="${name} ${idx+1}" data-index="${idx}" class="${idx===0?"active":""}">
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
                <span>${messages[lang].detail.description}</span>
                <span>›</span>
              </button>
              <div class="accordion-panel" id="desc-${vase.id}">
                <p>${long}</p>
              </div>

              <button class="accordion-header" data-acc-target="spec-${vase.id}">
                <span>${messages[lang].detail.characteristics}</span>
                <span>›</span>
              </button>
              <div class="accordion-panel" id="spec-${vase.id}">
                <div class="vase-specs">
                  <dl>
                    ${vase.height && vase.height !== "-" ? `<dt>${spec.height}</dt><dd>${vase.height}</dd>` : ""}
                    ${vase.diameter && vase.diameter !== "-" ? `<dt>${spec.diameter}</dt><dd>${vase.diameter}</dd>` : ""}
                    ${vase.material && vase.material !== "-" ? `<dt>${spec.material}</dt><dd>${vase.material}</dd>` : ""}
                    ${vase.technique && vase.technique !== "-" ? `<dt>${spec.technique}</dt><dd>${vase.technique}</dd>` : ""}
                    ${vase.finish && vase.finish !== "-" ? `<dt>${spec.finish}</dt><dd>${vase.finish}</dd>` : ""}
                  </dl>
                </div>
              </div>

              <button class="accordion-header" data-acc-target="del-${vase.id}">
                <span>${messages[lang].detail.delivery}</span>
                <span>›</span>
              </button>
              <div class="accordion-panel" id="del-${vase.id}">
                <p>${messages[lang].detail.deliveryText}</p>
              </div>
            </div>

            <div class="modal-gallery">
              <div class="modal-gallery-main">
                ${galleryImgsHtml}
              </div>
              <div class="modal-gallery-counter" data-gallery-counter="${vase.id}">
                1 / ${imgs.length}
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

  initModals();
  initAccordions();
  initGalleries();
}

/* ============================================================
   MODALI + GALLERY
============================================================ */
function initModals(){
  document.querySelectorAll("[data-modal-target]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.dataset.modalTarget;
      document.getElementById(id)?.classList.add("open");
    });
  });

  document.querySelectorAll("[data-modal-close]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      btn.closest(".modal")?.classList.remove("open");
    });
  });

  document.addEventListener("click", e=>{
    if (e.target.classList.contains("modal")){
      e.target.classList.remove("open");
    }
  });
}

function initAccordions(){
  document.querySelectorAll(".accordion-header").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const targetId = btn.dataset.accTarget;
      const panel = document.getElementById(targetId);
      if (!panel) return;
      const isOpen = panel.classList.contains("active");
      document.querySelectorAll(".accordion-panel").forEach(p=>p.classList.remove("active"));
      if (!isOpen) panel.classList.add("active");
    });
  });
}

function initGalleries(){
  document.querySelectorAll(".modal").forEach(modal=>{
    const imgs = Array.from(modal.querySelectorAll(".modal-gallery-main img"));
    if (!imgs.length) return;
    let index = 0;

    const counterEl = modal.querySelector("[data-gallery-counter]");
    const controls = modal.querySelector("[data-gallery-controls]");
    if (!controls) return;

    function updateGallery(newIndex){
      if (newIndex < 0) newIndex = imgs.length - 1;
      if (newIndex >= imgs.length) newIndex = 0;
      index = newIndex;
      imgs.forEach((img,i)=>{
        img.classList.toggle("active", i === index);
      });
      if (counterEl){
        counterEl.textContent = `${index+1} / ${imgs.length}`;
      }
    }

    controls.querySelector("[data-gallery-prev]").addEventListener("click", ()=>{
      updateGallery(index - 1);
    });
    controls.querySelector("[data-gallery-next]").addEventListener("click", ()=>{
      updateGallery(index + 1);
    });
  });
}

/* ============================================================
   NAVBAR MOBILE – HAMBURGER
============================================================ */
function initNavbarToggle(){
  const body = document.body;
  const toggle = document.getElementById("nav-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", ()=>{
    const isOpen = body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

/* ============================================================
   VIEW MODE TOGGLE (Desktop/Mobile)
============================================================ */
function setViewMode(mode){
  viewMode = mode;
  if (mode === "mobile"){
    document.body.classList.add("mobile-view");
  } else {
    document.body.classList.remove("mobile-view");
  }
  localStorage.setItem("cd_view", mode);
}

function initViewToggle(){
  const saved = localStorage.getItem("cd_view");
  if (saved === "mobile" || saved === "desktop"){
    setViewMode(saved);
  }

  const btnDesktop = document.getElementById("view-desktop");
  const btnMobile  = document.getElementById("view-mobile");

  if (btnDesktop){
    btnDesktop.addEventListener("click", ()=> setViewMode("desktop"));
  }
  if (btnMobile){
    btnMobile.addEventListener("click", ()=> setViewMode("mobile"));
  }
}

/* ============================================================
   INIT
============================================================ */
async function appInit(){
  currentLang = detectInitialLang();
  applyTranslations(currentLang);

  const langSelect = document.getElementById("language-selector");
  if (langSelect){
    langSelect.value = currentLang;
    langSelect.addEventListener("change", e=>{
      setLanguage(e.target.value);
    });
  }

  try{
    const items = await loadCsv();
    window.__catalogueData = items;
    renderCatalogue(items, currentLang);
  }catch(err){
    console.error("Errore nel caricamento del catalogo", err);
  }

  initNavbarToggle();
  initViewToggle();
}

document.addEventListener("DOMContentLoaded", appInit);

