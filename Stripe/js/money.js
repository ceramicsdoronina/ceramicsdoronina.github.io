// Stripe/js/money.js
// Parser unico euro -> centesimi, condiviso da catalogo, masterclass e carte regalo.
// Caricabile anche in Node (vedi test/money.test.js).
//
// Formati accettati (stringhe):
//   "120", "120€", "€ 120", "120 EUR", "120,5", "120,50", "120.50",
//   "1.234,56", "1,234.56", "1.234" (= 1234, tre cifre dopo il separatore = migliaia)
// Regola: il separatore decimale e' l'ULTIMO "," o "." seguito da 1-2 cifre;
// altrimenti il valore e' intero e "." / "," sono separatori di migliaia
// (gruppi da esattamente 3 cifre).
// Rifiutati (ritorna null, mai 0): vuoto, "-", negativi, testo, notazione
// scientifica, separatori ambigui ("1.5.5", "12,34,56"), 0, > 1e7 centesimi.
// Numeri (valori grezzi delle celle di SheetJS con raw:true) sono accettati cosi' come sono.
(function (root) {
  const MAX_CENTS = 1e7;

  function fromNumber(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    const cents = Math.round(n * 100);
    return cents > 0 && cents <= MAX_CENTS ? cents : null;
  }

  function parseEuroToCents(v) {
    if (typeof v === "number") return fromNumber(v);
    if (typeof v !== "string") return null;

    const s = v.replace(/[\s  ]/g, "").replace(/€|euro|eur/gi, "");
    if (!s || !/^[0-9.,]+$/.test(s)) return null;

    const last = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
    let intPart = s;
    let frac = "";
    if (last >= 0 && /^\d{1,2}$/.test(s.slice(last + 1))) {
      intPart = s.slice(0, last);
      frac = s.slice(last + 1);
    }
    if (!/^(\d+|\d{1,3}([.,]\d{3})+)$/.test(intPart)) return null;

    const euros = Number(intPart.replace(/[.,]/g, ""));
    const cents = euros * 100 + Number((frac + "0").slice(0, 2));
    return Number.isInteger(cents) && cents > 0 && cents <= MAX_CENTS ? cents : null;
  }

  // Legge una colonna prezzo da una riga ODS: preferisce il valore numerico grezzo
  // (chiave "<col>__raw", messa da util.loadOdsRows), poi il testo visualizzato.
  function cellToCents(row, key) {
    if (!row) return null;
    const raw = row[key + "__raw"];
    if (typeof raw === "number") return fromNumber(raw);
    return parseEuroToCents(row[key]);
  }

  const api = { parseEuroToCents, cellToCents, MAX_CENTS };
  root.CD = root.CD || {};
  root.CD.money = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
