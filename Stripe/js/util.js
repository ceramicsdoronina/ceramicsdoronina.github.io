// Stripe/js/util.js
// Helper condivisi: escape HTML, validazione id, flag "venduto", date, lettura ODS.
(function (root) {
  const ID_RE = /^[A-Za-z0-9_-]+$/;

  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isValidId(id) {
    return typeof id === "string" && ID_RE.test(id);
  }

  // "Si", "sì", " SI ", "yes", "sold" ... -> true
  function isSoldFlag(v) {
    const s = String(v == null ? "" : v)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .trim().toLowerCase();
    return ["si", "yes", "sold", "venduto", "true", "1", "y"].includes(s);
  }

  // Data evento "dd.mm.yyyy" (anche con / o -): ritorna Date locale o null.
  function parseEventDate(str) {
    const m = String(str || "").match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function isPastEvent(str, now) {
    const d = parseEventDate(str);
    if (!d) return false;
    const t = now || new Date();
    const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return d < today;
  }

  // Legge un file ODS e ritorna le righe. Lancia in caso di errore (nessun fallback silenzioso).
  // priceKeys: colonne prezzo per cui conservare il valore numerico grezzo in "<col>__raw".
  async function loadOdsRows(url, priceKeys) {
    if (typeof XLSX === "undefined") throw new Error("SheetJS (XLSX) non caricato");
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);

    const workbook = XLSX.read(await res.arrayBuffer(), { type: "array" });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });
    const raws = XLSX.utils.sheet_to_json(ws, { raw: true, defval: "" });
    if (rows.length === raws.length) {
      rows.forEach((row, i) => {
        (priceKeys || []).forEach((k) => {
          if (typeof raws[i][k] === "number") row[k + "__raw"] = raws[i][k];
        });
      });
    }
    return rows;
  }

  const api = { escapeHtml, isValidId, isSoldFlag, parseEventDate, isPastEvent, loadOdsRows, ID_RE };
  root.CD = root.CD || {};
  root.CD.util = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
