// === CONFIGURA QUI I TUOI LINK ETSY ===
const ETSY_SHOP_URL = 'https://www.etsy.com/shop/IlTuoNegozio';
const ETSY_LISTINGS = {
  p1: 'https://www.etsy.com/listing/XXXXXXXXX',
  p2: 'https://www.etsy.com/listing/YYYYYYYYY',
  p3: 'https://www.etsy.com/listing/ZZZZZZZZZ'
};

// Applica i link Etsy
window.addEventListener('DOMContentLoaded', () => {
  const map = [['buy-p1', 'p1'], ['buy-p2', 'p2'], ['buy-p3', 'p3']];
  map.forEach(([btnId, key]) => {
    const a = document.getElementById(btnId);
    if(a && ETSY_LISTINGS[key]) a.href = ETSY_LISTINGS[key];
  });
  const shopCard = document.getElementById('etsy-shop-card');
  if (shopCard && ETSY_SHOP_URL) shopCard.href = ETSY_SHOP_URL;
});

// === DIZIONARIO TRADUZIONI (IT / EN / RU) ===
const messages = {
  it: {
    nav:{home:"Home",collection:"Collezione",catalogue:"Catalogo",about:"Chi siamo",contact:"Contatti"},
    hero:{title:"Ceramiche fatte a mano ispirate al wabi-sabi",text:"Ogni pezzo è unico, modellato a mano a Genova. Forme imperfette, superfici tattili, dettagli barocchi come perle e finiture che richiamano la natura.",ctaBrowse:"Vedi collezione",ctaShop:"Acquista"},
    collection:{title:"Collezione",lead:"Selezione di vasi, tazze e piatti. Ogni opera può essere personalizzata su richiesta."},
    catalogue:{
      title:"Catalogo",
      lead:"Panoramica dettagliata dei vasi con più foto per ogni pezzo.",
      viewPhotos:"Vedi foto",
      specTitle:"Specifiche",
      spec:{
        height:"Altezza",
        diameter:"Diametro",
        material:"Materiale",
        technique:"Tecnica",
        finish:"Finitura"
      }
    },
    view:{
      mobileInfo:"Stai visualizzando la versione ottimizzata per cellulare.",
      toDesktop:"Vai alla versione completa",
      desktopInfo:"Stai visualizzando la versione completa per computer.",
      toMobile:"Vai alla versione cellulare",
      shortDesktop:"Desktop",
      shortMobile:"Mobile"
    },
    p1:{name:"Vaso Avorio",desc:"Superficie sabbiata, dettagli perlacei."},
    p2:{name:"Tazza Mare",desc:"Smalto blu profondo, interno lucido."},
    p3:{name:"Piatto Onde",desc:"Bordo irregolare, texture naturale."},
    cat:{
      v1:{name:"Accetto Rosso", desc:"Vaso medio in gres, smalto rosso profondo con accenti materici."},
      v2:{name:"Ракушка",      desc:"Forma morbida ispirata a una conchiglia, smalti chiari e tattili."},
      v3:{name:"Липия",        desc:"Vaso slanciato, superfici leggere con dettagli organici."}
    },
    common:{buy:"Compra su Etsy"},
    about:{title:"Chi siamo",text1:"Ceramics Doronina nasce in Liguria, tra mare e colline. La formazione in Toscana e le radici familiari nella scultura si intrecciano in pezzi che uniscono semplicità e accenti barocchi.",text2:"Crediamo nella bellezza dell’imperfezione: ogni crepa lieve, ogni asimmetria racconta un gesto umano. Realizziamo anche pezzi su misura per interni e hotellerie."},
    shop:{title:"Negozio",lead:"Acquista direttamente su Etsy oppure dalla collezione qui sopra. I pulsanti “Compra su Etsy” ti portano alle singole inserzioni.",etsyTitle:"Etsy · Negozio ufficiale",etsy:"Sfoglia tutto il catalogo, opzioni di spedizione e pagamenti protetti.",visit:"Visita negozio",custom:"Richieste su misura",customDesc:"Scrivici per commissioni personalizzate.",cartTitle:"Hai già il tuo carrello su Etsy",cartDesc:"Quando aggiungi un prodotto su Etsy, il checkout rimane su Etsy per la massima sicurezza.",etsySecure:"Pagamenti e spedizioni gestiti in sicurezza su Etsy"},
    contact:{title:"Contatti",address:"Studio:"},
    footer:{made:"Realizzato con GitHub Pages"}
  },
  en: {
    nav:{home:"Home",collection:"Collection",catalogue:"Catalogue",about:"About",contact:"Contact"},
    hero:{title:"Handmade ceramics inspired by wabi-sabi",text:"Each piece is unique, hand-shaped in Genoa. Imperfect forms, tactile surfaces, baroque details like pearls and finishes that recall nature.",ctaBrowse:"View collection",ctaShop:"Shop now"},
    collection:{title:"Collection",lead:"Selection of vases, cups, and plates. Each work can be customized upon request."},
    catalogue:{
      title:"Catalogue",
      lead:"Detailed overview of vases with multiple photos for each piece.",
      viewPhotos:"View photos",
      specTitle:"Specifications",
      spec:{
        height:"Height",
        diameter:"Diameter",
        material:"Material",
        technique:"Technique",
        finish:"Finish"
      }
    },
    view:{
      mobileInfo:"You are viewing the mobile-optimized version.",
      toDesktop:"Go to full version",
      desktopInfo:"You are viewing the full desktop version.",
      toMobile:"Switch to mobile version",
      shortDesktop:"Desktop",
      shortMobile:"Mobile"
    },
    p1:{name:"Ivory Vase",desc:"Sanded surface, pearly details."},
    p2:{name:"Sea Cup",desc:"Deep blue glaze, glossy interior."},
    p3:{name:"Waves Plate",desc:"Irregular rim, natural texture."},
    cat:{
      v1:{name:"Accetto Rosso", desc:"Medium stoneware vase with deep red glaze and tactile accents."},
      v2:{name:"Ракушка",       desc:"Soft shell-inspired form with light, tactile glazes."},
      v3:{name:"Липия",         desc:"Tall, slender vase with organic surface details."}
    },
    common:{buy:"Buy on Etsy"},
    about:{title:"About us",text1:"Ceramics Doronina was born in Liguria, between the sea and the hills. Training in Tuscany and family roots in sculpture intertwine in pieces that combine simplicity with baroque accents.",text2:"We believe in the beauty of imperfection: every slight crack, every asymmetry tells a human gesture. We also create bespoke pieces for interiors and hospitality."},
    shop:{title:"Shop",lead:"Buy directly on Etsy or from the collection above. The “Buy on Etsy” buttons take you to individual listings.",etsyTitle:"Etsy · Official Shop",etsy:"Browse the full catalog, shipping options, and secure payments.",visit:"Visit Shop",custom:"Custom Requests",customDesc:"Write to us for personalized commissions.",cartTitle:"Your cart is on Etsy",cartDesc:"When you add a product on Etsy, checkout remains on Etsy for maximum security.",etsySecure:"Payments and shipping securely managed on Etsy"},
    contact:{title:"Contact",address:"Studio:"},
    footer:{made:"Made with GitHub Pages"}
  },
  ru: {
    nav:{home:"Главная",collection:"Коллекция",catalogue:"Каталог",about:"О нас",contact:"Контакты"},
    hero:{title:"Керамика ручной работы в духе ваби-саби",text:"Каждое изделие уникально, создано вручную в Генуе. Неровные формы, тактильные поверхности, барочные акценты — жемчуг и природные фактуры.",ctaBrowse:"Смотреть коллекцию",ctaShop:"Магазин"},
    collection:{title:"Коллекция",lead:"Подборка ваз, чаш и тарелок. Возможны индивидуальные заказы."},
    catalogue:{
      title:"Каталог",
      lead:"Подробный обзор ваз с несколькими фотографиями каждого изделия.",
      viewPhotos:"Смотреть фото",
      specTitle:"Характеристики",
      spec:{
        height:"Высота",
        diameter:"Диаметр",
        material:"Материал",
        technique:"Техника",
        finish:"Покрытие"
      }
    },
    view:{
      mobileInfo:"Вы просматриваете мобильную версию сайта.",
      toDesktop:"Перейти к полной версии",
      desktopInfo:"Вы просматриваете полную версию сайта.",
      toMobile:"Перейти к мобильной версии",
      shortDesktop:"Десктоп",
      shortMobile:"Мобайл"
    },
    p1:{name:"Ваза Ivory",desc:"Песчаная поверхность, перламутровые детали."},
    p2:{name:"Чаша Mare",desc:"Глубокая синяя глазурь, блестящая внутренняя часть."},
    p3:{name:"Тарелка Waves",desc:"Неровный край, естественная текстура."},
    cat:{
      v1:{name:"Accetto Rosso", desc:"Средняя ваза из шамота с насыщенной красной глазурью и фактурными акцентами."},
      v2:{name:"Ракушка",       desc:"Мягкая форма, вдохновлённая ракушкой, светлые тактильные глазури."},
      v3:{name:"Липия",         desc:"Высокая изящная ваза с органичными поверхностными деталями."}
    },
    common:{buy:"Купить на Etsy"},
    about:{title:"О нас",text1:"Ceramics Doronina родилась в Лигурии, между морем и холмами. Учёба в Тоскане и семейные традиции скульптуры проявляются в работах, сочетающих простоту и барочные акценты.",text2:"Мы ценим красоту несовершенства: лёгкие трещинки и асимметрии — следы живого жеста. Выполняем заказы для интерьеров и отелей."},
    shop:{title:"Магазин",lead:"Покупайте напрямую на Etsy или через карточки коллекции выше — кнопка ведёт на конкретный лот.",etsyTitle:"Etsy · Официальный магазин",etsy:"Смотрите весь каталог, условия доставки и безопасные платежи.",visit:"Посетить магазин",custom:"Индивидуальные заказы",customDesc:"Пишите нам по персональным проектам.",cartTitle:"Ваша корзина на Etsy",cartDesc:"При добавлении товара оформление заказа происходит на Etsy для максимальной безопасности.",etsySecure:"Безопасные платежи и доставка через Etsy"},
    contact:{title:"Контакты",address:"Мастерская:"},
    footer:{made:"Сайт на GitHub Pages"}
  }
};

