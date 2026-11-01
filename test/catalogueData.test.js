// test/catalogueData.test.js  -  endpoint version 2 (righe dei fogli), parita' con l'ODS, fallback per foglio
// Esegui con: node --test test/catalogueData.test.js
//
// Parita' ODS/foglio: SheetJS non e' disponibile offline (nel sito arriva da una CDN), quindi i valori
// attesi dell'ODS sono in test/fixtures/expected-<Foglio>.json, ricavati leggendo content.xml degli
// ODS (test/tools/ods_to_expected.py: testo visualizzato di ogni cella + valore numerico delle celle
// float). I CSV test/fixtures/catalogue-tab-<Foglio>.csv sono l'export del foglio Google con lo stesso
// contenuto. Il test verifica che (1) la conversione condivisa (util.normalizeRow) e' un punto fisso
// sulle righe ODS e (2) le righe del CSV passate dal percorso endpoint (parseTab) sono identiche a
// quelle ODS, a parte "<col>__raw" (solo l'ODS conosce il tipo numerico della cella; il foglio porta
// stringhe) e con gli stessi centesimi per ogni colonna prezzo.
// Unica normalizzazione voluta rispetto al vecchio loadOdsRows: i valori sono tagliati (trim); nell'ODS
// dei vasi c'e' una cella con uno spazio finale (v1, technique-ru), quindi i valori attesi si
// confrontano dopo trim. La conversione e' applicata ad entrambi i percorsi.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const live = require("../Stripe/js/liveCatalogue.js");
const util = require("../Stripe/js/util.js");
const money = require("../Stripe/js/money.js");

const FIX = path.join(__dirname, "fixtures");
const quiet = async (fn) => {
  const w = console.warn; console.warn = () => {};
  try { return await fn(); } finally { console.warn = w; }
};
const quietSync = (fn) => {
  const w = console.warn; console.warn = () => {};
  try { return fn(); } finally { console.warn = w; }
};

// CSV RFC 4180 minimale (virgolette, "" e a capo dentro le celle)
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some((x) => x !== "")) rows.push(row); }
  return rows;
}
function csvTab(name) {
  const [headers, ...body] = parseCsv(fs.readFileSync(path.join(FIX, `catalogue-tab-${name}.csv`), "utf8"));
  return { headers, rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] == null ? "" : r[i]]))) };
}
const expected = (name) => JSON.parse(fs.readFileSync(path.join(FIX, `expected-${name}.json`), "utf8"));
const trimmed = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
const TABNAMES = [["Vasi", "vasi"], ["Masterclass", "masterclass"], ["Certificati", "certificati"]];

for (const [file, key] of TABNAMES) {
  test(`parity ${file}: shared conversion is a fixed point on ODS rows`, () => {
    const exp = expected(file);
    for (const row of exp.rows) {
      const fmt = {}, raw = {};
      for (const [k, v] of Object.entries(row)) { if (k.endsWith("__raw")) raw[k.slice(0, -5)] = v; else fmt[k] = v; }
      assert.deepEqual(util.normalizeRow(fmt, raw, live.TABS[key].price), trimmed(row));
    }
  });

  test(`parity ${file}: sheet CSV through the endpoint path == ODS rows`, () => {
    const exp = expected(file);
    const tab = csvTab(file);
    assert.deepEqual(tab.headers, exp.headers);
    const rows = live.parseTab(key, tab);
    assert.equal(rows.length, exp.rows.length);
    rows.forEach((row, i) => {
      const strip = trimmed(Object.fromEntries(Object.entries(exp.rows[i]).filter(([k]) => !k.endsWith("__raw"))));
      assert.deepEqual(row, strip, row.id);
      for (const pk of live.TABS[key].price) {
        assert.equal(money.cellToCents(row, pk), money.cellToCents(exp.rows[i], pk), `${row.id} ${pk}`);
      }
    });
  });
}

