/* ============================================================
   LINGUE – dizionario di traduzione
============================================================ */

const messages = {
  ru: {
    nav:{home:"Главная",about:"О бренде",catalogue:"Каталог",workshops:"Мастер-классы",contact:"Контакты"},
    hero:{tagline:"Тактильная интерьерная керамика с бисерной вышивкой, которая превратит ваш дом в место силы и вдохновения"},
    about:{
      title:"О бренде",
      intro1:"Меня зовут Анна, и я создаю интерьерную керамику как объект искусства, который поддерживает, вдохновляет и становится частью вашего личного пространства силы.",
      intro2:"Я верю, что предметы, с которыми мы живём, влияют на наше состояние.",
      btnCatalogue:"Каталог",
      btnWorkshops:"Мастер-классы",
      btnGiftCards:"Подарочные сертификаты",
      text1:"Мои вазы — это не просто формы, а предметы, которые меняют атмосферу дома.",
      text2:"В каждой работе — высокотемпературная глина, тактильные текстуры, бисерная вышивка и сочетание несовершенной формы с ощущением роскоши."
    },
    catalogue:{
      title:"Каталог",
      lead:"Каждое изделие — это уникальная эмоция для вашего пространства",
      viewPhotos:"Смотреть фото",
      spec:{height:"Высота",diameter:"Диаметр",material:"Материал",technique:"Техника",finish:"Покрытие"}
    },
    detail:{
      description:"Описание",
      characteristics:"Характеристики",
      delivery:"Доставка",
      deliveryText:"Мы отправляем изделия по всему миру."
    },
    status:{sold:"Продано"},
    contact:{title:"Контакты",address:"Адрес мастерской:"},
    footer:{made:"Сайт создан на GitHub Pages"}
  },

  it: {
    nav:{home:"Home",about:"Il brand",catalogue:"Catalogo",workshops:"Masterclass",contact:"Contatti"},
    hero:{tagline:"Ceramica tattile da interno con ricami di perle che trasforma la tua casa in un luogo di forza e ispirazione."},
    about:{
      title:"Il brand",
      intro1:"Mi chiamo Anna e creo ceramiche d’interni come oggetti d’arte che sostengono, ispirano e diventano parte del tuo spazio personale di forza.",
      intro2:"Credo che gli oggetti con cui viviamo influenzino il nostro stato interiore.",
      btnCatalogue:"Catalogo",
      btnWorkshops:"Masterclass",
      btnGiftCards:"Gift Card",
      text1:"I miei vasi non sono solo forme, ma oggetti che trasformano l’atmosfera della casa.",
      text2:"In ogni pezzo ci sono argille ad alta temperatura, texture tattili, ricami di perle e l’unione di forme imperfette con una sensazione di lusso."
    },
    catalogue:{
      title:"Catalogo",
      lead:"Ogni pezzo è un’emozione unica per il tuo spazio.",
      viewPhotos:"Vedi foto",
      spec:{height:"Altezza",diameter:"Diametro",material:"Materiale",technique:"Tecnica",finish:"Finitura"}
    },
    detail:{
      description:"Descrizione",
      characteristics:"Caratteristiche",
      delivery:"Spedizione",
      deliveryText:"Spediamo in tutto il mondo dalla Liguria."
    },
    status:{sold:"Venduto"},
    contact:{title:"Contatti",address:"Studio:"},
    footer:{made:"Realizzato con GitHub Pages"}
  },

  en: {
    nav:{home:"Home",about:"About",catalogue:"Catalogue",workshops:"Workshops",contact:"Contact"},
    hero:{tagline:"Tactile interior ceramics with bead embroidery that turns your home into a place of strength and inspiration."},
    about:{
      title:"About the brand",
      intro1:"My name is Anna and I create interior ceramics as art objects that support, inspire and become part of your personal space of strength.",
      intro2:"I believe the objects we live with shape our inner state.",
      btnCatalogue:"Catalogue",
      btnWorkshops:"Workshops",
      btnGiftCards:"Gift Cards",
      text1:"My vases are not just shapes, but pieces that transform the atmosphere of your home.",
      text2:"Each piece combines high-fire clays, tactile textures, bead embroidery and a sense of quiet luxury."
    },
    catalogue:{
      title:"Catalogue",
      lead:"Each piece is a unique emotion for your space.",
      viewPhotos:"View photos",
      spec:{height:"Height",diameter:"Diameter",material:"Material",technique:"Technique",finish:"Finish"}
    },
    detail:{
      description:"Description",
      characteristics:"Characteristics",
      delivery:"Shipping",
      deliveryText:"We ship worldwide from Liguria, Italy."
    },
    status:{sold:"Sold out"},
    contact:{title:"Contact",address:"Studio address:"},
    footer:{made:"Made with GitHub Pages"}
  }
};

/* ============================================================
   TRADUZIONI
============================================================ */
function applyTranslations(lang){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const keys = el.dataset.i18n.split(".");
    let value = messages[lang];
    for (const k of keys){
      if (value && value[k] != null) value = value[k];
    }
    if (typeof value === "string") el.textContent = value;
  });
}

