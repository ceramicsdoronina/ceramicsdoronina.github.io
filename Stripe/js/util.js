// Stripe/js/util.js
// Helper condivisi: escape HTML, validazione id, flag "venduto", date evento, lettura ODS,
// registro prodotti, delegati di eventi (modali, "Compra"), lazy-load immagini.
(function (root) {
  const ID_RE = /^[A-Za-z0-9_-]+$/;
  const EVENT_TZ = "Europe/Rome";

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

  // ─────────────────────────────────────────────
  // Date evento
  // ─────────────────────────────────────────────
  // Formati: dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd. Con piu' date (intervallo
  // "10.12.2026 - 12.12.2026") vale l'ULTIMA. La data deve fare round-trip (31.02 rifiutata).
  // Ritorna {y, m, d} oppure null.
  function parseEventDateParts(str) {
    const s = String(str == null ? "" : str);
    const found = [];
    let m;
    const dmy = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g;
    while ((m = dmy.exec(s))) found.push({ at: m.index, y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) });
    const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
    while ((m = iso.exec(s))) found.push({ at: m.index, y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) });
    if (!found.length) return null;

    found.sort((a, b) => a.at - b.at);
    const last = found[found.length - 1];
    const chk = new Date(Date.UTC(last.y, last.m - 1, last.d));
    if (chk.getUTCFullYear() !== last.y || chk.getUTCMonth() !== last.m - 1 || chk.getUTCDate() !== last.d) return null;
    return { y: last.y, m: last.m, d: last.d };
  }

  // Date locale a mezzanotte (o null). Mantenuta per compatibilita'.
  function parseEventDate(str) {
    const p = parseEventDateParts(str);
    return p ? new Date(p.y, p.m - 1, p.d) : null;
  }

  // "Oggi" nel fuso Europe/Rome come {y, m, d}. Scelta: un evento resta visibile per tutta la
  // sua ultima giornata (fino alle 23:59 ora italiana), indipendentemente dal fuso del browser.
  function romeToday(now) {
    const t = now || new Date();
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: EVENT_TZ, year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(t);
      const get = (type) => Number(parts.find((p) => p.type === type).value);
      return { y: get("year"), m: get("month"), d: get("day") };
    } catch (_) {
      return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
    }
  }

  const warnedDates = new Set();

  // true solo se la data (ultima, se piu' d'una) e' strettamente anteriore a oggi (Europe/Rome).
  // Data non vuota ma non interpretabile: avviso una volta, l'evento resta visibile.
  function isPastEvent(str, now) {
    const p = parseEventDateParts(str);
    if (!p) {
      const raw = String(str == null ? "" : str).trim();
      if (raw && raw !== "-" && !warnedDates.has(raw)) {
        warnedDates.add(raw);
        console.warn("[EVENTI] data non interpretabile, evento mostrato:", raw);
      }
      return false;
    }
    const today = romeToday(now);
    const key = (x) => x.y * 10000 + x.m * 100 + x.d;
    return key(p) < key(today);
  }

  // ─────────────────────────────────────────────
  // Lettura ODS
  // ─────────────────────────────────────────────
  // SheetJS e' caricato in modo asincrono da index.html (window.__xlsxReady: promise che si risolve
  // al caricamento e si rifiuta su errore/timeout). Il fetch dell'ODS parte subito; si attende
  // SheetJS solo per XLSX.read.
  function xlsxReady() {
    if (root.__xlsxReady) return root.__xlsxReady;
    if (typeof XLSX !== "undefined") return Promise.resolve();
    return Promise.reject(new Error("SheetJS (XLSX) non caricato"));
  }

  // Lancia in caso di errore (nessun fallback silenzioso).
  // priceKeys: colonne prezzo per cui conservare il valore numerico grezzo in "<col>__raw".
  async function loadOdsRows(url, priceKeys) {
    const bufP = fetch(url, { cache: "no-cache" }).then((res) => {
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res.arrayBuffer();
    });
    const [buf] = await Promise.all([bufP, xlsxReady()]);

    const workbook = XLSX.read(buf, { type: "array" });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: "" });
    const raws = XLSX.utils.sheet_to_json(ws, { raw: true, defval: "" });
    if (rows.length === raws.length) {
      rows.forEach((row, i) => {
        (priceKeys || []).forEach((k) => {
          if (typeof raws[i][k] === "number") row[k + "__raw"] = raws[i][k];
        });
      });
    } else {
      console.warn(`[ODS] ${url}: righe formattate (${rows.length}) e grezze (${raws.length}) non coincidono, valori numerici grezzi ignorati`);
    }
    return rows;
  }

  // ─────────────────────────────────────────────
  // Messaggio "non disponibile" nelle griglie
  // ─────────────────────────────────────────────
  function renderUnavailable(gridId) {
    const grid = root.document && root.document.getElementById(gridId);
    if (!grid) return;
    const msg = (root.CD && root.CD.i18n && root.CD.i18n.t && root.CD.i18n.t("catalogue.unavailable"))
      || "The catalogue is currently unavailable. Please reload the page.";
    grid.innerHTML = `<p class="catalogue-unavailable" role="alert">${escapeHtml(msg)}</p>`;
  }

  // ─────────────────────────────────────────────
  // Registro prodotti (CD.shop.products) con regola unica di pulizia per sorgente
  // ─────────────────────────────────────────────
  const soldOverride = new Set();   // id segnati "venduti" dal server in questa sessione

  function shopProducts() {
    root.CD = root.CD || {};
    root.CD.shop = root.CD.shop || {};
    root.CD.shop.products = root.CD.shop.products || {};
    return root.CD.shop.products;
  }

  // source: "catalogue" | "masterclass" | "certificati". Ritorna il prodotto registrato.
  function registerProduct(source, product) {
    const prod = Object.assign({}, product, { source, sold: !!product.sold || soldOverride.has(product.id) });
    shopProducts()[prod.id] = prod;
    return prod;
  }

  // Regola unica: ogni render svuota i prodotti della propria sorgente prima di ri-registrare.
  function clearProducts(source) {
    const reg = shopProducts();
    Object.keys(reg).forEach((k) => { if (reg[k] && reg[k].source === source) delete reg[k]; });
  }

  function markSold(id) {
    soldOverride.add(id);
    const p = shopProducts()[id];
    if (p) p.sold = true;
  }

  function isSoldOverride(id) {
    return soldOverride.has(id);
  }

  // ─────────────────────────────────────────────
  // Prezzi non validi
  // ─────────────────────────────────────────────
  // Errore in console se la cella e' non vuota, non "-" e non interpretabile (articolo non venduto).
  function warnBadPrice(tag, id, row, key, cents, sold) {
    if (sold || cents) return;
    const raw = String(row && row[key] != null ? row[key] : "").trim();
    if (raw && raw !== "-") console.error(`[${tag}] prezzo non valido`, id, JSON.stringify(raw));
  }

  // ─────────────────────────────────────────────
  // Campo localizzato <base>_<lang> con fallback
  // ─────────────────────────────────────────────
  function pickLangField(obj, base, lang, fallback) {
    const fb = fallback || "it";
    const v1 = obj[`${base}_${lang}`];
    if (v1 && v1 !== "-") return v1;
    const v2 = obj[`${base}_${fb}`];
    if (v2 && v2 !== "-") return v2;
    return obj[`${base}_en`] || obj[`${base}_ru`] || "";
  }

  // ─────────────────────────────────────────────
  // Immagini lazy (data-src) e gallerie
  // ─────────────────────────────────────────────
  function loadLazyImgs(imgs) {
    Array.from(imgs || []).forEach((img) => {
      const ds = img.getAttribute("data-src");
      if (ds && !img.getAttribute("src")) img.setAttribute("src", ds);
    });
  }

  // Carica l'immagine di indice idx e la vicina nella direzione dir (+1 / -1), con wrap.
  function loadNeighbours(imgs, idx, dir) {
    const n = imgs.length;
    if (!n) return;
    const i = ((idx % n) + n) % n;
    const j = (((i + (dir < 0 ? -1 : 1)) % n) + n) % n;
    loadLazyImgs([imgs[i], imgs[j]]);
  }

  // Rende attiva imgs[index]; se l'immagine non e' ancora caricata, la slide precedente resta
  // visibile fino all'evento load/error. state.seq scarta swap superati da click piu' recenti.
  function activateSlide(imgs, index, state, done) {
    const img = imgs[index];
    if (!img) return;
    const st = state || {};
    const mine = (st.seq = (st.seq || 0) + 1);
    const swap = () => {
      if (st.seq !== mine) return;
      imgs.forEach((x, k) => x.classList.toggle("active", k === index));
      if (done) done();
    };
    const ds = img.getAttribute("data-src");
    if (ds && !img.getAttribute("src")) {
      img.addEventListener("load", swap, { once: true });
      img.addEventListener("error", swap, { once: true });
      img.setAttribute("src", ds);
    } else {
      swap();
    }
  }

  // ─────────────────────────────────────────────
  // Delegati di eventi (un solo listener per tipo, registrati una volta)
  // ─────────────────────────────────────────────
  let modalDelegateBound = false;

  function openModal(modal) {
    modal.classList.add("open");
    const gallery = Array.from(modal.querySelectorAll(".modal-gallery-main img"));
    if (gallery.length) {
      const active = gallery.findIndex((img) => img.classList.contains("active"));
      loadNeighbours(gallery, active < 0 ? 0 : active, 1);
    }
    loadLazyImgs(Array.from(modal.querySelectorAll("img[data-src]")).filter((img) => !gallery.includes(img)));
  }

  // Apertura/chiusura di TUTTI i modali ([data-modal-target], [data-modal-close], sfondo).
  function bindModalDelegate() {
    if (modalDelegateBound || !root.document) return;
    modalDelegateBound = true;

    root.document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-modal-target]");
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        const modal = root.document.getElementById(trigger.dataset.modalTarget);
        if (modal) openModal(modal);
        return;
      }

      const close = e.target.closest("[data-modal-close]");
      if (close) {
        e.preventDefault();
        e.stopPropagation();
        const modal = close.closest(".modal");
        if (modal) modal.classList.remove("open");
        return;
      }

      if (e.target.classList && e.target.classList.contains("modal")) e.target.classList.remove("open");
    });
  }

  const boundCartSelectors = new Set();

  // Pulsanti "Compra": un solo delegato per selettore (default [data-add-to-cart]),
  // valido per vasi, masterclass e carte regalo.
  function bindAddToCart(selector) {
    const sel = selector || "[data-add-to-cart]";
    if (boundCartSelectors.has(sel) || !root.document) return;
    boundCartSelectors.add(sel);
    const attr = sel.replace(/^\[|\]$/g, "");

    root.document.addEventListener("click", async (e) => {
      const btn = e.target.closest(sel);
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      const pid = String(btn.getAttribute(attr) || "").trim();
      if (!pid || pid === "-") return;

      const notifyFail = () => {
        const msg = (root.CD && CD.i18n && CD.i18n.t && CD.i18n.t("cart.addFailed"))
          || "Could not add the item to your cart. Please try again.";
        if (root.CD && CD.shop && CD.shop.showNotice) CD.shop.showNotice(msg);
        else root.alert(msg);
      };

      if (!root.CD || !CD.shop || !CD.shop.addProduct) {
        console.error("[CART] CD.shop.addProduct non disponibile (uiStripe.js non caricato?)");
        notifyFail();
        return;
      }

      try {
        const ok = await CD.shop.addProduct(pid, 1);
        if (!ok) {
          console.warn("[CART] Non aggiunto:", pid);
          notifyFail();
        }
      } catch (err) {
        console.error("[CART] Errore add-to-cart", err);
        notifyFail();
      }
    }, false);
  }

  const api = {
    escapeHtml, isValidId, isSoldFlag,
    parseEventDate, parseEventDateParts, romeToday, isPastEvent,
    loadOdsRows, renderUnavailable,
    registerProduct, clearProducts, markSold, isSoldOverride,
    warnBadPrice, pickLangField,
    loadLazyImgs, loadNeighbours, activateSlide,
    bindModalDelegate, bindAddToCart,
    ID_RE
  };
  root.CD = root.CD || {};
  root.CD.util = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
