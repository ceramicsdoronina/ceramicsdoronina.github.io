// app.js
async function appInit() {
  // lingua
  CD.i18n.initLanguage();

  // catalogo
  try {
    const items = await CD.catalogue.loadCsv();
    window.__catalogueData = items;
    CD.catalogue.render(items, CD.i18n.getCurrentLang());
    CD.catalogue.initBehaviour();
  } catch (err) {
    console.error("Errore nel caricamento del catalogo", err);
  }

  // UI
  CD.ui.initNavbarToggle();
  CD.ui.initViewToggle();
}

// deve essere visibile a importer.js
window.appInit = appInit;

