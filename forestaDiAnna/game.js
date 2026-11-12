// forestaDiAnna/game.js
// Pagina "gioco": Anna cammina nello studio e i vasi in vendita sono quadretti pixelati sulle mensole.
// Riusa i moduli del sito (CD.util, CD.money, CD.liveCatalogue, CD.cart): stessi dati, stessi prezzi,
// stesso carrello (localStorage dell'origine). Il pagamento resta nel sito principale.
(function () {
  "use strict";

  // ── configurazione della scena (frazioni dell'altezza/larghezza del mondo) ──
  const CFG = {
    CELL_W: 543, CELL_H: 613,         // cella della sprite sheet di Anna
    ANNA_H: 0.46,                     // altezza di Anna (frazione dell'altezza del mondo)
    FLOOR: 0.93,                      // y dei piedi di Anna
    SPEED: 0.36,                      // altezze del mondo al secondo
    STEP_MS: 150,                     // durata di un fotogramma di camminata
    IDLE_FRAME: 1,
    NEAR: 0.09,                       // "vicino" = entro questa frazione dell'altezza
    FRAME: 0.09,                      // lato dei quadretti
    GAP: 0.02,
    // mensole dello sfondo (frazioni della larghezza/altezza dell'immagine): x0..x1 e y = centro dei quadretti
    // (appoggiati sulle tre mensole di destra). La striscia 0.70..1.00 si ripete a destra se i vasi sono tanti.
    STRIP_START: 0.70,
    SHELVES: [{ x0: 0.72, x1: 0.99, y: 0.18 }, { x0: 0.72, x1: 0.99, y: 0.345 }, { x0: 0.72, x1: 0.99, y: 0.505 }],
    BG: "img/studio-bg.png",
    BG_ASPECT: 3
  };

  const T = {
    it: { title: "La foresta di Anna", back: "← Torna al sito", listView: "Vista elenco", mapView: "Torna allo studio", cartAria: "Carrello",
      hint: "Muovi Anna con le frecce o toccando il pavimento. Cerca i quadretti che brillano.",
      loading: "Carico i vasi…", error: "Il catalogo non è disponibile al momento. Riprova più tardi.", none: "Nessun vaso disponibile adesso.",
      add: "Aggiungi al carrello", inCart: "Già nel carrello", added: "Aggiunto al carrello.", failed: "Non posso aggiungerlo: potrebbe essere già venduto.",
      orig: "Vedi foto originale", pix: "Vedi in pixel", pay: "Vai al sito per pagare →", close: "Chiudi", open: "Apri" },
    en: { title: "Anna's forest", back: "← Back to the site", listView: "List view", mapView: "Back to the studio", cartAria: "Cart",
      hint: "Move Anna with the arrow keys or by tapping the floor. Look for the glowing frames.",
      loading: "Loading the vases…", error: "The catalogue is not available right now. Please try again later.", none: "No vase available right now.",
      add: "Add to cart", inCart: "Already in your cart", added: "Added to your cart.", failed: "Cannot add it: it may already be sold.",
      orig: "See original photo", pix: "See in pixels", pay: "Go to the site to pay →", close: "Close", open: "Open" },
    ru: { title: "Лес Анны", back: "← Вернуться на сайт", listView: "Список", mapView: "Вернуться в студию", cartAria: "Корзина",
      hint: "Двигайте Анну стрелками или нажимая на пол. Ищите светящиеся картинки.",
      loading: "Загружаю вазы…", error: "Каталог сейчас недоступен. Попробуйте позже.", none: "Сейчас нет доступных ваз.",
      add: "В корзину", inCart: "Уже в корзине", added: "Добавлено в корзину.", failed: "Не удалось добавить: возможно, ваза уже продана.",
      orig: "Показать оригинал", pix: "Показать в пикселях", pay: "Перейти на сайт для оплаты →", close: "Закрыть", open: "Открыть" }
  };

  const $ = (id) => document.getElementById(id);
  const world = $("world"), shelvesEl = $("shelves"), annaEl = $("anna"), game = $("game");
  const popup = $("popup"), popCanvas = $("pop-canvas"), popOrig = $("pop-orig");

  let lang = "it";
  let items = [];            // { id, p (prodotto per il carrello), titles, text, imgs[], priceCents, x, y, el }
  let dataState = "loading"; // loading | ok | error
  let W = 0, H = 0, VW = 0, bgAspect = CFG.BG_ASPECT, extTiles = 0;
  let x = 0, target = null, pendingOpen = null, facing = 1;
  const keys = { left: false, right: false };
  let padDir = 0, dragging = false;
  let frameIdx = CFG.IDLE_FRAME, frameAcc = 0, last = 0, nearId = null, lastFocus = null, current = null;

  // ── utilità ──
  const t = (k) => (T[lang] && T[lang][k]) || T.it[k] || "";
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorato */ } }
  function pickLang() {
    const s = safeGet("cd_lang") || (navigator.language || "it").slice(0, 2);
    return T[s] ? s : "it";
  }
  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = t("title");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    $("pop-close").setAttribute("aria-label", t("close"));
    $("btn-list").textContent = t($("btn-list").getAttribute("aria-pressed") === "true" ? "mapView" : "listView");
    $("lang").value = lang;
  }
  function say(msg) { $("status").textContent = msg || ""; }

  // ── dati (stessa logica del sito: foglio live se c'è, altrimenti ODS) ──
  async function loadVasiRows() {
    const livePromise = CD.liveCatalogue.fetchCatalogue(window.fetch.bind(window), CD.config.catalogueEndpoint)
      .then((l) => l || CD.liveCatalogue.emptyLive(), () => CD.liveCatalogue.emptyLive());
    const live = await livePromise;
    if (live && live.tabs && Array.isArray(live.tabs.vasi)) return CD.liveCatalogue.chooseData(live, {}).rows.vasi;
    let ods = null;
    try { ods = await CD.util.loadOdsRows("../catalogue/vasi.ods", ["price_old", "price_new"]); }
    catch (err) { console.error("[GIOCO] ODS non caricato:", err); }
    return CD.liveCatalogue.chooseData(live, { vasi: ods }).rows.vasi;
  }

  function nameOf(row, l) {
    const v = row["name_" + l];
    return v && v !== "-" ? v : (row.name_ru || row.name_it || "");
  }
  function textOf(row, l) {
    const pick = (b) => { const v = row[b + "_" + l]; return v && v !== "-" ? v : (row[b + "_ru"] && row[b + "_ru"] !== "-" ? row[b + "_ru"] : ""); };
    return pick("short") || pick("long");
  }

  function buildItems(rows) {
    const seen = new Set(), out = [];
    (rows || []).forEach((row) => {
      const id = String(row.id == null ? "" : row.id).trim();
      if (!id || !CD.util.isValidId(id) || seen.has(id)) return;
      seen.add(id);
      if (CD.util.isSoldFlag(row.venduto) || CD.util.isSoldOverride(id)) return;
      const priceCents = CD.money.cellToCents(row, "price_new");
      if (!(priceCents > 0)) return;
      const files = [row.img1, row.img2, row.img3, row.img4, row.img5, row.img6]
        .map((s) => String(s == null ? "" : s).trim()).filter((s) => s && s !== "-");
      const rel = (f) => "images/catalogue/" + encodeURIComponent(f);
      out.push({
        id, row, priceCents,
        imgs: files.map((f) => "../" + rel(f)),
        p: {
          id, type: "physical", sold: false, priceCents, currency: "EUR",
          img: files.length ? rel(files[0]) : "images/placeholder.svg", maxQty: 1,
          titles: { it: nameOf(row, "it"), en: nameOf(row, "en"), ru: nameOf(row, "ru") }
        }
      });
    });
    return out;
  }

  // ── pixelatura delle foto ──
  const LEVELS = 7, CROP = 0.72;
  function pixelate(url, canvas, size) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = canvas.height = size;
        const s = Math.min(img.naturalWidth, img.naturalHeight) * CROP;   // ritaglio stretto al centro: il vaso risulta piu' grande
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        try {
          const d = ctx.getImageData(0, 0, size, size), a = d.data, k = (LEVELS - 1) / 255;
          for (let i = 0; i < a.length; i += 4) {
            a[i] = Math.round(a[i] * k) / k; a[i + 1] = Math.round(a[i + 1] * k) / k; a[i + 2] = Math.round(a[i + 2] * k) / k;
          }
          ctx.putImageData(d, 0, 0);
        } catch (e) { /* senza posterizzazione */ }
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  // ── geometria ──
  function slotsPerTile(bgW, size, step) {
    return CFG.SHELVES.map((sh) => Math.max(1, Math.floor(((sh.x1 - sh.x0) * bgW) / step)));
  }

  function layout() {
    VW = window.innerWidth; H = window.innerHeight;
    const bgW = Math.round(H * bgAspect), stripW = (1 - CFG.STRIP_START) * bgW;
    const size = CFG.FRAME * H, step = size + CFG.GAP * H;
    const perTile = slotsPerTile(bgW, size, step).reduce((a, b) => a + b, 0);
    extTiles = items.length > perTile ? Math.ceil((items.length - perTile) / perTile) : 0;
    W = Math.round(bgW + extTiles * stripW);
    world.style.width = W + "px";
    const ext = $("ext");
    ext.style.left = bgW + "px"; ext.style.width = (extTiles * stripW) + "px"; ext.hidden = extTiles === 0;
    world.style.backgroundSize = bgW + "px 100%";
    const ah = CFG.ANNA_H * H, aw = ah * CFG.CELL_W / CFG.CELL_H;
    annaEl.style.width = aw + "px"; annaEl.style.height = ah + "px"; annaEl.style.top = (CFG.FLOOR * H - ah) + "px";
    placeFrames();
    x = Math.min(Math.max(x, 0.04 * W), W - 0.04 * W);
  }

  // Posti: prima le mensole dello sfondo, poi quelle delle strisce ripetute a destra.
  function placeFrames() {
    const bgW = Math.round(H * bgAspect), stripW = (1 - CFG.STRIP_START) * bgW;
    const size = CFG.FRAME * H, step = size + CFG.GAP * H;
    const slots = [];
    for (let k = 0; k <= extTiles; k++) {
      const tileStart = k === 0 ? CFG.STRIP_START * bgW : bgW + (k - 1) * stripW;
      CFG.SHELVES.forEach((sh) => {
        const x0 = tileStart + (sh.x0 - CFG.STRIP_START) * bgW, x1 = tileStart + (sh.x1 - CFG.STRIP_START) * bgW;
        const n = Math.max(1, Math.floor((x1 - x0) / step)), start = x0 + ((x1 - x0) - n * step) / 2 + step / 2;
        for (let i = 0; i < n; i++) slots.push({ x: start + i * step, y: sh.y * H });
      });
    }
    // ordine: mensola per mensola dall'alto, tile per tile
    items.forEach((it, i) => {
      const s = slots[i];
      if (!s) { it.x = null; if (it.el) it.el.hidden = true; return; }
      it.x = s.x; it.y = s.y;
      if (it.el) {
        it.el.hidden = false;
        it.el.style.left = s.x + "px"; it.el.style.top = s.y + "px";
        it.el.style.width = size + "px"; it.el.style.height = size + "px";
      }
    });
  }

  // ── rendering di quadretti ed elenco ──
  function renderItems() {
    shelvesEl.textContent = "";
    items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "frame"; b.dataset.id = it.id;
      b.setAttribute("aria-label", it.p.titles[lang] + " — " + CD.money.format(it.priceCents, lang));
      const art = document.createElement("span"); art.className = "art";
      const c = document.createElement("canvas"); c.width = c.height = 40; art.appendChild(c); b.appendChild(art);
      b.addEventListener("click", (e) => { e.stopPropagation(); goTo(it); });
      b.addEventListener("pointerdown", (e) => e.stopPropagation());
      shelvesEl.appendChild(b);
      it.el = b; it.canvas = c;
      if (it.imgs[0]) pixelate(it.imgs[0], c, 40);
    });
    placeFrames();
    renderList();
  }

  function renderList() {
    const box = $("list");
    box.textContent = "";
    if (!items.length) return;
    const ul = document.createElement("ul");
    items.forEach((it) => {
      const li = document.createElement("li"), b = document.createElement("button");
      b.type = "button";
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const n = document.createElement("span"); n.className = "nm"; n.textContent = it.p.titles[lang];
      const pr = document.createElement("span"); pr.className = "pr"; pr.textContent = CD.money.format(it.priceCents, lang);
      b.append(c, n, pr);
      b.addEventListener("click", () => openPopup(it));
      li.appendChild(b); ul.appendChild(li);
      if (it.imgs[0]) pixelate(it.imgs[0], c, 64);
    });
    box.appendChild(ul);
  }

  // ── carrello (stesso formato e stessa chiave del sito) ──
  function readCart() {
    let arr = [];
    try { const p = JSON.parse(safeGet(CD.cart.CART_KEY) || "[]"); arr = Array.isArray(p) ? p : []; } catch (e) { arr = []; }
    return CD.cart.sanitizeCart(arr).cart;
  }
  function inCart(id) { return readCart().some((l) => l.id === id); }
  function updateCartCount() { $("cart-count").textContent = String(readCart().length); }
  function addToCart(it) {
    const res = CD.cart.mergeAdd(readCart(), it.p, 1, { name: it.p.titles[lang] || it.id });
    if (res.status === "added") { safeSet(CD.cart.CART_KEY, JSON.stringify(res.cart)); updateCartCount(); return "added"; }
    return res.status;   // already | max | invalid
  }

  // ── popup ──
  function openPopup(it) {
    current = it; lastFocus = document.activeElement;
    $("pop-title").textContent = it.p.titles[lang];
    $("pop-text").textContent = textOf(it.row, lang);
    $("pop-price").textContent = CD.money.format(it.priceCents, lang);
    $("pop-msg").textContent = "";
    $("pop-pay").hidden = true; $("pop-pay").textContent = t("pay");
    popOrig.hidden = true; popCanvas.hidden = false;
    popOrig.src = it.imgs[0] || ""; popOrig.alt = it.p.titles[lang];
    $("pop-orig-btn").textContent = t("orig"); $("pop-orig-btn").setAttribute("aria-pressed", "false");
    $("pop-orig-btn").hidden = !it.imgs[0];
    if (it.imgs[0]) pixelate(it.imgs[0], popCanvas, 96);
    refreshAddButton();
    if (typeof popup.showModal === "function") { if (!popup.open) popup.showModal(); } else popup.setAttribute("open", "");
    $("pop-add").focus();
  }
  function refreshAddButton() {
    const b = $("pop-add"), have = current && inCart(current.id);
    b.textContent = have ? t("inCart") : t("add"); b.disabled = !!have;
    $("pop-pay").hidden = !have;
  }
  function closePopup() {
    if (popup.open) { if (typeof popup.close === "function") popup.close(); else popup.removeAttribute("open"); }
    current = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ── movimento ──
  function goTo(it) {
    if (it.x == null) { openPopup(it); return; }
    if (Math.abs(it.x - x) <= CFG.NEAR * H) { openPopup(it); return; }
    target = it.x; pendingOpen = it;
  }
  function nearest() {
    let best = null, bd = Infinity;
    items.forEach((it) => { if (it.x == null) return; const d = Math.abs(it.x - x); if (d < bd) { bd = d; best = it; } });
    return best && bd <= CFG.NEAR * H ? best : null;
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    let dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + padDir;
    dir = Math.max(-1, Math.min(1, dir));
    if (popup.open) dir = 0;
    if (dir) { target = null; pendingOpen = null; }
    else if (target != null) {
      const dx = target - x;
      if (Math.abs(dx) <= 4) { x = target; target = null; if (pendingOpen) { const p = pendingOpen; pendingOpen = null; openPopup(p); } }
      else dir = Math.sign(dx);
    }
    const walking = dir !== 0;
    if (walking) {
      const stepPx = CFG.SPEED * H * dt;
      let nx = x + dir * stepPx;
      if (target != null && ((dir > 0 && nx > target) || (dir < 0 && nx < target))) nx = target;
      x = Math.min(Math.max(nx, 0.04 * W), W - 0.04 * W);
      facing = dir;
      frameAcc += dt * 1000;
      if (frameAcc >= CFG.STEP_MS) { frameAcc = 0; frameIdx = (frameIdx + 1) % 4; }
    } else { frameIdx = CFG.IDLE_FRAME; frameAcc = 0; }

    const aw = parseFloat(annaEl.style.width) || 0;
    annaEl.style.left = (x - aw / 2) + "px";
    annaEl.style.backgroundPosition = (frameIdx * 100 / 3) + "% 0";
    annaEl.classList.toggle("left", facing < 0);

    const cam = Math.min(Math.max(x - VW / 2, 0), Math.max(0, W - VW));
    world.style.transform = "translate3d(" + (-cam) + "px,0,0)";

    const n = nearest(), id = n ? n.id : null;
    if (id !== nearId) {
      nearId = id;
      items.forEach((it) => it.el && it.el.classList.toggle("near", it.id === id));
    }
    requestAnimationFrame(tick);
  }

  // ── eventi ──
  function bind() {
    window.addEventListener("keydown", (e) => {
      if (popup.open || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") { keys.left = true; e.preventDefault(); }
      else if (k === "ArrowRight" || k === "d" || k === "D") { keys.right = true; e.preventDefault(); }
      else if ((k === "Enter" || k === " ") && document.activeElement === document.body) { const n = nearest(); if (n) { e.preventDefault(); openPopup(n); } }
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
      if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
    });
    window.addEventListener("blur", () => { keys.left = keys.right = false; padDir = 0; dragging = false; });

    const holdPad = (id, dir) => {
      const b = $(id);
      const on = (e) => { e.preventDefault(); padDir = dir; };
      const off = () => { if (padDir === dir) padDir = 0; };
      b.addEventListener("pointerdown", on);
      ["pointerup", "pointercancel", "pointerleave"].forEach((n) => b.addEventListener(n, off));
    };
    holdPad("pad-left", -1); holdPad("pad-right", 1);

    const worldX = (e) => e.clientX + Math.min(Math.max(x - VW / 2, 0), Math.max(0, W - VW));
    game.addEventListener("pointerdown", (e) => {
      if (popup.open || e.target.closest(".hud, .pad, .list, .frame")) return;
      dragging = true; target = worldX(e); pendingOpen = null;
    });
    game.addEventListener("pointermove", (e) => { if (dragging) target = worldX(e); });
    ["pointerup", "pointercancel"].forEach((n) => window.addEventListener(n, () => { dragging = false; }));

    $("btn-list").addEventListener("click", () => {
      const on = $("btn-list").getAttribute("aria-pressed") !== "true";
      $("btn-list").setAttribute("aria-pressed", String(on));
      $("list").hidden = !on; $("btn-list").textContent = t(on ? "mapView" : "listView");
    });
    $("lang").addEventListener("change", (e) => { lang = T[e.target.value] ? e.target.value : "it"; safeSet("cd_lang", lang); applyStatic(); renderItems(); setStatus(); });

    $("pop-close").addEventListener("click", closePopup);
    popup.addEventListener("click", (e) => { if (e.target === popup) closePopup(); });
    popup.addEventListener("cancel", () => { current = null; });
    popup.addEventListener("close", () => { current = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); });
    $("pop-add").addEventListener("click", () => {
      if (!current) return;
      const r = addToCart(current);
      $("pop-msg").textContent = r === "added" ? t("added") : (r === "already" ? t("inCart") : t("failed"));
      refreshAddButton();
    });
    $("pop-orig-btn").addEventListener("click", () => {
      const showOrig = popOrig.hidden;
      popOrig.hidden = !showOrig; popCanvas.hidden = showOrig;
      $("pop-orig-btn").textContent = t(showOrig ? "pix" : "orig");
      $("pop-orig-btn").setAttribute("aria-pressed", String(showOrig));
    });

    window.addEventListener("resize", layout);
    window.addEventListener("storage", updateCartCount);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { updateCartCount(); if (current) refreshAddButton(); } });
    setTimeout(() => $("hint").classList.add("gone"), 9000);
  }

  function setStatus() {
    say(dataState === "loading" ? t("loading") : dataState === "error" ? t("error") : (items.length ? "" : t("none")));
  }

  async function init() {
    lang = pickLang();
    applyStatic(); updateCartCount(); setStatus();
    // proporzioni dello sfondo (se manca, resta il colore di riserva)
    await new Promise((res) => {
      const im = new Image();
      im.onload = () => { if (im.naturalHeight) bgAspect = im.naturalWidth / im.naturalHeight; res(); };
      im.onerror = () => res();
      im.src = CFG.BG;
    });
    layout(); x = 0.08 * W;
    bind();
    requestAnimationFrame(tick);
    try {
      const rows = await loadVasiRows();
      if (!Array.isArray(rows)) throw new Error("catalogo non disponibile");
      items = buildItems(rows); dataState = "ok";
    } catch (err) {
      console.error("[GIOCO]", err); items = []; dataState = "error";
    }
    layout(); renderItems(); setStatus();
  }

  window.__annaGame = { CFG, pixelate, open: (i) => items[i] && openPopup(items[i]), count: () => items.length };   // per prove manuali
  init();
})();
