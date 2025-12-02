// importer.js
async function importHTML(id, file) {
  const container = document.getElementById(id);
  if (!container) return;
  const res = await fetch(file);
  const html = await res.text();
  container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", async () => {
  const imports = [
    ["import-navbar", "partials/navbar.html"],
    ["import-hero", "partials/hero.html"],
    ["import-about", "partials/about.html"],
    ["import-catalogue", "partials/catalogue.html"],
    ["import-modals", "partials/modals.html"],   
    ["import-contact", "partials/contact.html"],
    ["import-footer", "partials/footer.html"],
    ["import-view-toggle", "partials/view-toggle.html"]
  ];

  await Promise.all(imports.map(([id, file]) => importHTML(id, file)));

  // quando tutti i pezzi sono caricati, inizializziamo l'app
  if (window.appInit) {
    window.appInit();
  }
});