const bodyV2 = (tabs, extra) => Object.assign({ version: 2, source: "sheet", sources: {}, items: [], tabs }, extra);
const vRow = (id, extra) => Object.assign({ id, name_it: "Vaso " + id, price_new: "100", venduto: "no", img1: id + ".jpg" }, extra);
const vTab = (rows) => ({ headers: ["id", "name_it", "price_old", "price_new", "venduto", "img1"], rows });
const okFetch = (body) => async () => ({ ok: true, status: 200, json: async () => body });

test("version 2: valid payload gives rows per tab, items Map and unknown columns removed", () => {
  const c = live.parseCatalogue(bodyV2(
    { vasi: vTab([vRow("v1", { extra: "x", price_old: "150" })]), masterclass: null, certificati: null },
    { items: [{ id: "v1", priceCents: 10000, sold: false }] }));
  assert.deepEqual(Object.keys(c.tabs), ["vasi", "masterclass", "certificati"]);
  assert.equal(c.tabs.masterclass, null);
  assert.equal(c.tabs.certificati, null);
  assert.equal(c.items.get("v1").priceCents, 10000);
  assert.deepEqual(c.tabs.vasi, [{ id: "v1", name_it: "Vaso v1", price_old: "150", price_new: "100", venduto: "no", img1: "v1.jpg" }]);
});

test("version 2: invalid top-level shape is rejected", () => {
  const bad = [null, "x", [], {}, { version: 3, items: [] }, { version: 2 }, { version: 2, items: "x" }, { version: 0, items: [] }];
  for (const b of bad) assert.equal(live.parseCatalogue(b), null, JSON.stringify(b));
});

test("version 2: tabs missing or not an object => all tabs null", () => {
  for (const tabs of [undefined, null, "x", 5]) {
    const c = live.parseCatalogue({ version: 2, items: [], tabs });
    assert.deepEqual(c.tabs, { vasi: null, masterclass: null, certificati: null });
  }
});

test("version 1 payload keeps working: items only, tabs null", () => {
  const c = live.parseCatalogue({ version: 1, source: "sheet", items: [{ id: "v1", priceCents: 5000, sold: true }] });
  assert.deepEqual(c.tabs, { vasi: null, masterclass: null, certificati: null });
  assert.deepEqual(c.items.get("v1"), { priceCents: 5000, sold: true });
  // anche se un payload v1 portasse "tabs", viene ignorato
  const c1 = live.parseCatalogue({ version: 1, items: [], tabs: { vasi: vTab([vRow("v1")]) } });
  assert.equal(c1.tabs.vasi, null);
  assert.equal(live.parsePayload({ version: 1, items: [{ id: "a", priceCents: 100, sold: false }] }).size, 1);
});

test("a malformed tab only invalidates that tab", () => {
  const c = quietSync(() => live.parseCatalogue(bodyV2({
    vasi: { headers: ["id", "name_it"], rows: [{ id: "v1" }] },                 // mancano colonne obbligatorie
    masterclass: { headers: ["id", "name_it", "price", "date", "img1"], rows: [{ id: "mc1", name_it: "M", price: "100", date: "01.01.2099", img1: "" }] },
    certificati: { headers: "x", rows: [] }
  })));
  assert.equal(c.tabs.vasi, null);
  assert.equal(c.tabs.masterclass.length, 1);
  assert.equal(c.tabs.certificati, null);
});

test("bad rows are dropped: non-objects, bad/missing/duplicate ids", () => {
  const rows = quietSync(() => live.parseTab("vasi", vTab([
    vRow("v1"), null, "x", [], vRow(""), vRow("bad id"), vRow("v<b>"), vRow("v1", { name_it: "dup" }), vRow("v2"), { name_it: "no id" }
  ])));
  assert.deepEqual(rows.map((r) => r.id), ["v1", "v2"]);
  assert.equal(rows[0].name_it, "Vaso v1");   // vale la prima
});

test("rows present but none valid => tab invalid (falls back to ODS); empty rows => valid empty tab", () => {
  assert.equal(live.parseTab("vasi", vTab([vRow("bad id"), null])), null);
  assert.deepEqual(live.parseTab("vasi", vTab([])), []);
});