// Traduzioni
const translateAll = (lang) => {
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const path = el.getAttribute('data-i18n').split('.');
    let txt = messages[lang];
    for(const p of path){ txt = txt && txt[p]; }
    if(typeof txt === 'string'){ el.textContent = txt; }
  });
};

const updateViewToggleLabel = () => {
  const btn = document.getElementById('view-toggle-btn');
  if (!btn) return;
  const lang = document.documentElement.lang || 'it';
  const mode = document.body.classList.contains('mobile-view') ? 'mobile' : 'desktop';
  const cfg = messages[lang] && messages[lang].view;
  if (!cfg) return;
  if (mode === 'mobile') {
    btn.textContent = cfg.shortDesktop;
    btn.setAttribute('aria-label', cfg.toDesktop);
  } else {
    btn.textContent = cfg.shortMobile;
    btn.setAttribute('aria-label', cfg.toMobile);
  }
};

const setLang = (lang) => {
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  const sel = document.getElementById('language-selector');
  if (sel) sel.value = lang;
  translateAll(lang);
  updateViewToggleLabel();
};

const getPreferredLanguage = () => {
  const saved = localStorage.getItem('lang');
  if (saved && messages[saved]) {
    return saved;
  }
  const browserLang = (navigator.language || navigator.userLanguage).split('-')[0];
  if (messages[browserLang]) {
    return browserLang;
  }
  return 'it';
};

