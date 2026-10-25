// Stripe/js/appStripe.js
async function appInitStripe() {
  // lingua
  CD.i18n.initLanguage();
  const currentLang = CD.i18n.getCurrentLang();

  // dati ODS: gia' in download dall'avvio (vedi importerStripe.js)
  const settled = await (window.__cdDataPromise || Promise.allSettled([
    CD.catalogue.loadCsv(),
    CD.masterclass ? CD.masterclass.loadCsv() : Promise.resolve([]),
    CD.certificati ? CD.certificati.loadCsv() : Promise.resolve([])
  ]));
  const [catRes, mcRes, gcRes] = settled;

  const ok = (r) => r && r.status === "fulfilled";
  const value = (r) => (ok(r) && Array.isArray(r.value) ? r.value : []);
  const unavailableHtml = (gridId) => {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const msg = CD.i18n.t("catalogue.unavailable") || "The catalogue is currently unavailable. Please reload the page.";
    grid.innerHTML = `<p class="catalogue-unavailable" role="alert">${CD.util.escapeHtml(msg)}</p>`;
  };

  window.__catalogueData = value(catRes);
  window.__masterclassData = value(mcRes);
  window.__certificatiData = value(gcRes);

  try {
    if (ok(catRes)) CD.catalogue.render(window.__catalogueData, currentLang);
    else {
      console.error("[APP/STRIPE] catalogo vasi non caricato:", catRes.reason);
      CD.catalogue.renderUnavailable();
    }

    if (CD.masterclass) {
      if (ok(mcRes)) CD.masterclass.render(window.__masterclassData, currentLang);
      else {
        console.error("[APP/STRIPE] masterclass non caricate:", mcRes.reason);
        unavailableHtml("masterclass-grid");
      }
    }

    if (CD.certificati) {
      if (ok(gcRes)) CD.certificati.render(window.__certificatiData, currentLang);
      else {
        console.error("[APP/STRIPE] carte regalo non caricate:", gcRes.reason);
        unavailableHtml("certificati-grid");
      }
    }

    CD.catalogue.initBehaviour();
  } catch (err) {
    console.error("[APP/STRIPE] Errore nel rendering dei dati:", err);
  }

  // UI
  CD.ui.initNavbarToggle();
  CD.ui.initNavbarAutoClose();
  CD.ui.initViewToggle();
  CD.ui.initCartOpenButton();

  // allinea il carrello salvato al catalogo appena caricato (solo per le parti caricate)
  if (CD.shop?.reconcileCart) {
    CD.shop.reconcileCart({
      physicalKnown: ok(catRes),
      digitalKnown: ok(mcRes) && ok(gcRes)
    });
  }

  // etichette del drawer/pulsanti nella lingua corrente
  CD.i18n.applyTranslations(currentLang);

  if (CD.shop?.init) await CD.shop.init();
}

window.appInitStripe = appInitStripe;
