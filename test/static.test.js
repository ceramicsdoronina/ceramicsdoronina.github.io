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
  assert.doesNotMatch(read("stripe-success.html"), /setTimeout/);
  assert.match(read("stripe-success.html"), /from.*confirm[\s\S]*location\.replace\("\/"\)/);
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

test("auto-clear after payment: config endpoint, wiring on load/pageshow/visibilitychange, throttle and poll window", () => {
  const html = read("index.html");
  assert.match(html, /sessionStatusEndpoint:\s*"https:\/\/ceramicsdoronina\.netlify\.app\/\.netlify\/functions\/session-status"/);
  const ui = read("Stripe/js/uiStripe.js");
  assert.match(ui, /cartLib\.pendingToCheck\(/);
  assert.match(ui, /cartLib\.resolvePending\(/);
  assert.match(ui, /cartLib\.sessionStatusUrl\(window\.CD\?\.config\?\.sessionStatusEndpoint/);
  assert.match(ui, /addEventListener\("visibilitychange"/);
  assert.match(ui, /addEventListener\("pageshow"[\s\S]*startPendingWatch\(\)/);
  assert.match(ui, /STATUS_GAP_EVENT_MS = 10000/);
  assert.match(ui, /POLL_INTERVAL_MS = 5000/);
  assert.match(ui, /POLL_WINDOW_MS = 2 \* 60 \* 1000/);
  assert.match(ui, /credentials: "omit"/);
  assert.match(ui, /statusInflight/);
  // a paid:false answer must never reach the cart: only resolvePending decides, and it only clears on paid === true
  assert.doesNotMatch(ui, /writeCart\(\[\]\)/);
  assert.match(read("Stripe/js/cart.js"), /a\.paid === true/);
});

test("buttons never fall back to the system blue (menu, modal close, cart close)", () => {
  assert.match(read("css/base.css"), /button\{color:inherit;/);
  assert.match(read("css/catalogue.css"), /\.modal-header button\{[^}]*color:var\(--text\)/);
  assert.match(read("css/components.css"), /\.cart-drawer__close\{[^}]*color:var\(--text\)/);
  assert.match(read("css/mobile.css"), /#nav-toggle\{[^}]*color:var\(--text\)/);
});

test("css: no stray text outside rules (it silently drops the next rule) and the text-lowering rule is parsed", () => {
  const fs2 = require("node:fs");
  ["base", "layout", "components", "catalogue", "pages", "mobile"].forEach((n) => {
    const css = read("css/" + n + ".css").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"|'[^']*'/g, '""');
    assert.doesNotMatch(css, /[Ѐ-ӿ]/, n + ".css contains stray Cyrillic text");
    // fuori dai blocchi non ci possono essere parole isolate seguite da una riga vuota e da un altro blocco
    assert.doesNotMatch(css, /\}\s*\n\s*[A-Za-zÀ-ɏ]+\s*\n\s*\n\s*(@media|[.#a-z])/, n + ".css has a bare word between rules");
    assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length, n + ".css has unbalanced braces");
  });
  assert.match(read("css/pages.css"), /@media \(min-width: 769px\)\{\s*\.giftcards-text, \.workshops-text\{ padding-top:56px; \}/);
  assert.match(read("css/catalogue.css"), /body \.catalogue-header p\.lead\{\s*font-size:1em !important;/);
});

test("language selector: plain code + small dropdown, no select box, no flags, no border on the trigger", () => {
  const nav = read("Stripe/partials/navbar.html");
  assert.doesNotMatch(nav, /<select/);
  assert.doesNotMatch(nav, /[\u{1F1E6}-\u{1F1FF}]/u, "no flag emoji");
  assert.match(nav, /id="language-selector"[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"/);
  ["ru", "it", "en"].forEach((l) => assert.match(nav, new RegExp('role="option" id="lang-opt-' + l + '" data-lang="' + l + '"')));
  const css = read("css/components.css");
  assert.match(css, /\.lang-btn\{[^}]*border:0;/);
  assert.match(css, /\.lang-list\{/);
  assert.doesNotMatch(css, /\.lang select/);
  const js = read("i18n.js");
  ["bindLangMenu", "syncLangMenu", "ArrowDown", "Escape"].forEach((k) => assert.ok(js.includes(k), k));
  assert.match(read("messages.js"), /language: "Lingua"/);
});

test("language menu opens on mouse hover (hover devices only) and keeps a hover bridge", () => {
  const js = read("i18n.js");
  assert.match(js, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(js, /addEventListener\("mouseenter"/);
  assert.match(js, /addEventListener\("mouseleave"/);
  assert.match(read("css/components.css"), /\.lang-list::before\{/);
});

test("hero tagline uses self-hosted Manrope (no request to Google Fonts)", () => {
  ["fonts/manrope-cyrillic.woff2", "fonts/manrope-latin.woff2", "fonts/README.txt"].forEach((f) => assert.ok(fs.existsSync(path.join(__dirname, "..", f)), f));
  const base = read("css/base.css");
  assert.match(base, /font-family:"Manrope";[\s\S]*manrope-cyrillic\.woff2/);
  assert.match(base, /manrope-latin\.woff2/);
  assert.match(read("css/pages.css"), /\.hero-tagline\{[^}]*font-family:"Manrope"/);
  assert.doesNotMatch(read("index.html"), /fonts\.googleapis|fonts\.gstatic/);
});

test("language dropdown is centred under the chosen language and white like the bar", () => {
  const css = read("css/components.css");
  const list = css.match(/\.lang-list\{[^}]*\}/)[0];
  assert.match(list, /left:50%/);
  assert.match(list, /translateX\(-50%\)/);
  assert.match(list, /background:#fff/);
  assert.match(read("css/catalogue.css"), /\.catalogue-header \.lead\{[^}]*font-family:"Manrope"/);
});

test("text is Manrope (small, like the about paragraphs), titles keep the display serif, cards react on hover", () => {
  const base = read("css/base.css");
  assert.match(base, /--font-text:"Manrope"/);
  assert.match(base, /body\{\s*font-family:var\(--font-text\);/);
  assert.match(base, /button, input, select, textarea\{\s*font-family:inherit;/);
  assert.match(base, /h1, h2, h3, h4, h5, h6 \{\s*font-family:var\(--font-display\);/);
  // nessun testo corrente sopra i 16 px (restano titoli, icone e simboli)
  assert.doesNotMatch(read("css/components.css"), /\.pill-text\{font-size:20px/);
  assert.match(read("css/pages.css"), /\.hero-tagline\{[^}]*font-size:16px/);
  assert.match(read("css/catalogue.css"), /\.price-current\{\s*font-size:16px/);
  const cat = read("css/catalogue.css");
  assert.match(cat, /@media \(hover:hover\) and \(pointer:fine\)\{[\s\S]*\.card:hover\{[^}]*transform:scale\(1\.03\)/);
  assert.match(cat, /\.card:hover h4\{ color:var\(--hover-red\); \}/);
  assert.match(cat, /prefers-reduced-motion:reduce[\s\S]*\.card:hover\{ transform:none; \}/);
});

test("header without separator line, no outline on cart and menu buttons, short arrowless pill buttons", () => {
  const comp = read("css/components.css"), mob = read("css/mobile.css");
  const header = comp.match(/\nheader\{[^}]*\}/)[0];
  assert.doesNotMatch(header, /border-bottom/);
  (mob.match(/header\{[^}]*\}/g) || []).forEach((r) => assert.doesNotMatch(r, /border-bottom/, r.slice(0, 60)));
  assert.match(comp, /\.nav-icon-btn\{[^}]*border:0;/);
  const toggles = mob.match(/#nav-toggle\{[^}]*display:inline-flex[^}]*\}/g) || [];
  assert.equal(toggles.length, 2, "mobile-view and media-query hamburger rules");
  toggles.forEach((r) => { assert.match(r, /border:0;/); assert.match(r, /background:transparent;/); });
  assert.match(comp, /\.pill-arrow\{ display:none; \}/);
  assert.match(comp, /\.pill-btn\{\s*width:auto;\s*min-width:190px;/);
  assert.match(comp, /\.about-cta\{[^}]*align-items:stretch;[^}]*width:fit-content;/);
});

test("cards: always a light shadow, hover title uses the same dark red as the buy button", () => {
  const cat = read("css/catalogue.css");
  assert.match(cat, /\.card\{[^}]*box-shadow:0 4px 14px rgba\(0,0,0,\.07\);/);
  assert.match(read("css/base.css"), /--hover-red:var\(--btn-primary\);/);
  assert.match(cat, /\.card-btn\.primary\{[^}]*background:var\(--btn-primary\)/);
});

test("card photo zooms 3% on hover inside its clipping frame, with a transition that wins over the base rule", () => {
  const cat = read("css/catalogue.css");
  assert.match(cat, /\.card:hover \.card-img,\s*\.card:hover \.media-single img\{ transform:scale\(1\.03\); \}/);
  assert.match(cat, /\.card \.card-img\{ transition:opacity \.2s ease, transform \.35s ease; \}/);
  assert.match(cat, /\.media-carousel\{[^}]*overflow:hidden;/);
  assert.match(cat, /\.media-single\{[^}]*overflow:hidden;/);
  assert.match(cat, /prefers-reduced-motion:reduce[\s\S]*\.card:hover \.card-img, \.card:hover \.media-single img\{ transform:none; \}/);
});
