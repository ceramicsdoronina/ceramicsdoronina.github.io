/* ============================================================
   LINGUE – dizionario di traduzione
============================================================ */

const messages = {
  ru: {
    nav: {
      home: "Главная",
      about: "О бренде",
      catalogue: "Каталог",
      workshops: "Мастер-классы",
      giftcards: "Подарочные сертификаты",
      contact: "Контакты"
    },
    hero: {
  	h1: {
    		it: "Ceramica artistica contemporanea fatta a mano – Ceramics Doronina",
    		en: "Handmade contemporary artistic ceramics – Ceramics Doronina",
    		ru: "Современная художественная керамика ручной работы – Ceramics Doronina"
  	},
      tagline: "Тактильная интерьерная керамика с бисерной вышивкой, которая превратит ваш дом в место силы и вдохновения."
    },
    about: {
      title: "О бренде",
      intro1: "Меня зовут Анна, и я создаю интерьерную керамику как объект искусства, который поддерживает, вдохновляет и становится частью вашего личного пространства силы.",
      intro2: "Я верю, что предметы, с которыми мы живём, влияют на наше состояние.",
      btnCatalogue: "Каталог",
      btnWorkshops: "Мастер-классы",
      btnGiftCards: "Подарочные сертификаты",
      text1: "Мои вазы — это не просто формы, а предметы, которые меняют атмосферу дома.",
      text2: "В каждой работе — высокотемпературная глина, тактильные текстуры, бисерная вышивка и сочетание несовершенных форм с ощущением роскоши."
    },
    catalogue: {
      title: "Каталог",
      lead: "Каждое изделие — это уникальная эмоция для вашего пространства",
      // BOTTONI CARD
      addToCart: "Купить",        // bottone pieno rosso
      viewPhotos: "Подробнее",    // bottone bianco bordo rosso
      spec: {
        height: "Высота",
        diameter: "Диаметр",
        material: "Материал",
        technique: "Техника",
        finish: "Покрытие"
      }
    },
    detail: {
      description: "Описание",
      characteristics: "Характеристики",
      delivery: "Доставка",
      deliveryText: "Отправляем по всему миру из Лигурии, надёжно упаковывая каждое изделие."
    },
    workshops: {
      title: "Мастер-Классы",
      scheduleTitle: "Ближайшие мастер-классы",
      scheduleLead: "Выберите дату и напишите мне, чтобы присоединиться к мастер-классу в небольших группах в моей студии в Генуе.",
      lead: "Керамические мастер-классы в маленьких группах в атмосфере внимания и спокойствия.",
      list1: "Индивидуальные и групповые занятия в студии в Генуе.",
      list2: "Формы, тактильные поверхности, работа с глазурями и декором.",
      list3: "Формат для компаний и частных мероприятий по запросу.",
      details: "Подробнее",
      note: "За актуальным расписанием и для организации частного мастер-класса напишите мне.",
      cta: "Записаться"
    },
    giftcards: {
      title: "ПОДАРОЧНЫЕ СЕРТИФИКАТЫ",
      lead: "Подарите эмоцию прикосновения к глине или выбор керамического объекта для дома.",
      list1: "Сертификат на участие в мастер-классе.",
      list2: "Сертификат на готовое изделие или персональный заказ.",
      list3: "Электронный формат или оформленная карточка, готовая к вручению.",
      note: "Напишите мне, чтобы подобрать формат сертификата под ваш запрос.",
      cardsTitle: "Доступны подарочные сертификаты",
      cardsLead: "Выберите номинал и напишите мне, чтобы оформить сертификат.",
      buy: "Купить",
      details: "Подробнее",
      modalTitle: "Подарочный сертификат",
      cta: "Написать насчёт сертификата"
    },
    status: {
      sold: "Продано"
    },
    contact: {
      title: "Контакты",
      addressLabel: "Адрес",
      addressValue: "Via San Lorenzo 7/5 Sc. Dx, 16123 Генуя",
      countrySuffix: ", Италия",
      phoneLabel: "Телефонный номер",
      emailLabel: "Почта",
      hoursLabel: "График работы",
      hoursDays: "Пн–Пт",
      hoursFrom: "10:00",
      hoursTo: "19:00"
    },
    footer: {
      made: "Сайт на GitHub Pages"
    }
  },

  it: {
    nav: {
      home: "Home",
      about: "Il brand",
      catalogue: "Catalogo",
      workshops: "Workshop",
      giftcards: "Carte Regalo",
      contact: "Contatti"
    },
    hero: {
      tagline: "Ceramica tattile da interno con ricami di perle che trasforma la tua casa in un luogo di forza e ispirazione."
    },
    about: {
      title: "Il brand",
      intro1: "Mi chiamo Anna e creo ceramiche d’interni come oggetti d’arte che sostengono, ispirano e diventano parte del tuo spazio personale di forza.",
      intro2: "Credo che gli oggetti con cui viviamo influenzino il nostro stato interiore.",
      btnCatalogue: "Catalogo",
      btnWorkshops: "Masterclass",
      btnGiftCards: "Carte Regalo",
      text1: "I miei vasi non sono solo forme, ma oggetti che trasformano l’atmosfera della casa.",
      text2: "In ogni pezzo ci sono argille ad alta temperatura, superfici tattili, ricami di perle e l’unione di forme imperfette con una sensazione di lusso."
    },
    catalogue: {
      title: "Catalogo",
      lead: "Ogni pezzo è un’emozione unica per il tuo spazio.",
      addToCart: "Compra",      // rosso pieno
      viewPhotos: "Dettagli",   // bianco bordo rosso
      spec: {
        height: "Altezza",
        diameter: "Diametro",
        material: "Materiale",
        technique: "Tecnica",
        finish: "Finitura"
      }
    },
    detail: {
      description: "Descrizione",
      characteristics: "Caratteristiche",
      delivery: "Spedizione",
      deliveryText: "Spediamo in tutto il mondo dalla Liguria, con imballaggio protettivo."
    },
    workshops: {
      title: "Workshop",
      scheduleTitle: "Workshop in programma",
      scheduleLead: "Scegli una data e scrivimi per partecipare a una masterclass in piccoli gruppi nel mio studio a Genova.",
      lead: "Workshop di ceramica in piccoli gruppi, in un’atmosfera di cura e tranquillità.",
      list1: "Percorsi individuali e di gruppo nel mio studio a Genova.",
      list2: "Forme, superfici tattili, lavoro con smalti e decorazioni.",
      list3: "Format per aziende ed eventi privati su richiesta.",
      note: "Per il calendario aggiornato o per organizzare una masterclass privata, scrivimi.",
      details: "Dettagli",
      cta: "Scrivimi"
    },
    giftcards: {
      title: "CARTE REGALO",
      lead: "Regala l’emozione di lavorare con l’argilla o di scegliere un oggetto in ceramica per la casa.",
      list1: "Buono per partecipare a un workshop.",
      list2: "Buono per un pezzo finito o per una commissione su misura.",
      list3: "Formato digitale o stampata pronta da regalare.",
      note: "Scrivimi per trovare insieme il formato di carta regalo più adatto.",
      cardsTitle: "Carte regalo disponibili",
      cardsLead: "Scegli l’importo e richiedi la carta regalo.",
      buy: "Compra",
      details: "Dettagli",
      modalTitle: "Carte regalo",
      cta: "Scrivimi per una carta regalo"
    },
    status: {
      sold: "Venduto"
    },
    contact: {
      title: "Contatti",
      addressLabel: "Indirizzo",
      addressValue: "Via San Lorenzo 7/5 Sc. Dx, 16123 Genova",
      countrySuffix: " (Italia)",
      phoneLabel: "Numero di telefono",
      emailLabel: "Email",
      hoursLabel: "Orari",
      hoursDays: "Lun–Ven",
      hoursFrom: "10:00",
      hoursTo: "19:00"
    },
    footer: {
      made: "Realizzato con GitHub Pages"
    }
  },

  en: {
    nav: {
      home: "Home",
      about: "About",
      catalogue: "Catalogue",
      workshops: "Masterclass",
      giftcards: "Gift Cards",
      contact: "Contact"
    },
    hero: {
      tagline: "Tactile interior ceramics with pearl embroidery that turns your home into a place of strength and inspiration."
    },
    about: {
      title: "About the brand",
      intro1: "My name is Anna, and I create interior ceramics as art objects that support, inspire, and become part of your personal space of strength.",
      intro2: "I believe that the objects we live with influence our inner state.",
      btnCatalogue: "Catalogue",
      btnWorkshops: "Masterclass",
      btnGiftCards: "Gift Cards",
      text1: "My vases are not just shapes, but objects that transform the atmosphere of a home.",
      text2: "Each piece combines high-temperature clays, tactile textures, bead embroidery, and the meeting of imperfect forms with a sense of luxury."
    },
    catalogue: {
      title: "Catalogue",
      lead: "Each piece is a unique emotion for your space.",
      addToCart: "Buy",
      viewPhotos: "Details",
      spec: {
        height: "Height",
        diameter: "Diameter",
        material: "Material",
        technique: "Technique",
        finish: "Finish"
      }
    },
    detail: {
      description: "Description",
      characteristics: "Characteristics",
      delivery: "Shipping",
      deliveryText: "We ship worldwide from Liguria, Italy."
    },
    workshops: {
      title: "Workshops",
      scheduleTitle: "Upcoming workshops",
      scheduleLead: "Choose a date and write to me to join a small group masterclass in my studio in Genoa.",
      lead: "Ceramic workshops in small groups, in a calm and attentive atmosphere.",
      list1: "Individual and group sessions in my studio in Genoa.",
      list2: "Forms, tactile surfaces, working with glazes and decoration.",
      list3: "Formats for companies and private events upon request.",
      note: "For the updated calendar or to organise a private masterclass, write to me.",
      details: "Details",
      cta: "Write me to join"
    },
    giftcards: {
      title: "GIFT CARDS",
      lead: "Offer the emotion of working with clay or choosing a ceramic object for the home.",
      list1: "Voucher for attending a masterclass.",
      list2: "Voucher for a finished piece or a bespoke commission.",
      list3: "Digital format or printed card ready to gift.",
      note: "Write to me to find the most suitable gift card format for you.",
      cardsTitle: "Available Gift Cards",
      cardsLead: "Choose an amount and request a gift card.",
      buy: "Buy",
      details: "Details",
      modalTitle: "Gift Card",
      cta: "Write for a Gift Card"
    },
    status: {
      sold: "Sold out"
    },
    contact: {
      title: "Contacts",
      addressLabel: "Address",
      addressValue: "Via San Lorenzo 7/5 Sc. Dx, 16123 Genoa",
      countrySuffix: ", Italy",
      phoneLabel: "Phone number",
      emailLabel: "Email",
      hoursLabel: "Opening hours",
      hoursDays: "Mon–Fri",
      hoursFrom: "10:00",
      hoursTo: "19:00"
    },
    footer: {
      made: "Made with GitHub Pages"
    }
  }
};

window.messages = messages;