function getInitialLang(){
  const saved = localStorage.getItem("lang");
  if (saved && messages[saved]) return saved;
  const browser = (navigator.language||"ru").slice(0,2);
  return messages[browser] ? browser : "ru";
}

function setLang(lang){
  localStorage.setItem("lang", lang);
  applyTranslations(lang);
  buildCatalogue();

  // aggiorna il selettore lingua
  const sel = document.getElementById("language-selector");
  if (sel) sel.value = lang;
}

/* ============================================================
   MENU MOBILE
============================================================ */
function initMobileNav(){
  const btn = document.getElementById("nav-toggle");
  if (!btn) return;
  btn.addEventListener("click", ()=>{
    document.body.classList.toggle("nav-open");
  });
  document.querySelectorAll("nav a").forEach(a=>{
    a.addEventListener("click", ()=>{
      document.body.classList.remove("nav-open");
    });
  });
}

/* ============================================================
   TOGGLE DESKTOP/MOBILE-VIEW
============================================================ */
function initViewToggle(){
  const btn = document.getElementById("view-toggle-btn");
  if (!btn) return;

  if (window.innerWidth < 768){
    document.body.classList.add("mobile-view");
    btn.textContent = "Desktop";
  } else {
    btn.textContent = "Mobile";
  }

  btn.addEventListener("click", ()=>{
    document.body.classList.toggle("mobile-view");
    btn.textContent = document.body.classList.contains("mobile-view")
      ? "Desktop"
      : "Mobile";
  });
}

/* ============================================================
   CSV Loader
============================================================ */
async function loadCSV(url){
  const res = await fetch(url);
  const text = await res.text();
  const rows = text.split("\n").map(r=>r.trim()).filter(r=>r.length>0);
  const headers = rows[0].split(",");
  return rows.slice(1).map(row=>{
    const cols = row.split(",");
    const obj = {};
    headers.forEach((h,i)=> obj[h.trim()] = cols[i] ? cols[i].trim() : "-");
    return obj;
  });
}