test("tab limits and hostile headers", () => {
  assert.equal(live.parseTab("vasi", { headers: ["id", "name_it", "price_new", "venduto", "img1", "__proto__"], rows: [] }), null);
  assert.equal(live.parseTab("vasi", { headers: ["id", "name_it", "price_new", "venduto", "img1", "price_new__raw"], rows: [] }), null);
  assert.equal(live.parseTab("vasi", { headers: ["id", "name_it", "price_new", "venduto", "img1", 7], rows: [] }), null);
  assert.equal(live.parseTab("vasi", vTab(new Array(1001).fill(vRow("v1")))), null);
  // una cella "__raw" non puo' essere iniettata dal foglio: il numerico grezzo non arriva mai da li'
  const [r] = live.parseTab("vasi", vTab([Object.assign(vRow("v1"), { price_new__raw: 1 })]));
  assert.equal("price_new__raw" in r, false);
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
});

test("values: strings trimmed, numbers stringified, other types become empty, missing columns empty", () => {
  const [r] = live.parseTab("vasi", vTab([{ id: " v1 ", name_it: "  Vaso\n", price_new: 120, venduto: true, img1: null }]));
  assert.deepEqual(r, { id: "v1", name_it: "Vaso", price_old: "", price_new: "120", venduto: "", img1: "" });
});

test("'-' and empty values are kept as they are (the render code interprets them)", () => {
  const [r] = live.parseTab("vasi", vTab([vRow("v1", { price_old: "-", img1: "-" })]));
  assert.equal(r.price_old, "-");
  assert.equal(r.img1, "-");
});

test("image names: slashes, backslashes, '..' and control chars are rejected (blanked)", () => {
  const bad = ["../x.jpg", "a/b.jpg", "a\\b.jpg", "..", "x..jpg", "/etc/passwd", "a\u0000.jpg", "a\n.jpg".replace("\n", "\u0007"), "images/catalogue/x.jpg", "http://evil/x.jpg"];
  for (const name of bad) {
    const [r] = quietSync(() => live.parseTab("vasi", vTab([vRow("v1", { img1: name })])));
    assert.equal(r.img1, "", JSON.stringify(name));
  }
  const [ok] = live.parseTab("vasi", vTab([vRow("v1", { img1: " Sale Marina.V2.1.jpg " })]));
  assert.equal(ok.img1, "Sale Marina.V2.1.jpg");
  // anche img2..img6, masterclass e certificati
  const [r2] = quietSync(() => live.parseTab("vasi", { headers: ["id", "name_it", "price_new", "venduto", "img1", "img6"], rows: [{ id: "v1", img1: "a.jpg", img6: "../b.jpg" }] }));
  assert.equal(r2.img6, "");
  assert.equal(r2.img1, "a.jpg");
  assert.equal(util.safeFileName("a b.jpg"), "a b.jpg");
  assert.equal(util.safeFileName("x/y"), "");
});

test("html in sheet text is kept verbatim as data (escaped by the render code, never interpreted here)", () => {
  const evil = `<img src=x onerror=alert(1)>"'&`;
  const [r] = live.parseTab("vasi", vTab([vRow("v1", { name_it: evil })]));
  assert.equal(r.name_it, evil);
  assert.equal(util.escapeHtml(r.name_it), "&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;");
});

test("venduto semantics: si/no and other values are interpreted exactly as for ODS rows", () => {
  const cases = [["si", true], ["SI", true], [" Sì ", true], ["yes", true], ["no", false], ["", false], ["-", false], ["boh", false], ["0", false]];
  for (const [v, sold] of cases) {
    const [r] = live.parseTab("vasi", vTab([vRow("v1", { venduto: v })]));
    assert.equal(util.isSoldFlag(r.venduto), sold, JSON.stringify(v));
  }
});

const odsVasi = () => [
  { id: "v1", name_it: "ODS 1", price_old: "300", price_new: "150", price_new__raw: 150, venduto: "no", img1: "a.jpg" },
  { id: "v2", name_it: "ODS 2", price_old: "-", price_new: "200", price_new__raw: 200, venduto: "no", img1: "b.jpg" }
];
const itemsMap = () => new Map([["v1", { priceCents: 9900, sold: true }]]);

