// forestaDiAnna/game.js
// Pagina "gioco": Anna cammina nello studio e nel salotto; i vasi in vendita sono sprite pixel-art appoggiati
// su mensole e mobili, le carte regalo sono buste sulla credenza. Al clic si apre la FOTO VERA con il carrello.
// Riusa i moduli del sito (CD.util, CD.money, CD.liveCatalogue, CD.cart): stessi dati, stessi prezzi,
// stesso carrello (localStorage dell'origine). Il pagamento resta nel sito principale.
(function () {
  "use strict";

  // ── scena (frazioni della larghezza/altezza di OGNI immagine di sfondo) ──
  // Slot: { bg: "studio"|"room", x, y } dove y = linea della superficie su cui l'oggetto poggia.
  const CFG = {
    CELL_W: 543, CELL_H: 613,         // cella della sprite sheet di Anna
    ANNA_H: 0.46,                     // altezza di Anna (frazione dell'altezza del mondo)
    FLOOR: 0.93,                      // y dei piedi di Anna
    SPEED: 0.6,                       // altezze del mondo al secondo
    STEP_MS: 150,                     // durata di un fotogramma di camminata
    IDLE_FRAME: 1,
    NEAR: 0.09,                       // "vicino" = entro questa frazione dell'altezza
    FALLBACK_FRAME: 0.09,             // lato del quadretto se manca lo sprite del vaso
    // scene affiancate da sinistra a destra: ingresso con gli attrezzi, salotto, forno e mensola principale
    SEGMENTS: [{ id: "start", src: "img/start-bg.png" }, { id: "room", src: "img/showroom-bg.png" }, { id: "studio", src: "img/studio-right.png" }],
    VASE_DIR: "img/vases/", GIFT_SPRITE: "img/gift.png",
    // altezza dello sprite = base + cm * per_cm (frazione dell'altezza del mondo); i vasi piu' alti risultano piu' alti
    VASE_BASE: 0.045, VASE_PER_CM: 0.0019, GIFT_H: 0.075,
    VASE_SLOTS: [], CARD_SLOTS: []    // vedi scene.js
  };
  Object.assign(CFG, window.__ANNA_SCENE || {});

  const T = {
    it: { title: "La foresta di Anna", back: "← Torna al sito", listView: "Vista elenco", mapView: "Torna allo studio", cartAria: "Carrello",
      hint: "Muovi Anna con le frecce o toccando il pavimento. Cerca gli oggetti che brillano.",
      loading: "Carico i prodotti…", error: "Il catalogo non è disponibile al momento. Riprova più tardi.", none: "Nessun prodotto disponibile adesso.",
      vases: "Vasi", cards: "Carte regalo",
      add: "Aggiungi al carrello", inCart: "Già nel carrello", added: "Aggiunto al carrello.", failed: "Non posso aggiungerlo: potrebbe essere già venduto.",
      site: "Vedi sul sito principale →", prev: "Foto precedente", next: "Foto successiva", pay: "Vai al sito per pagare →", close: "Chiudi", photo: "Foto" },
    en: { title: "Anna's forest", back: "← Back to the site", listView: "List view", mapView: "Back to the studio", cartAria: "Cart",
      hint: "Move Anna with the arrow keys or by tapping the floor. Look for the glowing objects.",
      loading: "Loading the products…", error: "The catalogue is not available right now. Please try again later.", none: "No product available right now.",
      vases: "Vases", cards: "Gift cards",
      add: "Add to cart", inCart: "Already in your cart", added: "Added to your cart.", failed: "Cannot add it: it may already be sold.",
      site: "See it on the main site →", prev: "Previous photo", next: "Next photo", pay: "Go to the site to pay →", close: "Close", photo: "Photo" },
    ru: { title: "Лес Анны", back: "← Вернуться на сайт", listView: "Список", mapView: "Вернуться в студию", cartAria: "Корзина",
      hint: "Двигайте Анну стрелками или нажимая на пол. Ищите светящиеся предметы.",
      loading: "Загружаю товары…", error: "Каталог сейчас недоступен. Попробуйте позже.", none: "Сейчас нет доступных товаров.",
      vases: "Вазы", cards: "Подарочные сертификаты",
      add: "В корзину", inCart: "Уже в корзине", added: "Добавлено в корзину.", failed: "Не удалось добавить: возможно, товар уже продан.",
      site: "Посмотреть на основном сайте →", prev: "Предыдущее фото", next: "Следующее фото", pay: "Перейти на сайт для оплаты →", close: "Закрыть", photo: "Фото" }
  };

  const $ = (id) => document.getElementById(id);
  const world = $("world"), shelvesEl = $("shelves"), annaEl = $("anna"), game = $("game");
  const popup = $("popup");

  let lang = "it";
  let items = [];            // { kind, id, row, p, priceCents, imgs[], x, y, el }
  let dataState = "loading"; // loading | ok | error
  let W = 0, H = 0, VW = 0;
  let segs = [];             // { id, src, aspect, left, w, el } (solo le immagini caricate)
  let x = 0, target = null, pendingOpen = null, facing = 1;
  const keys = { left: false, right: false };
  let padDir = 0, dragging = false;
  let frameIdx = CFG.IDLE_FRAME, frameAcc = 0, last = 0, nearId = null, lastFocus = null, current = null;

  // ── utilita' ──
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
  const titleOf = (it) => it.p.titles[lang] || it.p.titles.it || it.id;

  // ── dati (stessa logica del sito: foglio live se c'e', altrimenti ODS) ──
  async function loadRows() {
    const live = await CD.liveCatalogue.fetchCatalogue(window.fetch.bind(window), CD.config.catalogueEndpoint)
      .then((l) => l || CD.liveCatalogue.emptyLive(), () => CD.liveCatalogue.emptyLive());
    const has = (n) => live && live.tabs && Array.isArray(live.tabs[n]);
    const ods = {};
    const jobs = [];
    if (!has("vasi")) jobs.push(CD.util.loadOdsRows("../catalogue/vasi.ods", ["price_old", "price_new"]).then((r) => { ods.vasi = r; }, (e) => console.error("[GIOCO] vasi.ods:", e)));
    if (!has("certificati")) jobs.push(CD.util.loadOdsRows("../catalogue/certificati.ods", ["amount_eur"]).then((r) => { ods.certificati = r; }, (e) => console.error("[GIOCO] certificati.ods:", e)));
    await Promise.all(jobs);
    return CD.liveCatalogue.chooseData(live, ods).rows;
  }

  const field = (row, base, l) => { const v = row[base + "_" + l]; return v && v !== "-" ? v : ""; };
  const nameOf = (row, l) => field(row, "name", l) || row.name_ru || row.name_it || "";
  const textOf = (row, l) => field(row, "short", l) || field(row, "long", l) || field(row, "short", "ru") || field(row, "short", "it");
  const files = (row) => [row.img1, row.img2, row.img3, row.img4, row.img5, row.img6].map((s) => String(s == null ? "" : s).trim()).filter((s) => s && s !== "-");

  function buildItems(rows) {
    const seen = new Set(), out = [];
    const titles = (row) => ({ it: nameOf(row, "it"), en: nameOf(row, "en"), ru: nameOf(row, "ru") });
    ((rows && rows.vasi) || []).forEach((row) => {
      const id = String(row.id == null ? "" : row.id).trim();
      if (!id || !CD.util.isValidId(id) || seen.has(id)) return;
      seen.add(id);
      if (CD.util.isSoldFlag(row.venduto) || CD.util.isSoldOverride(id)) return;
      const priceCents = CD.money.cellToCents(row, "price_new");
      if (!(priceCents > 0)) return;
      const fs = files(row), rel = (f) => "images/catalogue/" + encodeURIComponent(f);
      const cm = parseFloat(String(row.height || "").replace(",", "."));
      out.push({ kind: "vase", id, row, priceCents, cm: Number.isFinite(cm) ? cm : 25,
        imgs: fs.map((f) => "../" + rel(f)),
        p: { id, type: "physical", sold: false, priceCents, currency: "EUR", img: fs.length ? rel(fs[0]) : "images/placeholder.svg", maxQty: 1, titles: titles(row) } });
    });
    ((rows && rows.certificati) || []).forEach((row) => {
      const id = String(row.id == null ? "" : row.id).trim();
      if (!id || !CD.util.isValidId(id) || seen.has(id)) return;
      seen.add(id);
      if (CD.util.isSoldFlag(row.venduto)) return;
      const priceCents = CD.money.cellToCents(row, "amount_eur");
      if (!(priceCents > 0)) return;
      const f = files(row)[0], rel = f ? "images/certificati/" + encodeURIComponent(f) : "images/giftcard.jpg";
      out.push({ kind: "card", id, row, priceCents, imgs: ["../" + rel],
        p: { id, type: "digital", sold: false, priceCents, currency: "EUR", img: rel, maxQty: 10, titles: titles(row) } });
    });
    // vasi nell'ordine del foglio, poi le carte per importo crescente
    out.sort((a, b) => (a.kind === b.kind ? (a.kind === "card" ? a.priceCents - b.priceCents : 0) : (a.kind === "vase" ? -1 : 1)));
    return out;
  }

  // ── fallback: quadretto con la foto pixelata (vasi senza sprite) ──
  const LEVELS = 7, CROP = 0.72;
  function pixelate(url, canvas, size) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        canvas.width = canvas.height = size;
        const s = Math.min(img.naturalWidth, img.naturalHeight) * CROP;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
        try {
          const d = ctx.getImageData(0, 0, size, size), a = d.data, k = (LEVELS - 1) / 255;
          for (let i = 0; i < a.length; i += 4) { a[i] = Math.round(a[i] * k) / k; a[i + 1] = Math.round(a[i + 1] * k) / k; a[i + 2] = Math.round(a[i + 2] * k) / k; }
          ctx.putImageData(d, 0, 0);
        } catch (e) { /* senza posterizzazione */ }
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = url;
    });
  }

  // ── geometria ──
  function slotPx(s) {
    const g = segs.find((q) => q.id === s.bg);
    return g ? { x: g.left + s.x * g.w, y: s.y * H } : null;
  }

  function layout() {
    VW = window.innerWidth; H = window.innerHeight;
    let left = 0;
    segs.forEach((g) => {
      g.left = left; g.w = Math.round(H * g.aspect); left += g.w;
      g.el.style.left = g.left + "px"; g.el.style.width = g.w + "px";
    });
    W = left;
    world.style.width = W + "px";
    const ah = CFG.ANNA_H * H, aw = ah * CFG.CELL_W / CFG.CELL_H;
    annaEl.style.width = aw + "px"; annaEl.style.height = ah + "px"; annaEl.style.top = (CFG.FLOOR * H - ah) + "px";
    placeItems();
    x = Math.min(Math.max(x, 0.04 * W), W - 0.04 * W);
  }

  function spriteHeight(it) {
    return (it.kind === "card" ? CFG.GIFT_H : CFG.VASE_BASE + it.cm * CFG.VASE_PER_CM) * H;
  }

  function placeItems() {
    let vi = 0, ci = 0;
    items.forEach((it) => {
      const s = it.kind === "card" ? CFG.CARD_SLOTS[ci++] : CFG.VASE_SLOTS[vi++];
      const p = s && slotPx(s);
      if (!p) { it.x = null; if (it.el) it.el.hidden = true; return; }
      it.x = p.x; it.y = p.y;
      if (it.el) {
        const h = it.fallback ? CFG.FALLBACK_FRAME * H : spriteHeight(it);
        it.el.hidden = false;
        it.el.style.left = p.x + "px"; it.el.style.top = p.y + "px"; it.el.style.height = h + "px";
        it.el.style.width = it.fallback ? h + "px" : "";
      }
    });
  }

  // ── rendering oggetti ed elenco ──
  function makeProp(it) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "prop"; b.dataset.id = it.id;
    b.setAttribute("aria-label", titleOf(it) + " — " + CD.money.format(it.priceCents, lang));
    const spriteUrl = it.kind === "card" ? CFG.GIFT_SPRITE : CFG.VASE_DIR + encodeURIComponent(it.id) + ".png";
    const im = document.createElement("img");
    im.className = "spr"; im.alt = ""; im.decoding = "async"; im.src = spriteUrl;
    im.addEventListener("error", () => {   // niente sprite: quadretto con foto pixelata
      it.fallback = true; b.textContent = "";
      const art = document.createElement("span"); art.className = "art";
      const c = document.createElement("canvas"); c.width = c.height = 40; art.appendChild(c); b.appendChild(art);
      if (it.imgs[0]) pixelate(it.imgs[0], c, 40);
      placeItems();
    }, { once: true });
    b.appendChild(im);
    if (it.kind === "card") {
      const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = CD.money.format(it.priceCents, lang);
      b.appendChild(tag);
    }
    b.addEventListener("click", (e) => { e.stopPropagation(); goTo(it); });
    b.addEventListener("pointerdown", (e) => e.stopPropagation());
    return b;
  }

  function renderItems() {
    shelvesEl.textContent = "";
    items.forEach((it) => { it.fallback = false; it.el = makeProp(it); shelvesEl.appendChild(it.el); });
    placeItems();
    renderList();
  }

  function renderList() {
    const box = $("list");
    box.textContent = "";
    [["vase", "vases"], ["card", "cards"]].forEach(([kind, label]) => {
      const group = items.filter((it) => it.kind === kind);
      if (!group.length) return;
      const h = document.createElement("h2"); h.textContent = t(label); box.appendChild(h);
      const ul = document.createElement("ul");
      group.forEach((it) => {
        const li = document.createElement("li"), b = document.createElement("button");
        b.type = "button";
        const im = document.createElement("img"); im.loading = "lazy"; im.alt = ""; im.src = it.imgs[0] || "../images/placeholder.svg";
        const n = document.createElement("span"); n.className = "nm"; n.textContent = titleOf(it);
        const pr = document.createElement("span"); pr.className = "pr"; pr.textContent = CD.money.format(it.priceCents, lang);
        b.append(im, n, pr);
        b.addEventListener("click", () => openPopup(it));
        li.appendChild(b); ul.appendChild(li);
      });
      box.appendChild(ul);
    });
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
    const res = CD.cart.mergeAdd(readCart(), it.p, 1, { name: titleOf(it) });
    if (res.status === "added") { safeSet(CD.cart.CART_KEY, JSON.stringify(res.cart)); updateCartCount(); return "added"; }
    return res.status;   // already | max | invalid
  }

  // ── popup: foto vere scorrevoli (frecce, miniature, tastiera, swipe) + link al sito principale ──
  let photoIdx = 0;
  function gotoPhoto(i) {
    if (!current || !current.imgs.length) return;
    const n = current.imgs.length;
    photoIdx = ((i % n) + n) % n;
    const im = $("pop-img"); im.src = current.imgs[photoIdx]; im.alt = titleOf(current) + " " + (photoIdx + 1) + "/" + n;
    $("pop-count").textContent = n > 1 ? (photoIdx + 1) + "/" + n : "";
    $("pop-thumbs").querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-current", String(k === photoIdx)));
  }
  function openPopup(it) {
    current = it; lastFocus = document.activeElement;
    $("pop-title").textContent = titleOf(it);
    $("pop-text").textContent = textOf(it.row, lang);
    $("pop-price").textContent = CD.money.format(it.priceCents, lang);
    $("pop-msg").textContent = "";
    $("pop-pay").hidden = true; $("pop-pay").textContent = t("pay");
    const site = $("pop-site"); site.textContent = t("site"); site.href = it.kind === "card" ? "../#giftcards" : "../#catalogue";
    if (!it.imgs.length) it.imgs = ["../images/placeholder.svg"];
    const multi = it.imgs.length > 1;
    $("pop-prev").hidden = !multi; $("pop-next").hidden = !multi;
    $("pop-prev").setAttribute("aria-label", t("prev")); $("pop-next").setAttribute("aria-label", t("next"));
    const th = $("pop-thumbs"); th.textContent = "";
    if (multi) {
      it.imgs.forEach((src, i) => {
        const b = document.createElement("button"); b.type = "button";
        b.setAttribute("aria-label", t("photo") + " " + (i + 1));
        const im = document.createElement("img"); im.src = src; im.alt = ""; im.loading = "lazy"; b.appendChild(im);
        b.addEventListener("click", () => gotoPhoto(i));
        th.appendChild(b);
      });
    }
    gotoPhoto(0);
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
    if (dir) {
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
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); padDir = dir; });
      ["pointerup", "pointercancel", "pointerleave"].forEach((n) => b.addEventListener(n, () => { if (padDir === dir) padDir = 0; }));
    };
    holdPad("pad-left", -1); holdPad("pad-right", 1);

    const worldX = (e) => e.clientX + Math.min(Math.max(x - VW / 2, 0), Math.max(0, W - VW));
    game.addEventListener("pointerdown", (e) => {
      if (popup.open || e.target.closest(".hud, .pad, .list, .prop")) return;
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
    $("pop-prev").addEventListener("click", () => gotoPhoto(photoIdx - 1));
    $("pop-next").addEventListener("click", () => gotoPhoto(photoIdx + 1));
    popup.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); gotoPhoto(photoIdx - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); gotoPhoto(photoIdx + 1); }
    });
    let sx = null;   // swipe sulla foto
    const stage = $("pop-stage");
    stage.addEventListener("pointerdown", (e) => { sx = e.clientX; });
    stage.addEventListener("pointerup", (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) gotoPhoto(photoIdx + (dx < 0 ? 1 : -1));
    });
    stage.addEventListener("pointercancel", () => { sx = null; });
    popup.addEventListener("click", (e) => { if (e.target === popup) closePopup(); });
    popup.addEventListener("close", () => { current = null; if (lastFocus && lastFocus.focus) lastFocus.focus(); });
    $("pop-add").addEventListener("click", () => {
      if (!current) return;
      const r = addToCart(current);
      $("pop-msg").textContent = r === "added" ? t("added") : (r === "already" ? t("inCart") : t("failed"));
      refreshAddButton();
    });

    window.addEventListener("resize", layout);
    window.addEventListener("storage", updateCartCount);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { updateCartCount(); if (current) refreshAddButton(); } });
    setTimeout(() => $("hint").classList.add("gone"), 9000);
  }

  function setStatus() {
    say(dataState === "loading" ? t("loading") : dataState === "error" ? t("error") : (items.length ? "" : t("none")));
  }

  const loadAspect = (src) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0);
    im.onerror = () => res(0);
    im.src = src;
  });

  // Crea i segmenti di sfondo solo per le immagini che esistono (aspect reale dall'immagine)
  async function buildSegments() {
    const aspects = await Promise.all(CFG.SEGMENTS.map((g) => loadAspect(g.src)));
    segs = [];
    CFG.SEGMENTS.forEach((g, i) => {
      if (!aspects[i]) { console.warn("[GIOCO] sfondo mancante:", g.src); return; }
      const el = document.createElement("div");
      el.className = "seg"; el.style.backgroundImage = 'url("' + g.src + '")';
      world.insertBefore(el, shelvesEl);
      segs.push({ id: g.id, src: g.src, aspect: aspects[i], left: 0, w: 0, el });
    });
  }

  async function init() {
    lang = pickLang();
    applyStatic(); updateCartCount(); setStatus();
    await buildSegments();
    layout(); x = 0.3 * H;   // parte davanti alla porta
    bind();
    requestAnimationFrame(tick);
    try {
      const rows = await loadRows();
      if (!rows || (!Array.isArray(rows.vasi) && !Array.isArray(rows.certificati))) throw new Error("catalogo non disponibile");
      items = buildItems(rows); dataState = "ok";
    } catch (err) {
      console.error("[GIOCO]", err); items = []; dataState = "error";
    }
    layout(); renderItems(); setStatus();
  }

  window.__annaGame = { CFG, pixelate, open: (i) => items[i] && openPopup(items[i]), count: () => items.length, items: () => items };   // per prove manuali
  init();
})();
