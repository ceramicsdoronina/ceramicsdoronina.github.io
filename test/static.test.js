// test/static.test.js  -  controlli statici sul percorso live (index.html -> Stripe)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const LIVE_JS = [
  "Stripe/js/util.js", "Stripe/js/money.js", "Stripe/js/cart.js", "Stripe/js/catalogueStripe.js",
  "masterclass.js", "certificati.js", "Stripe/js/uiStripe.js", "Stripe/js/appStripe.js",
  "Stripe/js/importerStripe.js", "i18n.js", "messages.js"
];

test("index.html loads scripts in dependency order and every file exists", () => {
  const html = read("index.html");
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:/.test(s));
  for (const s of srcs) assert.ok(fs.existsSync(path.join(ROOT, s)), `missing ${s}`);
  const idx = (s) => srcs.indexOf(s);
  const before = (a, b) => assert.ok(idx(a) >= 0 && idx(b) >= 0 && idx(a) < idx(b), `${a} must come before ${b}`);
  before("messages.js", "i18n.js");
  before("i18n.js", "Stripe/js/util.js");
  before("Stripe/js/util.js", "Stripe/js/catalogueStripe.js");
  before("Stripe/js/money.js", "Stripe/js/catalogueStripe.js");
  before("Stripe/js/cart.js", "Stripe/js/uiStripe.js");
  before("Stripe/js/catalogueStripe.js", "masterclass.js");
  before("masterclass.js", "certificati.js");
  before("certificati.js", "Stripe/js/uiStripe.js");
  before("Stripe/js/uiStripe.js", "Stripe/js/appStripe.js");
  before("Stripe/js/appStripe.js", "Stripe/js/importerStripe.js");
  // le funzioni di rete partono senza aspettare SheetJS: lo script SheetJS non e' un <script src defer> statico
  assert.doesNotMatch(html, /<script[^>]+sheetjs[^>]*defer/i);
  assert.match(html, /window\.__xlsxReady/);
  assert.match(html, /15000/);
});

test("success page loads cart.js and the cancel page never touches the pending marker", () => {
  assert.match(read("stripe-success.html"), /<script src="Stripe\/js\/cart\.js">/);
  assert.doesNotMatch(read("stripe-success.html"), /setTimeout|location\.replace/);
  const cancel = read("stripe-cancel.html");
  assert.doesNotMatch(cancel, /cd_checkout_pending|PENDING_KEY|removeItem/);
});

test("no live script references a removed function", () => {
  const removed = [/\baddVariant\b/, /\baddItem\b/, /\bshop\.init\b/, /\bresetCart\b/, /\bisReady\b/, /\bloadCsv\b/, /\bvase_id\b/];
  for (const f of LIVE_JS) {
    const src = read(f);
    for (const re of removed) assert.doesNotMatch(src, re, `${f} references ${re}`);
  }
  assert.doesNotMatch(read("Stripe/js/catalogueStripe.js"), /function getLang\b|\bgetLang\(/);
  for (const f of ["Stripe/js/catalogueStripe.js", "masterclass.js", "certificati.js"]) {
    assert.match(read(f), /loadRows/, f);
  }
});

test("single delegates: modal and add-to-cart handlers live in util.js only", () => {
  for (const f of ["Stripe/js/catalogueStripe.js", "masterclass.js", "certificati.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /document\.addEventListener\("click"/, `${f} registers its own click delegate`);
    assert.doesNotMatch(src, /data-add-(masterclass|giftcard)/, f);
  }
  assert.match(read("Stripe/js/util.js"), /function bindModalDelegate/);
  assert.match(read("Stripe/js/util.js"), /function bindAddToCart/);
});

test("CSS url() assets resolve from css/ to ../images and exist", () => {
  for (const f of ["css/pages.css", "css/components.css"]) {
    for (const m of read(f).matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
      if (/^(https?:|data:)/.test(m[1])) continue;
      assert.ok(fs.existsSync(path.join(ROOT, "css", m[1])), `${f}: ${m[1]} does not resolve`);
    }
  }
});

test("live scripts parse (syntax)", () => {
  const vm = require("node:vm");
  for (const f of LIVE_JS) assert.doesNotThrow(() => new vm.Script(read(f), { filename: f }), f);
});
