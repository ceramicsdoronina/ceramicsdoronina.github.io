// test/foresta.test.js - la pagina forestaDiAnna e' nascosta (noindex, nessun link) e i suoi file esistono
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("forestaDiAnna: noindex, and every referenced local file exists", () => {
  const html = read("forestaDiAnna/index.html");
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s) && s !== "../");
  assert.ok(refs.length >= 6);
  refs.forEach((r) => assert.ok(fs.existsSync(path.join(root, "forestaDiAnna", r)), r));
  ["img/anna-walk.png", "img/studio-bg.png", "img/studio-shelf.png"].forEach((f) => assert.ok(fs.existsSync(path.join(root, "forestaDiAnna", f)), f));
});

test("forestaDiAnna: not linked from any other page or partial", () => {
  const files = ["index.html", "stripe-success.html", "stripe-cancel.html", "privacy-policy.html", "messages.js", "i18n.js", "app.js", "ui.js", "importer.js"]
    .concat(fs.readdirSync(path.join(root, "Stripe/partials")).map((f) => "Stripe/partials/" + f))
    .concat(fs.readdirSync(path.join(root, "partials")).map((f) => "partials/" + f));
  files.forEach((f) => assert.doesNotMatch(read(f), /forestaDiAnna/i, f));
});

test("forestaDiAnna: uses the shared cart key and shop modules, never writes anywhere else", () => {
  const js = read("forestaDiAnna/game.js");
  assert.match(js, /CD\.cart\.CART_KEY/);
  assert.match(js, /CD\.cart\.mergeAdd/);
  assert.match(js, /CD\.liveCatalogue/);
  assert.doesNotMatch(js, /innerHTML/);
  new Function(js);   // sintassi valida
});