/* ============================================================
   COSTRUZIONE DINAMICA CATALOGO + MODALI
============================================================ */
async function buildCatalogue(){
  const lang = getInitialLang();
  const items = await loadCSV("catalogue/vasi.csv");

  // Ordinamento: prima non venduti, poi venduti
  items.sort((a,b)=> (a.venduto==="si") - (b.venduto==="si"));

  const grid = document.getElementById("catalogue-grid");
  const modalRoot = document.getElementById("modal-container");

  if (!grid) {
    console.warn("catalogue-grid non trovato nel DOM");
    return;
  }

  grid.innerHTML = "";
  if (modalRoot) modalRoot.innerHTML = "";

  items.forEach(vase => {
    const name  = vase[`name_${lang}`]  && vase[`name_${lang}`]  !== "-" ? vase[`name_${lang}`]  : vase.name_ru;
    const short = vase[`short_${lang}`] && vase[`short_${lang}`] !== "-" ? vase[`short_${lang}`] : vase.short_ru;
    const long  = vase[`long_${lang}`]  && vase[`long_${lang}`]  !== "-" ? vase[`long_${lang}`]  : vase.long_ru;

    const sold = (vase.venduto || "").trim().toLowerCase() === "si";

    const img1 = vase.img1 && vase.img1 !== "-" ? `images/catalogue/${vase.img1}` : "images/placeholder.jpg";

    const priceOldStr = vase.price_old && vase.price_old !== "-" ? vase.price_old : null;
    const priceNewStr = vase.price_new && vase.price_new !== "-" ? vase.price_new : null;

    // Calcolo sconto in % se possibile
    let discount = null;
    if (!sold && priceOldStr && priceNewStr){
      const oldNum = parseFloat(String(priceOldStr).replace(",", "."));
      const newNum = parseFloat(String(priceNewStr).replace(",", "."));
      if (!isNaN(oldNum) && !isNaN(newNum) && oldNum > newNum){
        discount = Math.round((1 - newNum/oldNum)*100);
        if (discount <= 0) discount = null;
      }
    }

    /* ---------- CARD CATALOGO ---------- */
    let cardStatusBlock = "";

    if (sold){
      cardStatusBlock = `
        <div class="card-sold">
          ${messages[lang].status.sold}
        </div>
      `;
    } else if (priceNewStr){
      let discountBlock = "";
      if (discount){
        discountBlock = `<span class="discount-badge">-${discount}%</span>`;
      }
      cardStatusBlock = `
        <div class="card-price">
          ${priceOldStr ? `<span class="old-price">${priceOldStr}€</span>` : ""}
          <span class="new-price">${priceNewStr}€</span>
          ${discountBlock}
        </div>
      `;
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
        <button class="buy" data-modal-target="modal-${vase.id}">
          ${messages[lang].catalogue.viewPhotos}
        </button>
      </div>
    `;

    grid.appendChild(card);

    /* ---------- IMMAGINI MODALE ---------- */
    const imgs = [
      vase.img1,vase.img2,vase.img3,
      vase.img4,vase.img5,vase.img6
    ].filter(x => x && x !== "-");

    const gallery = imgs.map((img,i)=>`
      <img src="images/catalogue/${img}" data-slide="${i}" class="${i===0?"active":""}">
    `).join("");

    /* ---------- PREZZO / VENDUTO IN MODALE ---------- */
    let modalPriceBlock = "";

    if (sold){
      modalPriceBlock = `
        <div class="vase-status-sold">
          ${messages[lang].status.sold}
        </div>
      `;
    } else if (priceNewStr){
      let modalDiscount = "";
      if (discount){
        modalDiscount = `<span class="discount-badge modal-discount">-${discount}%</span>`;
      }
      modalPriceBlock = `
        <div class="vase-price-row">
          ${priceOldStr ? `<span class="vase-old-price">${priceOldStr}€</span>` : ""}
          <span class="vase-price">${priceNewStr}€</span>
          ${modalDiscount}
        </div>
      `;
    }

    /* ---------- MODALE ---------- */
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = `modal-${vase.id}`;

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h4>${name}</h4>
          <button data-modal-close>×</button>
        </div>

        <div class="modal-body">
          <div class="modal-body-inner">

            <div class="vase-detail-panel">
              <h2 class="vase-title">${name}</h2>
              <p>${short}</p>

              ${modalPriceBlock}

              <div class="accordion">

                <button class="accordion-header">
                  ${messages[lang].detail.description}
                  <span>›</span>
                </button>
                <div class="accordion-panel">${long}</div>

                <button class="accordion-header">
                  ${messages[lang].detail.characteristics}
                  <span>›</span>
                </button>
                <div class="accordion-panel">
                  <dl>
                    <dt>${messages[lang].catalogue.spec.height}</dt><dd>${vase.height || "-"}</dd>
                    <dt>${messages[lang].catalogue.spec.diameter}</dt><dd>${vase.diameter || "-"}</dd>
                    <dt>${messages[lang].catalogue.spec.material}</dt><dd>${vase.material || "-"}</dd>
                    <dt>${messages[lang].catalogue.spec.technique}</dt><dd>${vase.technique || "-"}</dd>
                    <dt>${messages[lang].catalogue.spec.finish}</dt><dd>${vase.finish || "-"}</dd>
                  </dl>
                </div>

                <button class="accordion-header">
                  ${messages[lang].detail.delivery}
                  <span>›</span>
                </button>
                <div class="accordion-panel">
                  ${messages[lang].detail.deliveryText}
                </div>

              </div>
            </div>

            <div class="modal-gallery">
              <div class="modal-gallery-main">
                ${gallery}
              </div>
              <div class="modal-gallery-controls">
                <button data-gallery-prev>←</button>
                <span data-gallery-counter">1 / ${imgs.length}</span>
                <button data-gallery-next>→</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    if (modalRoot) {
      modalRoot.appendChild(modal);
    }
  });

  initModals();
  initAccordion();
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
      btn.closest(".modal").classList.remove("open");
    });
  });

  document.querySelectorAll(".modal").forEach(modal=>{
    modal.addEventListener("click", e=>{
      if (e.target === modal) modal.classList.remove("open");
    });

    const main = modal.querySelector(".modal-gallery-main");
    if (!main) return;

    const slides = [...main.querySelectorAll("img[data-slide]")];
    let index = 0;
    const counter = modal.querySelector("[data-gallery-counter]");

    const update = ()=>{
      slides.forEach((img,i)=> img.classList.toggle("active", i===index));
      if (counter) counter.textContent = `${index+1} / ${slides.length}`;
    };

    update();

    modal.querySelector("[data-gallery-prev]")?.addEventListener("click", ()=>{
      index = (index - 1 + slides.length) % slides.length;
      update();
    });

    modal.querySelector("[data-gallery-next]")?.addEventListener("click", ()=>{
      index = (index + 1) % slides.length;
      update();
    });
  });
}

/* ============================================================
   ACCORDION
============================================================ */
function initAccordion(){
  document.querySelectorAll(".accordion").forEach(acc=>{
    acc.querySelectorAll(".accordion-header").forEach(h=>{
      h.addEventListener("click", ()=>{
        const panel = h.nextElementSibling;
        const open = panel.classList.contains("active");
        acc.querySelectorAll(".accordion-panel").forEach(p=>p.classList.remove("active"));
        if (!open) panel.classList.add("active");
      });
    });
  });
}

/* ============================================================
   INIT SITO
============================================================ */
window.appInit = function(){
  const lang = getInitialLang();
  applyTranslations(lang);
  const sel = document.getElementById("language-selector");
  if (sel) sel.value = lang;
  initViewToggle();
  initMobileNav();
  buildCatalogue();
}

/* ============================================================
   CAMBIO LINGUA
============================================================ */
document.addEventListener("change", e=>{
  if (e.target.id === "language-selector"){
    setLang(e.target.value);
  }
});