test("chooseData: per-tab fallback, null tabs use the ODS, sheet tab wins without any overlay", () => {
  const ods = { vasi: odsVasi(), masterclass: [{ id: "mc1" }], certificati: null };
  const sheetVasi = [vRow("v9", { price_new: "77" })];
  const l = { items: itemsMap(), tabs: { vasi: sheetVasi, masterclass: null, certificati: null } };
  const c = live.chooseData(l, ods);
  assert.deepEqual(c.sources, { vasi: "sheet", masterclass: "ods", certificati: null });
  assert.equal(c.rows.vasi, sheetVasi);                // nessun overlay sulle righe del foglio
  assert.equal(c.rows.vasi[0].price_new, "77");
  assert.equal(c.rows.masterclass, ods.masterclass);   // nessun overlay sulle masterclass
  assert.equal(c.rows.certificati, null);              // ne' foglio ne' ODS => "non disponibile"
});

test("chooseData: overlay applied only to ODS vasi, from pristine rows, never twice", () => {
  const ods = { vasi: odsVasi(), masterclass: [], certificati: [] };
  const l = { items: itemsMap(), tabs: { vasi: null, masterclass: null, certificati: null } };
  const c1 = live.chooseData(l, ods);
  assert.equal(c1.sources.vasi, "ods");
  assert.equal(money.cellToCents(c1.rows.vasi[0], "price_new"), 9900);
  assert.equal(util.isSoldFlag(c1.rows.vasi[0].venduto), true);
  assert.equal(c1.rows.vasi[1], ods.vasi[1]);
  assert.equal(ods.vasi[0].price_new, "150");          // ODS originale non mutato
  const c2 = live.chooseData(l, ods);                   // secondo giro (re-render): stesso risultato
  assert.deepEqual(c2.rows.vasi, c1.rows.vasi);
});

test("chooseData: no items and no tabs (endpoint failed) => plain ODS rows, same arrays", () => {
  const ods = { vasi: odsVasi(), masterclass: [], certificati: [] };
  for (const l of [live.emptyLive(), null, undefined, {}]) {
    const c = live.chooseData(l, ods);
    assert.equal(c.rows.vasi, ods.vasi);
    assert.deepEqual(c.sources, { vasi: "ods", masterclass: "ods", certificati: "ods" });
  }
  const none = live.chooseData(live.emptyLive(), { vasi: null });
  assert.deepEqual(none.sources, { vasi: null, masterclass: null, certificati: null });
});

test("chooseData: version 1 payload (items, no tabs) overlays the ODS exactly as before", async () => {
  const l = await live.fetchCatalogue(okFetch({ version: 1, source: "sheet", items: [{ id: "v2", priceCents: 12345, sold: false }] }), "u");
  const c = live.chooseData(l, { vasi: odsVasi(), masterclass: [], certificati: [] });
  assert.equal(money.cellToCents(c.rows.vasi[1], "price_new"), 12345);
});

test("fetchCatalogue: success, failures and timeout never throw", async () => {
  const good = await live.fetchCatalogue(okFetch(bodyV2({ vasi: vTab([vRow("v1")]), masterclass: null, certificati: null })), "u");
  assert.equal(good.tabs.vasi.length, 1);
  const empty = live.emptyLive();
  const boom = async () => { throw new Error("net"); };
  const http = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const junk = okFetch({ version: 9 });
  for (const f of [boom, http, junk, null]) {
    const r = await quiet(() => live.fetchCatalogue(f, "u"));
    assert.deepEqual(r, empty);
  }
  const hang = (u, o) => new Promise((_, rej) => o.signal.addEventListener("abort", () => rej(new Error("abort"))));
  const t0 = Date.now();
  assert.deepEqual(await quiet(() => live.fetchCatalogue(hang, "u", 40)), empty);
  assert.ok(Date.now() - t0 < 1000);
});

test("render code never interpolates raw row fields into HTML (static check)", () => {
  const root = path.join(__dirname, "..");
  for (const f of ["Stripe/js/catalogueStripe.js", "masterclass.js", "certificati.js"]) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    assert.doesNotMatch(src, /\$\{\s*(vase|mc|gc|row|item)\./, `${f}: raw field in template`);
  }
});
