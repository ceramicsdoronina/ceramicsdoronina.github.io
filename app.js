// app.js
async function appInit() {
  console.log("[APP] Inizializzazione app...");

  // lingua
  CD.i18n.initLanguage();
  const currentLang = CD.i18n.getCurrentLang();

  console.log("[APP] Lingua corrente:", currentLang);

  try {
    // carica in parallelo catalogo vasi e masterclass
    const [catalogueItems, masterclassItems, certificatiItems] = await Promise.all([
      CD.catalogue.loadCsv(),
      console.log("[APP] Catalogo caricato:", catalogue.length, "items"),
      CD.masterclass ? CD.masterclass.loadCsv() : Promise.resolve([]),
      CD.certificati ? CD.certificati.loadCsv() : Promise.resolve([])
    ]);

    window.__catalogueData   = catalogueItems;
    window.__masterclassData = masterclassItems;
    window.__certificatiData = certificatiItems;

    // vasi
    CD.catalogue.render(catalogueItems, currentLang);

    // masterclass
    if (CD.masterclass && masterclassItems.length) {
      CD.masterclass.render(masterclassItems, currentLang);
    }

    if (CD.certificati && certificatiItems.length) {
      CD.certificati.render(certificatiItems, currentLang);
    }

    // inizializza modali / accordion / gallery
    CD.catalogue.initBehaviour();

  } catch (err) {
    console.error("Errore nel caricamento dei dati (catalogo/masterclass)", err);
  }

  // UI
  CD.ui.initNavbarToggle();
  CD.ui.initViewToggle();
}

// deve essere visibile a importer.js
window.appInit = appInit;

