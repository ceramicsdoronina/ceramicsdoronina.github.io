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
      intro1:"Mi chiamo Anna e creo ceramiche d’interni come oggetti d’arte.",
      intro2:"Credo che gli oggetti con cui viviamo influenzino il nostro stato interiore.",
      btnCatalogue:"Catalogo",
      btnWorkshops:"Masterclass",
      btnGiftCards:"Gift Card",
      text1:"I miei vasi non sono solo forme, ma oggetti che trasformano l’atmosfera.",
      text2:"In ogni pezzo ci sono argille ad alta temperatura, texture tattili e ricami di perle."
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
    hero:{tagline:"Tactile interior ceramics with bead embroidery."},
    about:{
      title:"About the brand",
      intro1:"My name is Anna and I create interior ceramics as art objects.",
      intro2:"I believe the objects we live with shape our inner state.",
      btnCatalogue:"Catalogue",
      btnWorkshops:"Workshops",
      btnGiftCards:"Gift Cards",
      text1:"My vases transform the atmosphere of your home.",
      text2:"High-fire clays, textures, bead embroidery, quiet luxury."
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
      deliveryText:"We ship worldwide from Liguria."
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
    const path = el.dataset.i18n.split(".");
    let value = messages[lang];
    for (const p of path){
      if (value && value[p] != null){
        value = value[p];
      }
    }
    if (typeof value === "string") el.textContent = value;
  });
}

function getInitialLang(){
  const saved = localStorage.getItem("lang");
  if (saved && messages[saved]) return saved;
  const browser = (navigator.language||"ru").slice(0,2);
  if (messages[browser]) return browser;
  return "ru";
}

function setLang(lang){
  localStorage.setItem("lang", lang);
  applyTranslations(lang);
  buildCatalogue();
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
    headers.forEach((h,i)=>{
      obj[h.trim()] = cols[i] ? cols[i].trim() : "-";
    });
    return obj;
  });
}


/* ============================================================
   COSTRUZIONE DINAMICA DEL CATALOGO + MODALI
============================================================ */

async function buildCatalogue(){
  const lang = getInitialLang();
  const items = await loadCSV("catalogue/vasi.csv");

  // ordinamento: prima disponibili, poi venduti
  items.sort((a,b)=> (a.venduto==="si") - (b.venduto==="si"));

  const grid = document.getElementById("catalogue-grid");
  const modalRoot = document.getElementById("modal-container");

  grid.innerHTML = "";
  modalRoot.innerHTML = "";

  items.forEach(vase => {

    const name = vase[`name_${lang}`] !== "-" ? vase[`name_${lang}`] : vase.name_ru;
    const short = vase[`short_${lang}`] !== "-" ? vase[`short_${lang}`] : vase.short_ru;
    const long = vase[`long_${lang}`] !== "-" ? vase[`long_${lang}`] : vase.long_ru;

    const img1 = vase.img1 !== "-" ? `images/catalogue/${vase.img1}` : "images/placeholder.jpg";

    const sold = vase.venduto==="si";

    const priceOld = vase.price_old !== "-" ? vase.price_old : null;
    const priceNew = vase.price_new !== "-" ? vase.price_new : null;

    /* ───── Card catalogo ───── */
    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <div class="media media-single" data-modal-target="modal-${vase.id}">
        <img src="${img1}" alt="${name}">
        ${sold ? `<div class="sold-badge">${messages[lang].status.sold}</div>` : ""}
      </div>

      <div class="body">
        <h4>${name}</h4>
        <p>${short}</p>

        ${priceNew ? `
          <div class="card-price">
            ${priceOld ? `<span class="old-price">${priceOld}€</span>` : ""}
            <span class="new-price">${priceNew}€</span>
          </div>
        ` : ""}

        <button class="buy" data-modal-target="modal-${vase.id}">
          ${messages[lang].catalogue.viewPhotos}
        </button>
      </div>
    `;

    grid.appendChild(card);


    /* ───── Modal con 6 immagini ───── */
    const imgs = [
      vase.img1,vase.img2,vase.img3,
      vase.img4,vase.img5,vase.img6
    ].filter(x=>x && x!=="-");

    const gallery = imgs.map((img,i)=>`
      <img src="images/catalogue/${img}" data-slide="${i}" class="${i===0?"active":""}">
    `).join("");

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = `modal-${vase.id}`;

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h4>${name}</h4>
          ${sold ? `<span class="sold-badge sold-badge-modal">${messages[lang].status.sold}</span>` : ""}
          <button data-modal-close>×</button>
        </div>

        <div class="modal-body">
          <div class="modal-body-inner">

            <div class="vase-detail-panel">
              <h2 class="vase-title">${name}</h2>
              <p>${short}</p>

              ${priceNew ? `
                <div class="vase-price-row">
                  ${priceOld ? `<span class="vase-old-price">${priceOld}€</span>` : ""}
                  <span class="vase-price">${priceNew}€</span>
                </div>
              ` : ""}

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
                    <dt>${messages[lang].catalogue.spec.height}</dt><dd>${vase.height}</dd>
                    <dt>${messages[lang].catalogue.spec.diameter}</dt><dd>${vase.diameter}</dd>
                    <dt>${messages[lang].catalogue.spec.material}</dt><dd>${vase.material}</dd>
                    <dt>${messages[lang].catalogue.spec.technique}</dt><dd>${vase.technique}</dd>
                    <dt>${messages[lang].catalogue.spec.finish}</dt><dd>${vase.finish}</dd>
                  </dl>
                </div>

                <button class="accordion-header">
                  ${messages[lang].detail.delivery}
                  <span>›</span>
                </button>
                <div class="accordion-panel">${messages[lang].detail.deliveryText}</div>

              </div>
            </div>

            <div class="modal-gallery">
              <div class="modal-gallery-main">${gallery}</div>

              <div class="modal-gallery-controls">
                <button data-gallery-prev>←</button>
                <span data-gallery-counter>1 / ${imgs.length}</span>
                <button data-gallery-next>→</button>
              </div>
            </div>

          </div>
        </div>

      </div>
    `;

    modalRoot.appendChild(modal);
  });

  initModals();
  initAccordion();
}


/* ============================================================
   MODALI E GALLERIA
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
      counter.textContent = `${index+1} / ${slides.length}`;
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
    const headers = acc.querySelectorAll(".accordion-header");
    headers.forEach(h=>{
      h.addEventListener("click", ()=>{
        const panel = h.nextElementSibling;
        const isOpen = panel.classList.contains("active");

        acc.querySelectorAll(".accordion-panel").forEach(p=>p.classList.remove("active"));

        if (!isOpen) panel.classList.add("active");
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

  initViewToggle();
  initMobileNav();
  buildCatalogue();
};


/* ============================================================
   CAMBIO LINGUA
============================================================ */

document.addEventListener("change", e=>{
  if (e.target.id === "language-selector"){
    setLang(e.target.value);
  }
});

