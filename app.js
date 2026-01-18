// app.js
async function appInit() {
  console.log("🚀 [APP] Inizializzazione app...");

  // lingua
  CD.i18n.initLanguage();
  const currentLang = CD.i18n.getCurrentLang();
  console.log("🔍 [APP] Lingua corrente:", currentLang);

  try {
    console.log("🔍 [APP] Caricamento dati in parallelo...");

    const [catalogueItems, masterclassItems, certificatiItems] = await Promise.all([
      CD.catalogue.loadCsv(),
      CD.masterclass ? CD.masterclass.loadCsv() : Promise.resolve([]),
      CD.certificati ? CD.certificati.loadCsv() : Promise.resolve([])
    ]);

    window.__catalogueData = catalogueItems;
    window.__masterclassData = masterclassItems;
    window.__certificatiData = certificatiItems;

    CD.catalogue.render(catalogueItems, currentLang);
    if (CD.masterclass) CD.masterclass.render(masterclassItems, currentLang);
    if (CD.certificati) CD.certificati.render(certificatiItems, currentLang);

    await new Promise((r) => setTimeout(r, 50));
    CD.catalogue.initBehaviour();

  } catch (err) {
    console.error("❌ [APP] Errore nel caricamento dei dati:", err);
    console.error("❌ [APP] Stack trace:", err.stack);
  }

  // UI
  CD.ui.initNavbarToggle();
  CD.ui.initNavbarAutoClose();
  CD.ui.initViewToggle();
  CD.ui.initCartOpenButton();

  // Precarica shop (non blocca)
  if (CD.shop?.init) CD.shop.init();

  console.log("🎉 [APP] Inizializzazione completata!");

  // ─────────────────────────────────────────────
  // RITORNO DA CHECKOUT (best-effort)
  // ─────────────────────────────────────────────
  async function handleCheckoutReturn() {
    const started = localStorage.getItem("cd_checkout_started");
    const tsStr = localStorage.getItem("cd_checkout_ts");
    if (!started || !tsStr) return;

    localStorage.removeItem("cd_checkout_started");
    localStorage.removeItem("cd_checkout_ts");

    const elapsedMs = Date.now() - Number(tsStr);

    const lang = CD.i18n.getCurrentLang();
    const dict = CD.i18n.messages[lang] || CD.i18n.messages.it;

    const msgSuccess = dict.checkoutStatus?.success ||
      "Il tuo ordine è in fase di processamento, a breve riceverai un messaggio";
    const msgFail = dict.checkoutStatus?.fail ||
      "C'è stato un problema nella finalizzazione del tuo ordine";

    const PROBABLE_SUCCESS_MS = 30000;

    if (elapsedMs >= PROBABLE_SUCCESS_MS) {
      if (CD.shop?.resetCart) await CD.shop.resetCart();
      alert(msgSuccess);
      window.history.replaceState({}, "", window.location.origin + window.location.pathname + "#home");
    } else {
      alert(msgFail);
      if (CD.shop?.openDrawer) CD.shop.openDrawer();
      window.history.replaceState({}, "", window.location.origin + window.location.pathname + "#home");
    }
  }

  await handleCheckoutReturn();

  // Safari/Chrome bfcache: la pagina torna “congelata”
  window.addEventListener("pageshow", async () => {
    await handleCheckoutReturn();
    if (CD.shop?.init) await CD.shop.init();
    if (CD.shop?.renderDrawer) await CD.shop.renderDrawer();
  });
}

window.appInit = appInit;

