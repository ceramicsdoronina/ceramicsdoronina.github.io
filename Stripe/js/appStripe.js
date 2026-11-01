// Stripe/js/appStripe.js
// Orchestrazione: lingua + UI subito (non dipendono dai dati), poi dati (fogli dall'endpoint, ODS di
// riserva per foglio) e rendering per sezione.

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

// Righe ODS dai risultati allSettled (null = caricamento fallito o non ancora noto)
function odsValues(settled) {
  const ok = (r) => r && r.status === "fulfilled" && Array.isArray(r.value);
  const [catRes, mcRes, gcRes] = settled || [];
  [["catalogo vasi", catRes], ["masterclass", mcRes], ["carte regalo", gcRes]].forEach(([label, r]) => {
    if (r && !ok(r)) console.error(`[APP/STRIPE] ${label} non caricato:`, r.reason);
  });
  return {
    vasi: ok(catRes) ? catRes.value : null,
    masterclass: ok(mcRes) ? mcRes.value : null,
    certificati: ok(gcRes) ? gcRes.value : null
  };
}

// Fogli del Google Sheet (se presenti) al posto degli ODS, per foglio; overlay v1 solo sui vasi ODS.
// Parte SEMPRE dalle righe ODS originali: nessuna doppia applicazione.
function setData(live, ods) {
  const chosen = CD.liveCatalogue.chooseData(live, ods);
  window.__catalogueData = chosen.rows.vasi;
  window.__masterclassData = chosen.rows.masterclass;
  window.__certificatiData = chosen.rows.certificati;
  window.__cdSources = chosen.sources;
}

function liveCoversAll(l) {
  return !!(l && l.tabs && l.tabs.vasi && l.tabs.masterclass && l.tabs.certificati);
}

function liveHasData(l) {
  return !!(l && ((l.items && l.items.size) || (l.tabs && (l.tabs.vasi || l.tabs.masterclass || l.tabs.certificati))));
}

async function appInitStripe() {
  // lingua e UI non dipendono dai dati: partono subito
  CD.i18n.initLanguage();
  CD.ui.initNavbarToggle();
  CD.ui.initNavbarAutoClose();
  CD.ui.initViewToggle();
  CD.ui.initCartOpenButton();

  // dati: ODS e endpoint gia' in download dall'avvio (vedi importerStripe.js)
  const odsP = window.__cdDataPromise || Promise.allSettled([
    CD.catalogue.loadRows(),
    CD.masterclass ? CD.masterclass.loadRows() : Promise.resolve([]),
    CD.certificati ? CD.certificati.loadRows() : Promise.resolve([])
  ]);
  const livePromise = (window.__cdLivePromise || Promise.resolve(null))
    .then((l) => l || CD.liveCatalogue.emptyLive(), () => CD.liveCatalogue.emptyLive());
  let liveNow = null;
  let odsSettled = null;
  livePromise.then((l) => { liveNow = l; });
  odsP.then((s) => { odsSettled = s; });

  // Primo render: appena gli ODS sono pronti, OPPURE appena l'endpoint copre tutti i fogli (allora
  // non serve aspettare gli ODS ne' SheetJS). L'endpoint ha un timeout di 5 s, quindi se e' lui a
  // fare da ostacolo l'attesa e' limitata; se non copre tutto si attendono gli ODS come prima.
  await Promise.race([odsP, livePromise.then((l) => (liveCoversAll(l) ? l : new Promise(() => {})))]);
  await Promise.resolve();   // lascia scattare i .then di sopra se l'altro lato e' arrivato insieme

  const usedLive = liveNow;
  const ods = odsValues(odsSettled);   // odsSettled null se ha vinto l'endpoint: non serve
  setData(usedLive, ods);

  // lingua letta DOPO l'attesa dei dati: l'utente puo' averla cambiata nel frattempo
  const lang = CD.i18n.getCurrentLang();
  const rendered = renderData(lang);

  reconcileCartWith(rendered);

  // etichette del drawer/pulsanti nella lingua corrente
  CD.i18n.applyTranslations(lang);
  if (CD.shop && CD.shop.renderDrawer) CD.shop.renderDrawer();

  // endpoint arrivato dopo il primo render: ri-rende con la lingua CORRENTE e riallinea il carrello
  try {
    const late = await livePromise;
    if (late !== usedLive && liveHasData(late)) {
      // il primo render e' avvenuto dagli ODS (odsSettled e' noto); id dei modali aperti da riaprire
      const openIds = Array.from(document.querySelectorAll(".modal.open")).map((m) => m.id).filter(Boolean);
      setData(late, ods);
      const lang2 = CD.i18n.getCurrentLang();
      reconcileCartWith(renderData(lang2));
      CD.i18n.applyTranslations(lang2);
      if (CD.shop && CD.shop.renderDrawer) CD.shop.renderDrawer();
      openIds.forEach((id) => {
        const m = document.getElementById(id);
        if (m) CD.util.openModal(m);
      });
    }
  } catch (err) {
    console.warn("[APP/STRIPE] dati live non applicati:", err);
  }
}

window.CD = window.CD || {};
window.CD.app = { renderData };
window.appInitStripe = appInitStripe;