// === VIEW MODE (DESKTOP / MOBILE) ===
const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const applyViewMode = () => {
  const stored = localStorage.getItem('viewMode');
  const mode = stored || (isMobileDevice ? 'mobile' : 'desktop');
  document.body.classList.toggle('mobile-view', mode === 'mobile');
  document.body.classList.toggle('desktop-view', mode === 'desktop');
  updateViewToggleLabel();
};

const setViewMode = (mode) => {
  localStorage.setItem('viewMode', mode);
  applyViewMode();
};

window.addEventListener('DOMContentLoaded', () => {
  // Inizializzazione lingua + view mode
  setLang(getPreferredLanguage());
  applyViewMode();

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Cambio lingua
  const langSel = document.getElementById('language-selector');
  if (langSel) {
    langSel.addEventListener('change', (e) => {
      setLang(e.target.value);
    });
  }

  // Toggle piccolo in basso a destra
  const toggleBtn = document.getElementById('view-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const mode = document.body.classList.contains('mobile-view') ? 'mobile' : 'desktop';
      setViewMode(mode === 'mobile' ? 'desktop' : 'mobile');
    });
  }

  // === MODAL & GALLERY LOGIC ===
  const openButtons = document.querySelectorAll('[data-modal-target]');
  const closeButtons = document.querySelectorAll('[data-modal-close]');
  const modals = document.querySelectorAll('.modal');

  openButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-modal-target');
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.add('open');
      }
    });
  });

  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) modal.classList.remove('open');
    });
  });

  modals.forEach(modal => {
    modal.addEventListener('click', () => {
      modal.classList.remove('open');
    });
    const dialog = modal.querySelector('.modal-dialog');
    if (dialog) {
      dialog.addEventListener('click', e => e.stopPropagation());
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Gallery navigation per ogni modal
  modals.forEach(modal => {
    const slides = Array.from(modal.querySelectorAll('[data-slide]'));
    if (!slides.length) return;

    let index = 0;
    const counter = modal.querySelector('[data-gallery-counter]');
    const total = slides.length;

    const show = (i) => {
      slides.forEach((img, idx) => {
        img.classList.toggle('active', idx === i);
      });
      if (counter) {
        counter.textContent = (i+1) + ' / ' + total;
      }
    };
    show(0);

    const prevBtn = modal.querySelector('[data-gallery-prev]');
    const nextBtn = modal.querySelector('[data-gallery-next]');

    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        index = (index - 1 + total) % total;
        show(index);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        index = (index + 1) % total;
        show(index);
      });
    }
  });
});
