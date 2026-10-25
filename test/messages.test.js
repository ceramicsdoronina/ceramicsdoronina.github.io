// test/messages.test.js  -  parita' delle chiavi it/en/ru e uso delle chiavi nel codice live
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
globalThis.window = {};
require(path.join(ROOT, "messages.js"));   // `const messages` + window.messages
const messages = globalThis.window.messages;
delete globalThis.window;

const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, p + k + ".") : [p + k]));
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("it / en / ru have exactly the same keys, all non-empty strings", () => {
  const sets = {};
  for (const l of ["it", "en", "ru"]) {
    sets[l] = new Set(flat(messages[l]));
    for (const k of sets[l]) {
      const v = k.split(".").reduce((o, p) => o[p], messages[l]);
      assert.equal(typeof v, "string", `${l}.${k}`);
      assert.ok(v.trim().length > 0, `${l}.${k} empty`);
    }
  }
  for (const a of ["it", "en", "ru"]) {
    for (const b of ["it", "en", "ru"]) {
      const missing = [...sets[a]].filter((k) => !sets[b].has(k));
      assert.deepEqual(missing, [], `keys in ${a} but not in ${b}`);
    }
  }
});

test("delivery copy states the real shipping area (EU + NO + CH), not 'worldwide'", () => {
  assert.doesNotMatch(messages.en.detail.deliveryText, /worldwide/i);
  assert.match(messages.en.detail.deliveryText, /Norway/);
  assert.match(messages.en.detail.deliveryText, /Switzerland/);
  assert.doesNotMatch(messages.it.detail.deliveryText, /in tutto il mondo/i);
  assert.match(messages.it.detail.deliveryText, /Norvegia/);
  assert.match(messages.it.detail.deliveryText, /Svizzera/);
  assert.doesNotMatch(messages.ru.detail.deliveryText, /по всему миру/);
  assert.match(messages.ru.detail.deliveryText, /Норвегию/);
  assert.match(messages.ru.detail.deliveryText, /Швейцарию/);
});

test("every data-i18n / data-i18n-aria-label key used by the live partials and pages exists", () => {
  const files = [
    "index.html", "stripe-success.html", "stripe-cancel.html",
    ...fs.readdirSync(path.join(ROOT, "Stripe", "partials")).map((f) => path.join("Stripe", "partials", f)),
    "masterclass.js", "certificati.js", "Stripe/js/catalogueStripe.js"
  ];
  const dict = new Set(flat(messages.it));
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/data-i18n(?:-aria-label)?="([A-Za-z0-9_.]+)"/g)) {
      assert.ok(dict.has(m[1]), `${f}: unknown key ${m[1]}`);
    }
  }
});

test("dead key checkoutStatus.fail is gone and nothing reads it", () => {
  assert.equal(messages.it.checkoutStatus.fail, undefined);
  for (const f of ["index.html", "stripe-success.html", "stripe-cancel.html", "Stripe/js/uiStripe.js", "Stripe/js/appStripe.js"]) {
    assert.doesNotMatch(read(f), /checkoutStatus\.fail|\.fail\b/, f);
  }
});

test("success copy promises only what exists (receipt by Stripe, owner contacts about delivery)", () => {
  assert.match(messages.en.checkoutStatus.success, /Stripe will email you the receipt/);
  assert.match(messages.it.checkoutStatus.error, /\. Riprova/);
  assert.match(messages.en.checkoutStatus.error, /\. Please try again/);
});
