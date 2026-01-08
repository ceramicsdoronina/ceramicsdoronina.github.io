// app.js
async function appInit() {
  console.log("🚀 [APP] Inizializzazione app...");

  // lingua
  CD.i18n.initLanguage();
  const currentLang = CD.i18n.getCurrentLang();

  console.log("🔍 [APP] Lingua corrente:", currentLang);

  try {
    // carica in parallelo catalogo vasi e masterclass
    console.log("🔍 [APP] Caricamento dati in parallelo...");
    
    const [catalogueItems, masterclassItems, certificatiItems] = await Promise.all([
      CD.catalogue.loadCsv(),
      CD.masterclass ? CD.masterclass.loadCsv() : Promise.resolve([]),
      CD.certificati ? CD.certificati.loadCsv() : Promise.resolve([])
    ]);

    console.log("✅ [APP] Catalogo caricato:", catalogueItems.length, "items");
    console.log("✅ [APP] Masterclass caricate:", masterclassItems.length, "items");
    console.log("✅ [APP] Certificati caricati:", certificatiItems.length, "items");

    window.__catalogueData   = catalogueItems;
    window.__masterclassData = masterclassItems;
    window.__certificatiData = certificatiItems;

    // vasi
    console.log("🔍 [APP] Rendering catalogo...");
    CD.catalogue.render(catalogueItems, currentLang);
    console.log("✅ [APP] Catalogo renderizzato");

    // masterclass
    if (CD.masterclass && masterclassItems.length) {
      console.log("🔍 [APP] Rendering masterclass...");
      CD.masterclass.render(masterclassItems, currentLang);
      console.log("✅ [APP] Masterclass renderizzate");
    }

    // certificati
    if (CD.certificati && certificatiItems.length) {
      console.log("🔍 [APP] Rendering certificati...");
      CD.certificati.render(certificatiItems, currentLang);
      console.log("✅ [APP] Certificati renderizzati");
    }

    // ⚠️ IMPORTANTE: inizializza comportamenti DOPO tutti i render
    // Aspetta che il DOM sia aggiornato
    console.log("🔍 [APP] Attesa aggiornamento DOM...");
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log("🔍 [APP] Inizializzazione comportamenti catalogo...");
    CD.catalogue.initBehaviour();
    console.log("✅ [APP] Comportamenti catalogo inizializzati");
    
    // Verifica che i modali siano stati creati
    const modals = document.querySelectorAll('.modal');
    console.log("✅ [APP] Modali trovati nel DOM:", modals.length);
    
    const modalButtons = document.querySelectorAll('[data-modal-target]');
    console.log("✅ [APP] Bottoni modal trovati:", modalButtons.length);

  } catch (err) {
    console.error("❌ [APP] Errore nel caricamento dei dati:", err);
    console.error("❌ [APP] Stack trace:", err.stack);
  }

  // UI
  console.log("🔍 [APP] Inizializzazione UI...");
  CD.ui.initNavbarToggle();
  CD.ui.initNavbarAutoClose();
  CD.ui.initViewToggle();
  console.log("✅ [APP] UI inizializzata");
  
  console.log("🎉 [APP] Inizializzazione completata!");
}

// deve essere visibile a importer.js
window.appInit = appInit;

