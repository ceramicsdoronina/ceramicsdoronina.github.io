// test/money.test.js  -  esegui con: node --test test/money.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseEuroToCents, cellToCents } = require("../Stripe/js/money.js");
const fixture = require("./fixtures/price-cases.json");

// Casi condivisi con il test python di cents() nella repo della funzione.
test("shared price-cases fixture: valid / reject / differ", () => {
  for (const [input, cents] of fixture.valid) assert.equal(parseEuroToCents(input), cents, `valid ${JSON.stringify(input)}`);
  for (const input of fixture.reject) assert.equal(parseEuroToCents(input), null, `reject ${JSON.stringify(input)}`);
  for (const c of fixture.differ) assert.equal(parseEuroToCents(c.input), c.js, `differ ${JSON.stringify(c.input)}`);
});

test("parseEuroToCents table", () => {
  const table = [
    ["120", 12000], ["120€", 12000], ["€ 120", 12000], ["120 EUR", 12000], [" 120 € ", 12000],
    ["120,5", 12050], ["120,50", 12050], ["120.50", 12050], ["0,99", 99], ["0.05", 5],
    ["1.234,56", 123456], ["1,234.56", 123456], ["1.234", 123400], ["1,234", 123400],
    ["12.345.678", null], // oltre il limite di 1e7 centesimi
    [120, 12000], [120.5, 12050], [0.01, 1], [99999.99, 9999999],
    ["", null], ["-", null], [null, null], [undefined, null], [{}, null],
    ["-5", null], ["abc", null], ["12abc", null], ["1e3", null], ["NaN", null],
    ["0", null], ["0,00", null], [0, null], [-3, null], [NaN, null], [Infinity, null],
    ["1.5.5", null], ["12,34,56", null], ["100.", null], [".5", null], [",50", null],
    ["100001", null], ["100000", 10000000], ["100000,01", null],
  ];
  for (const [input, expected] of table) {
    assert.equal(parseEuroToCents(input), expected, `input ${JSON.stringify(input)}`);
  }
});

test("cellToCents prefers raw numeric value", () => {
  assert.equal(cellToCents({ price_new: "120 €", price_new__raw: 120 }, "price_new"), 12000);
  assert.equal(cellToCents({ price_new: "120,50" }, "price_new"), 12050);
  assert.equal(cellToCents({ price_new: "-" }, "price_new"), null);
  assert.equal(cellToCents(null, "x"), null);
});
