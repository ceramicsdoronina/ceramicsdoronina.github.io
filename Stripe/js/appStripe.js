// Stripe/js/appStripe.js
// Orchestrazione: lingua + UI subito (non dipendono dai dati), poi dati ODS e rendering per sezione.

// Dati caricati: array di righe, oppure null se il caricamento e' fallito, undefined se non ancora noto.
// Rendering di ogni sezione isolato: un errore mostra il messaggio "non disponibile" tradotto in
// quella griglia e non blocca le altre. Ritorna, per sezione, il numero di prodotti (number) oppure
// false/null se la sezione non e' "nota" (dati non caricati o rendering fallito).
function renderData(lang) {
  const sections = [
    { key: "catalogue", mod: CD.catalogue, data: window.__catalogueData, grid: "catalogue-grid" },
    { key: "masterclass", mod: CD.masterclass, data: window.__masterclassData, grid: "masterclass-grid" },
    { key: "certificati", mod: CD.certificati, data: window.__certificatiData, grid: "certificati-grid" }
  ];
  const result = {};

  for (const s of sections) {
    result[s.key] = null;
    if (!s.mod || s.data === undefined) continue;   // modulo assente o dati non ancora arrivati

    if (s.data === null) {
      CD.util.renderUnavailable(s.grid);
      continue;
    }
    try {
      const n = s.mod.render(s.data, lang);
      result[s.key] = typeof n === "number" ? n : false;
    } catch (err) {
      console.error(`[APP/STRIPE] rendering ${s.key} fallito:`, err);
      CD.util.renderUnavailable(s.grid);
      result[s.key] = false;
    }
  }

  // comportamenti (accordion, gallerie) sui nuovi nodi: in un try separato
  try {
    if (CD.catalogue) CD.catalogue.initBehaviour();
  } catch (err) {
    console.error("[APP/STRIPE] initBehaviour fallito:", err);
  }
  return result;
}

// Allinea il carrello salvato al catalogo (solo per le parti caricate E rese correttamente);
// saltato del tutto se qualche partial non e' stato caricato
function reconcileCartWith(rendered) {
  const known = (n) => typeof n === "number";
  if (CD.shop && CD.shop.reconcileCart && !window.__cdPartialsFailed) {
    CD.shop.reconcileCart({
      physicalKnown: known(rendered.catalogue),
      digitalKnown: known(rendered.masterclass) && known(rendered.certificati)
    });
  }
}

// Sovrappone prezzo/venduto live alle righe ODS (una sola volta). Ritorna true se qualcosa e' cambiato.
function applyLiveOverlay(map) {
  if (window.__liveApplied || !map || !map.size) return false;
  if (!Array.isArray(window.__catalogueData) || !CD.liveCatalogue) return false;
  window.__catalogueData = CD.liveCatalogue.applyOverlay(window.__catalogueData, map);
  window.__liveApplied = true;
  return true;
}

async function appInitStripe() {
  // lingua e UI non dipendono dai dati ODS: partono subito
  CD.i18n.initLanguage();
  CD.ui.initNavbarToggle();
  CD.ui.initNavbarAutoClose();
  CD.ui.initViewToggle();
  CD.ui.initCartOpenButton();

  // dati ODS: gia' in download dall'avvio (vedi importerStripe.js)
  const settled = await (window.__cdDataPromise || Promise.allSettled([
    CD.catalogue.loadRows(),
    CD.masterclass ? CD.masterclass.loadRows() : Promise.resolve([]),
    CD.certificati ? CD.certificati.loadRows() : Promise.resolve([])
  ]));
  const [catRes, mcRes, gcRes] = settled;

  const ok = (r) => r && r.status === "fulfilled" && Array.isArray(r.value);
  const value = (r) => (ok(r) ? r.value : null);   // null = caricamento fallito
  [["catalogo vasi", catRes], ["masterclass", mcRes], ["carte regalo", gcRes]].forEach(([label, r]) => {
    if (!ok(r)) console.error(`[APP/STRIPE] ${label} non caricato:`, r && r.reason);
  });

  window.__catalogueData = value(catRes);
  window.__masterclassData = value(mcRes);
  window.__certificatiData = value(gcRes);

  // se il live e' gia' arrivato lo si applica prima del primo render; altrimenti si rende subito
  // l'ODS e si ri-rende quando arriva (max 5 s, vedi sotto)
  const livePromise = window.__cdLivePromise || Promise.resolve(new Map());
  let liveMap = null;
  livePromise.then((m) => { liveMap = m; });
  await Promise.resolve();
  applyLiveOverlay(liveMap);

  // lingua letta DOPO l'attesa dei dati: l'utente puo' averla cambiata nel frattempo
  const lang = CD.i18n.getCurrentLang();
  const rendered = renderData(lang);

  reconcileCartWith(rendered);

  // etichette del drawer/pulsanti nella lingua corrente
  CD.i18n.applyTranslations(lang);
  if (CD.shop && CD.shop.renderDrawer) CD.shop.renderDrawer();

  // overlay live in ritardo: ri-rende con la lingua CORRENTE e riallinea il carrello
  try {
    const late = await livePromise;
    if (applyLiveOverlay(late)) {
      const lang2 = CD.i18n.getCurrentLang();
      reconcileCartWith(renderData(lang2));
      CD.i18n.applyTranslations(lang2);
      if (CD.shop && CD.shop.renderDrawer) CD.shop.renderDrawer();
    }
  } catch (err) {
    console.warn("[APP/STRIPE] overlay live non applicato:", err);
  }
}

window.CD = window.CD || {};
window.CD.app = { renderData };
window.appInitStripe = appInitStripe;
