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

test("privacy page, consent checkboxes and footer link are wired", () => {
  const page = read("privacy-policy.html");
  assert.match(page, /<meta name="privacy-version" content="2026-11-04">/);
  assert.match(page, /Ultimo aggiornamento: 4 novembre 2026/);
  const html = read("index.html");
  assert.match(html, /id="cart-consent-privacy"[^>]*required[^>]*\schecked/);
  assert.match(html, /id="cart-consent-email"[^>]*\schecked/);
  assert.doesNotMatch(html, /id="cart-consent-channels"[^>]*\schecked/);
  assert.doesNotMatch(html, /id="cart-consent-third"[^>]*\schecked/);
  assert.doesNotMatch(html, /cart-consent-optout|marketing_optout/);
  for (const id of ["privacy", "email", "channels", "third"]) assert.match(html, new RegExp(`<label for="cart-consent-${id}"`));
  assert.match(html, /href="privacy-policy\.html" target="_blank" rel="noopener"/);
  assert.match(read("Stripe/partials/footer.html"), /href="privacy-policy\.html"/);
  assert.match(read("Stripe/js/uiStripe.js"), /consents/);
});

test("privacy policy exists in it/en/ru with the same version, matching lang, a valid switcher and per-language links", () => {
  const pages = { it: "privacy-policy.html", en: "privacy-policy.en.html", ru: "privacy-policy.ru.html" };
  const updated = { it: /Ultimo aggiornamento: 4 novembre 2026/, en: /Last updated: 4 November 2026/, ru: /Последнее обновление: 4 ноября 2026/ };
  const sections = {};
  for (const [lang, file] of Object.entries(pages)) {
    const html = read(file);
    assert.match(html, new RegExp(`<html lang="${lang}">`), file);
    assert.match(html, /<meta name="privacy-version" content="2026-11-04">/, file);
    assert.match(html, updated[lang], file);
    sections[lang] = (html.match(/<h2>/g) || []).length;
    // language switcher: the other two pages are linked, files exist, own page is not a link
    for (const [other, ofile] of Object.entries(pages)) {
      if (other === lang) assert.doesNotMatch(html, new RegExp(`<a href="${ofile.replace(/\./g, "\\.")}"`), `${file} links to itself`);
      else assert.match(html, new RegExp(`<a href="${ofile.replace(/\./g, "\\.")}" hreflang="${other}"`), `${file} -> ${ofile}`);
      assert.ok(fs.existsSync(path.join(ROOT, ofile)), ofile);
    }
    assert.match(html, /href="index\.html"/, file);
  }
  assert.deepEqual([sections.en, sections.ru], [sections.it, sections.it], "same number of sections");
  // drawer + footer links follow the language
  assert.match(read("index.html"), /data-i18n-href="consent\.privacyUrl"/);
  assert.match(read("Stripe/partials/footer.html"), /data-i18n-href="footer\.privacyUrl"/);
  globalThis.window = {};
  delete require.cache[require.resolve("../messages.js")];
  require("../messages.js");
  const msgs = globalThis.window.messages;
  delete globalThis.window;
  for (const lang of ["it", "en", "ru"]) {
    assert.equal(msgs[lang].consent.privacyUrl, pages[lang]);
    assert.equal(msgs[lang].footer.privacyUrl, pages[lang]);
  }
});

test("privacy pages describe the same four choices and no longer mention soft spam / opposition", () => {
  for (const f of ["privacy-policy.html", "privacy-policy.en.html", "privacy-policy.ru.html"]) {
    const html = read(f);
    assert.equal((html.match(/<ol>[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length, 4, f);
    assert.doesNotMatch(html, /soft spam|130/i, f);
  }
});

test("stripe-success.html reached with ?session_id=cs_... clears only that order from cart and pending marker", () => {
  const vm = require("node:vm");
  const cartLib = require("../Stripe/js/cart.js");
  const html = read("stripe-success.html");
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
  const sid = "cs_test_a1B2c3D4e5F6g7H8";
  const store = {
    [cartLib.CART_KEY]: JSON.stringify([{ id: "v1", quantity: 1 }, { id: "v2", quantity: 1 }]),
    [cartLib.PENDING_KEY]: JSON.stringify({ [sid]: { ids: ["v1"], ts: Date.now() }, cs_test_other000000: { ids: ["v2"], ts: Date.now() } })
  };
  const el = () => ({ textContent: "", hidden: true });
  const els = { t: el(), p: el(), ref: el(), back: el() };
  const ctx = {
    console,
    URLSearchParams,
    window: { CD: { cart: cartLib }, messages: {}, location: { search: "?session_id=" + sid } },
    document: { documentElement: {}, title: "", getElementById: (id) => els[id] },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } }
  };
  ctx.window.localStorage = ctx.localStorage;
  vm.runInNewContext(script, Object.assign(ctx, { window: Object.assign(ctx.window, { }) }), { filename: "stripe-success.inline.js" });
  assert.deepEqual(JSON.parse(store[cartLib.CART_KEY]).map((x) => x.id), ["v2"]);
  assert.deepEqual(Object.keys(JSON.parse(store[cartLib.PENDING_KEY])), ["cs_test_other000000"]);
  assert.equal(els.ref.hidden, false);
  // an unknown session id changes nothing
  ctx.window.location.search = "?session_id=cs_test_unknown00000";
  const before = JSON.stringify(store);
  vm.runInNewContext(script, ctx);
  assert.equal(JSON.stringify(store), before);
});
