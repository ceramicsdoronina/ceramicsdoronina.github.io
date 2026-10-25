// Stripe/js/importerStripe.js
// Avvio: i fetch degli ODS e dei partial partono subito (in parallelo); l'app
// parte quando entrambi sono conclusi (anche con errori parziali).

const PARTIAL_IMPORTS = [
  ["import-navbar",     "Stripe/partials/navbar.html"],
  ["import-hero",       "Stripe/partials/hero.html"],
  ["import-about",      "Stripe/partials/about.html"],
  ["import-catalogue",  "Stripe/partials/catalogue.html"],
  ["import-workshops",  "Stripe/partials/workshops.html"],
  ["import-giftcards",  "Stripe/partials/giftcards.html"],
  ["import-modals",     "Stripe/partials/modals.html"],
  ["import-contact",    "Stripe/partials/contact.html"],
  ["import-footer",     "Stripe/partials/footer.html"],
  ["import-view-toggle", "Stripe/partials/view-toggle.html"],
];

async function importHTML(id, file) {
  const container = document.getElementById(id);
  if (!container) return;
  const res = await fetch(file, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  container.innerHTML = await res.text();
}

// Dati ODS: [catalogo vasi, masterclass, carte regalo] come risultati allSettled.
// Sono letti da appInitStripe tramite window.__cdDataPromise.
window.__cdDataPromise = Promise.allSettled([
  CD.catalogue.loadCsv(),
  CD.masterclass ? CD.masterclass.loadCsv() : Promise.resolve([]),
  CD.certificati ? CD.certificati.loadCsv() : Promise.resolve([])
]);

function showPartialsBanner() {
  const msg = (window.CD && CD.i18n && CD.i18n.t && CD.i18n.t("partials.loadFailed"))
    || "Part of the page could not be loaded. Please reload the page.";
  const banner = document.createElement("div");
  banner.setAttribute("role", "alert");
  banner.style.cssText = "background:#fff3cd;color:#664d03;border-bottom:1px solid #ffecb5;padding:10px 16px;text-align:center;";
  banner.textContent = msg;
  document.body.insertBefore(banner, document.body.firstChild);
}

async function bootStripeSite() {
  const results = await Promise.allSettled(PARTIAL_IMPORTS.map(([id, file]) => importHTML(id, file)));

  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failed++;
      console.error("[IMPORTER] partial non caricato:", PARTIAL_IMPORTS[i][1], r.reason);
    }
  });

  try {
    if (window.appInitStripe) await window.appInitStripe();
  } catch (err) {
    console.error("[IMPORTER] appInitStripe fallita:", err);
  }

  if (failed > 0) showPartialsBanner();
}

bootStripeSite();
