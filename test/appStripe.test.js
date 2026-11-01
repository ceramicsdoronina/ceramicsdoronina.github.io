// test/appStripe.test.js  -  orchestrazione dati (appInitStripe) con stub di DOM/moduli
// Esegui con: node --test test/appStripe.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

globalThis.window = globalThis;
require("../Stripe/js/util.js");
require("../Stripe/js/money.js");
require("../Stripe/js/liveCatalogue.js");
require("../Stripe/js/appStripe.js");
const live = globalThis.CD.liveCatalogue;
const realUtil = globalThis.CD.util;

const settle = () => new Promise((r) => setTimeout(r, 5));
const tick = async () => { for (let i = 0; i < 5; i++) await settle(); };
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const tab = (key, ids) => ids.map((id) => ({ id, src: "sheet", key }));

// Imposta gli stub e ritorna il registro delle chiamate
function setup({ openModals = [] } = {}) {
  const log = { renders: [], unavailable: [], reconciles: 0, reopened: [], translations: 0 };
  const mod = (key) => ({
    render(rows, lang) { log.renders.push({ key, rows, lang }); return Array.isArray(rows) ? rows.length : false; },
    initBehaviour() {}
  });
  globalThis.CD = {
    liveCatalogue: live,
    util: Object.assign({}, realUtil, {
      renderUnavailable: (g) => log.unavailable.push(g),
      openModal: (m) => log.reopened.push(m.id)
    }),
    catalogue: mod("catalogue"), masterclass: mod("masterclass"), certificati: mod("certificati"),
    i18n: { lang: "it", initLanguage() {}, getCurrentLang() { return this.lang; }, applyTranslations() { log.translations++; } },
    ui: { initNavbarToggle() {}, initNavbarAutoClose() {}, initViewToggle() {}, initCartOpenButton() {} },
    shop: { reconcileCart() { log.reconciles++; }, renderDrawer() {} }
  };
  globalThis.document = {
    querySelectorAll: () => openModals.map((id) => ({ id })),
    getElementById: (id) => (openModals.includes(id) ? { id } : null)
  };
  globalThis.__cdPartialsFailed = 0;
  return log;
}
const odsOk = (v, m, g) => [{ status: "fulfilled", value: v }, { status: "fulfilled", value: m }, { status: "fulfilled", value: g }];
const odsRows = (key, ids) => ids.map((id) => ({ id, src: "ods", key }));
const liveAll = (items) => ({ items: items || new Map(), tabs: { vasi: tab("v", ["s1"]), masterclass: tab("m", ["s2"]), certificati: tab("c", ["s3"]) } });

test("endpoint covering all tabs renders at once from the sheet, without waiting for the ODS", async () => {
  const log = setup();
  globalThis.__cdDataPromise = new Promise(() => {});          // ODS/SheetJS mai pronti
  globalThis.__cdLivePromise = Promise.resolve(liveAll());
  await globalThis.appInitStripe();
  assert.equal(log.renders.length, 3);
  assert.ok(log.renders.every((r) => r.rows[0].src === "sheet"));
  assert.deepEqual(globalThis.__cdSources, { vasi: "sheet", masterclass: "sheet", certificati: "sheet" });
  assert.equal(log.reconciles, 1);
});

test("ODS first, endpoint late: second render from the sheet, current language, open modals reopened", async () => {
  const log = setup({ openModals: ["modal-v1"] });
  const l = deferred();
  globalThis.__cdDataPromise = Promise.resolve(odsOk(odsRows("v", ["v1"]), odsRows("m", ["m1"]), odsRows("c", ["c1"])));
  globalThis.__cdLivePromise = l.promise;
  const done = globalThis.appInitStripe();
  await tick();
  assert.equal(log.renders.length, 3);
  assert.ok(log.renders.every((r) => r.rows[0].src === "ods"));
  CD.i18n.lang = "ru";                                         // l'utente cambia lingua prima del live
  l.resolve(liveAll());
  await done;
  assert.equal(log.renders.length, 6);
  const second = log.renders.slice(3);
  assert.ok(second.every((r) => r.rows[0].src === "sheet" && r.lang === "ru"));
  assert.equal(log.reconciles, 2);
  assert.deepEqual(log.reopened, ["modal-v1"]);
});

test("endpoint failure: ODS only, a single render, no re-render", async () => {
  const log = setup();
  globalThis.__cdDataPromise = Promise.resolve(odsOk(odsRows("v", ["v1"]), [], []));
  globalThis.__cdLivePromise = Promise.resolve(live.emptyLive());
  await globalThis.appInitStripe();
  assert.equal(log.renders.length, 3);
  assert.equal(log.reconciles, 1);
  assert.deepEqual(globalThis.__cdSources, { vasi: "ods", masterclass: "ods", certificati: "ods" });
});

test("partial endpoint (one tab null): waits for the ODS, per-tab sources, v1 overlay on the ODS vasi only", async () => {
  const log = setup();
  globalThis.__cdDataPromise = Promise.resolve(odsOk(
    [{ id: "v1", price_new: "150", price_new__raw: 150, venduto: "no" }], odsRows("m", ["m1"]), odsRows("c", ["c1"])));
  globalThis.__cdLivePromise = Promise.resolve({
    items: new Map([["v1", { priceCents: 9900, sold: false }]]),
    tabs: { vasi: null, masterclass: tab("m", ["s2"]), certificati: null }
  });
  await globalThis.appInitStripe();
  assert.deepEqual(globalThis.__cdSources, { vasi: "ods", masterclass: "sheet", certificati: "ods" });
  assert.equal(globalThis.__catalogueData[0].price_new__raw, 9900 / 100);
  assert.equal(globalThis.__masterclassData[0].src, "sheet");
});

test("ODS failed + endpoint late: 'unavailable' first, then the sheet rows", async () => {
  const log = setup();
  const l = deferred();
  const fail = { status: "rejected", reason: new Error("SheetJS") };
  const w = console.error; console.error = () => {};
  try {
    globalThis.__cdDataPromise = Promise.resolve([fail, fail, fail]);
    globalThis.__cdLivePromise = l.promise;
    const done = globalThis.appInitStripe();
    await tick();
    assert.equal(log.unavailable.length, 3);
    assert.equal(log.renders.length, 0);
    l.resolve(liveAll());
    await done;
  } finally { console.error = w; }
  assert.equal(log.renders.length, 3);
  assert.ok(log.renders.every((r) => r.rows[0].src === "sheet"));
});

test("endpoint promise that rejects or resolves null is treated as no live data", async () => {
  for (const p of [Promise.reject(new Error("x")), Promise.resolve(null), undefined]) {
    const log = setup();
    globalThis.__cdDataPromise = Promise.resolve(odsOk(odsRows("v", ["v1"]), [], []));
    globalThis.__cdLivePromise = p;
    await globalThis.appInitStripe();
    assert.equal(log.renders.length, 3);
  }
});
