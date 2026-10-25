// test/format.test.js  -  CD.money.format: un solo formattatore per tutta la UI
const test = require("node:test");
const assert = require("node:assert/strict");
const { format } = require("../Stripe/js/money.js");

test("format: it and ru use decimal comma and trailing euro sign", () => {
  for (const lang of ["it", "ru"]) {
    assert.equal(format(12000, lang), "120 €");
    assert.equal(format(12050, lang), "120,50 €");
    assert.equal(format(12005, lang), "120,05 €");
    assert.equal(format(99, lang), "0,99 €");
    assert.equal(format(0, lang), "0 €");
    assert.equal(format(1, lang), "0,01 €");
    assert.equal(format(9999999, lang), "99999,99 €");
  }
});

test("format: en uses decimal dot and leading euro sign", () => {
  assert.equal(format(12000, "en"), "€120");
  assert.equal(format(12050, "en"), "€120.50");
  assert.equal(format(12005, "en"), "€120.05");
  assert.equal(format(0, "en"), "€0");
});

test("format: unknown language falls back to the it/ru style; invalid input gives an empty string", () => {
  assert.equal(format(12050, "de"), "120,50 €");
  assert.equal(format(12050, undefined), "120,50 €");
  for (const bad of [null, undefined, "120", 12.5, -1, NaN, Infinity, {}]) assert.equal(format(bad, "it"), "", String(bad));
});
