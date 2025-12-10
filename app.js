// app.js
async function appInit() {
  // lingua
  CD.i18n.initLanguage();
  const currentLang = CD.i18n.getCurrentLang();

  try {
    // carica in parallelo catalogo vasi e masterclass
    const [catalogueItems, masterclassItems] = await Promise.all([
      CD.catalogue.loadCsv(),
      CD.masterclass ? CD.masterclass.loadCsv() : Promise.resolve([])
    ]);

    window.__catalogueData   = catalogueItems;
    window.__masterclassData = masterclassItems;

    // vasi
    CD.catalogue.render(catalogueItems, currentLang);

    // masterclass
    if (CD.masterclass && masterclassItems.length) {
      CD.masterclass.render(masterclassItems, currentLang);
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

