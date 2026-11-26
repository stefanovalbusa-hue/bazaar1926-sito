/* Bazaar dal 1926, logica comune: header, footer, carrello, catalogo */

const SHOP = {
  nome: "Bazaar dal 1926",
  ragioneSociale: "RES Srl",
  indirizzo: "Piazza della Chiesa 43/44, 37021 Bosco Chiesanuova (VR)",
  telefono: "+39 045 7050167",
  email: "commerciale@ressrl.eu",
  orari: "Tutti i giorni, festivi compresi: 9:30-12:30 / 16:00-19:00",
  facebook: "https://www.facebook.com/BAZAAR1926/",
  instagram: "https://www.instagram.com/bazaar_abbigliamento_dal_1926/",
  instagramHandle: "@bazaar_abbigliamento_dal_1926",
  spedizioneGratisDa: 99,
  costoSpedizione: 7.9,
};

const CART_KEY = "bazaar1926_cart";
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const euro = (n) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/* ---------- Storage sicuro ---------- */
function readCart() {
  let v; try { v = JSON.parse(localStorage.getItem(CART_KEY)); } catch { return []; }
  if (!Array.isArray(v)) return [];
  return v.filter((i) => i && typeof i.sku === "string" && typeof i.taglia === "string" && i.sku.length < 80 && i.taglia.length < 20)
    .map((i) => ({ key: i.sku + "|" + i.taglia, sku: i.sku, taglia: i.taglia, nome: String(i.nome || "").slice(0, 120),
      qty: Math.min(20, Math.max(1, Math.floor(Number(i.qty)) || 1)), prezzo: Math.max(0, Number(i.prezzo) || 0) })).slice(0, 50);
}
function writeCart(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch {}
  updateCartCount();
}

/* ---------- Giacenze ---------- */
let _inventory = null;
async function loadInventoryFile() {
  try {
    const res = await fetch("data/giacenze.json", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.prodotti || [];
  } catch { return []; }
}
/* Legge le giacenze dal magazzino condiviso (gestionale) quando disponibile,
   altrimenti dal file data/giacenze.json. */
async function loadInventory() {
  if (_inventory) return _inventory;
  try {
    if (window.claude && window.claude.use) {
      const db = await Promise.race([window.claude.use("db"), new Promise((r) => setTimeout(() => r(null), 6000))]);
      if (db) {
        const snap = await Promise.race([db.collection("prodotti").get(), new Promise((r) => setTimeout(() => r(null), 6000))]);
        if (snap && !snap.empty) {
          _inventory = snap.docs.map((d) => ({ ...d.data(), sku: d.id })).filter((p) => p.pubblicato !== false);
          return _inventory;
        }
      }
    }
  } catch {}
  _inventory = await loadInventoryFile();
  return _inventory;
}
function stockFor(product, taglia) {
  const v = product.varianti.find((x) => x.taglia === taglia);
  return v ? v.giacenza : 0;
}
function totalStock(product) {
  return product.varianti.reduce((s, v) => s + v.giacenza, 0);
}

/* ---------- Carrello ---------- */
function addToCart(product, taglia, qty = 1) {
  const items = readCart();
  const key = product.sku + "|" + taglia;
  const max = stockFor(product, taglia);
  const existing = items.find((i) => i.key === key);
  const current = existing ? existing.qty : 0;
  if (current + qty > max) {
    toast("Disponibilità insufficiente per la taglia " + taglia);
    return false;
  }
  if (existing) existing.qty += qty;
  else items.push({ key, sku: product.sku, taglia, qty, nome: product.nome, prezzo: product.prezzo });
  writeCart(items);
  toast("Aggiunto al carrello: " + product.nome + " (" + taglia + ")");
  return true;
}
function cartTotals(items) {
  const subtotale = items.reduce((s, i) => s + i.prezzo * i.qty, 0);
  const spedizione = subtotale === 0 || subtotale >= SHOP.spedizioneGratisDa ? 0 : SHOP.costoSpedizione;
  return { subtotale, spedizione, totale: subtotale + spedizione };
}
function updateCartCount() {
  const n = readCart().reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll(".cart-count").forEach((el) => (el.textContent = n));
}

/* ---------- UI comune ---------- */
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2400);
}

function renderChrome() {
  const page = document.body.dataset.page;
  const link = (href, label, id) => `<a href="${href}" class="${page === id ? "active" : ""}">${label}</a>`;
  const header = document.getElementById("site-header");
  if (header) {
    header.innerHTML = `
      <div class="topbar" data-sez="acquisti">Spedizione gratuita sopra ${euro(SHOP.spedizioneGratisDa)} · Ritiro gratuito in negozio a Bosco Chiesanuova</div>
      <header class="site"><div class="wrap">
        <button class="menu-toggle" aria-label="Menu">☰</button>
        <a href="index.html" class="logo"><img src="assets/img/logo-small.png" alt="Logo Bazaar 100 anni"><span><b>BAZAAR</b><small>dal 1926</small></span></a>
        <nav class="main">
          ${link("index.html", "Home", "home")}
          <span data-sez="shop">${link("shop.html", "Shop", "shop")}</span>
          <span class="presto-menu"><a href="index.html#presto">Shop <em>coming soon</em></a></span>
          <span data-sez="storia">${link("index.html#storia", "La nostra storia", "storia")}</span>
          <a href="index.html#marche">Le marche</a>
          <span data-sez="contatti">${link("contatti.html", "Contatti", "contatti")}</span>
        </nav>
        <a href="carrello.html" class="cart-btn" data-sez="acquisti">Carrello<span class="cart-count">0</span></a>
      </div></header>`;
    header.querySelector(".menu-toggle").addEventListener("click", () =>
      header.querySelector("nav.main").classList.toggle("open"));
  }
  const footer = document.getElementById("site-footer");
  if (footer) {
    footer.innerHTML = `
      <footer class="site"><div class="wrap">
        <div class="grid">
          <div><h4>Bazaar dal 1926</h4><p>Abbigliamento della famiglia Valbusa dal 1926: uomo, donna, bambino, outdoor e calzature nel cuore della Lessinia.</p></div>
          <div><h4>Negozio</h4><p>${SHOP.indirizzo}<br>${SHOP.orari}</p></div>
          <div><h4>Contatti</h4><ul>
            <li><a href="tel:${SHOP.telefono.replace(/\s/g, "")}">${SHOP.telefono}</a></li>
            <li><a href="mailto:${SHOP.email}">${SHOP.email}</a></li>
            <li><a href="${SHOP.facebook}" target="_blank" rel="noopener noreferrer">Facebook: Bazaar dal 1926 Bosco Chiesanuova</a></li>
            <li><a href="${SHOP.instagram}" target="_blank" rel="noopener noreferrer">Instagram: ${SHOP.instagramHandle}</a></li>
          </ul></div>
          <div><h4>Informazioni</h4><ul>
            <li data-sez="acquisti"><a href="contatti.html#spedizioni">Spedizioni e resi</a></li>
            <li><a href="privacy.html">Privacy e cookie</a></li>
            <li data-sez="acquisti"><a href="contatti.html#condizioni">Condizioni di vendita</a></li>
            
          </ul></div>
        </div>
        <div class="legal">© ${new Date().getFullYear()} ${SHOP.ragioneSociale} · Bosco Chiesanuova (VR) · P.IVA 03512420237<span data-sez="acquisti"> · Pagamenti sicuri con Nexi</span></div>
      </div></footer>`;
  }
  updateCartCount();
}

/* ---------- Card prodotto ---------- */
function productCard(p) {
  const tot = totalStock(p);
  const disponibili = p.varianti.filter((v) => v.giacenza > 0);
  const img = p.immagine ? `<img src="${esc(p.immagine)}" alt="${esc(p.nome)}" loading="lazy">` : p.nome;
  const badge = p.prezzoPieno && p.prezzoPieno > p.prezzo ? `<span class="badge">-${Math.round((1 - p.prezzo / p.prezzoPieno) * 100)}%</span>`
    : p.novita ? `<span class="badge">NOVITÀ</span>` : "";
  const stockCls = tot === 0 ? "out" : tot <= 3 ? "low" : "ok";
  const stockTxt = tot === 0 ? "Esaurito" : tot <= 3 ? "Ultimi pezzi" : "Disponibile";
  return `
    <article class="product" data-sku="${esc(p.sku)}">
      <div class="img">${badge}${img}</div>
      <div class="body">
        <span class="brand">${esc(p.marca)} · ${esc(p.categoria)}</span>
        <h3>${esc(p.nome)}</h3>
        <span class="price">${euro(p.prezzo)}${p.prezzoPieno && p.prezzoPieno > p.prezzo ? `<s>${euro(p.prezzoPieno)}</s>` : ""}</span>
        <div class="taglie-shop" role="radiogroup" aria-label="Taglia">
          ${p.varianti.map((v, i) => `<button type="button" role="radio" class="tg ${v.giacenza === 0 ? "esaurita" : ""}" data-t="${esc(v.taglia)}" aria-checked="false" ${v.giacenza === 0 ? "disabled" : ""} title="${v.giacenza === 0 ? "Esaurita" : v.giacenza + " disponibili"}">${esc(v.taglia)}</button>`).join("")}
        </div>
        <span class="tg-info"></span>
        <span class="stock ${stockCls}">● ${stockTxt}</span>
        <button class="btn dark add" ${tot === 0 ? "disabled" : ""}>Aggiungi al carrello</button>
      </div>
    </article>`;
}
function bindProductCards(container, products) {
  container.querySelectorAll(".product").forEach((card) => {
    const p = products.find((x) => x.sku === card.dataset.sku);
    const info = card.querySelector(".tg-info");
    const scegli = (b) => {
      card.querySelectorAll(".tg").forEach((x) => x.setAttribute("aria-checked", x === b ? "true" : "false"));
      const q = stockFor(p, b.dataset.t);
      info.textContent = "Taglia " + b.dataset.t + ": " + (q <= 3 ? "ultimi " + q + " pezzi" : q + " disponibili");
    };
    card.querySelectorAll(".tg:not([disabled])").forEach((b) => b.addEventListener("click", () => scegli(b)));
    const prima = card.querySelector(".tg:not([disabled])");
    if (prima) scegli(prima);
    const btn = card.querySelector(".add");
    if (btn) btn.addEventListener("click", () => {
      const sel = card.querySelector('.tg[aria-checked="true"]');
      if (sel) addToCart(p, sel.dataset.t, 1);
    });
  });
}

/* ---------- Pubblicazione: il sito resta offline finché non si pubblica dal gestionale ---------- */
const SEZIONI = { storia: "La nostra storia", vetrine: "Vetrine \"In negozio adesso\"", negozio: "Il negozio (ingresso e orari)", shop: "Shop (catalogo dei capi)", acquisti: "Acquisti online (carrello e pagamento)", contatti: "Pagina contatti" };
function sitoOnline(d) {
  if (!d) return false;
  if (d.online === true) return true;
  return !!(d.programmataIl && Date.now() >= Date.parse(d.programmataIl));
}
function sezioneAttiva(d, k) { return !(d && d.sezioni && d.sezioni[k] === false); }

// Nasconde la pagina finché non si sa se il sito è pubblicato (solo dentro Claude)
if (window.claude && window.claude.use && document.body) document.body.classList.add("attesa");

let _status;
async function getSiteStatus() {
  if (_status) return _status;
  // Fuori da Claude (sito statico) non c'è il gestionale: il sito è visibile.
  // Sito pubblicato su bazaar1926.com: online, shop e acquisti spenti finche non si apre la vendita online
  if (!(window.claude && window.claude.use)) return (_status = { managed: true, online: true, editor: false, doc: { sezioni: { shop: false, acquisti: false } } });
  _status = { managed: true, online: false, editor: false, doc: {} };
  try {
    const t = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), 6000))]);
    const db = await t(window.claude.use("db"));
    const user = await t(window.claude.use("user"));
    const editor = !!(user && (await t(user.canEdit().catch(() => false))));
    const snap = db ? await t(db.doc("impostazioni/sito").get()) : null;
    const d = snap && snap.exists ? snap.data() : {};
    const vistaCliente = new URLSearchParams(location.search).get("vista") === "cliente";
    _status = { managed: true, online: sitoOnline(d), editor: editor && !vistaCliente, gestore: editor, doc: d };
  } catch {}
  return _status;
}

function splashOffline(d, titolo, messaggio) {
  const quando = d && d.programmataIl && Date.parse(d.programmataIl) > Date.now()
    ? "Apertura il " + new Date(d.programmataIl).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + "."
    : "Il nuovo sito apre a breve.";
  const el = document.createElement("div");
  el.id = "offline-splash";
  el.innerHTML = `<div class="splash-box">
      <img src="assets/img/logo-100-anni.png" alt="Bazaar, 100 anni" width="180" height="180">
      <h1>${titolo || "Bazaar dal 1926"}</h1>
      <p class="quando"></p>
      <p>Intanto vi aspettiamo in negozio: Piazza della Chiesa 43/44, Bosco Chiesanuova (VR).<br>Tel. 045 7050167 · tutti i giorni, festivi compresi, 9:30-12:30 / 16:00-19:00</p>
      <p><a href="${SHOP.instagram}" target="_blank" rel="noopener noreferrer">Instagram ${SHOP.instagramHandle}</a> · <a href="${SHOP.facebook}" target="_blank" rel="noopener noreferrer">Facebook</a></p>
    </div>`;
  el.querySelector(".quando").textContent = messaggio || quando;
  document.body.appendChild(el);
  document.body.classList.add("offline");
}

async function applySiteStatus() {
  if (location.hash === "#gestionale" && document.body.dataset.page !== "gestionale") { location.replace("gestionale.html"); return; }
  const st = await getSiteStatus();
  const page = document.body.dataset.page;
  document.body.classList.remove("attesa");
  if (!st.managed) return;
  if (st.gestore) document.body.classList.add("gestore");
  if (page === "gestionale") return;
  const d = st.doc || {};
  if (st.editor) {
    // Anteprima per chi gestisce
    const bar = document.createElement("div");
    bar.className = "topbar stato-sito";
    const spente = Object.keys(SEZIONI).filter((k) => !sezioneAttiva(d, k));
    bar.innerHTML = (st.online ? "SITO ONLINE · " : "ANTEPRIMA · il sito è offline per i clienti · ")
      + (spente.length ? "nascoste: " + spente.map((k) => SEZIONI[k]).join(", ") + " · " : "")
      + '<a href="gestionale.html">gestisci la pubblicazione</a> · <a href="?vista=cliente">guarda come un cliente</a>';
    document.getElementById("site-header")?.prepend(bar);
    return;
  }
  // Cliente: sito offline → solo la pagina di attesa
  if (!st.online) { splashOffline(d); return; }
  // Sito online: nascondi le sezioni spente
  Object.keys(SEZIONI).forEach((k) => { if (!sezioneAttiva(d, k)) document.body.classList.add("off-" + k); });
  const paginaSez = { shop: "shop", carrello: "acquisti", contatti: "contatti" }[page];
  if (paginaSez && !sezioneAttiva(d, paginaSez)) splashOffline(d, paginaSez === "contatti" ? "Pagina non ancora disponibile" : "Shop online: coming soon", "Tra pochi giorni potrai acquistare online i nostri capi.");
}

/* ---------- App desktop del gestionale ---------- */
function drawAppIcon() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#0a4424"; g.beginPath(); g.roundRect(8, 8, 240, 240, 52); g.fill();
  g.strokeStyle = "#d4b452"; g.lineWidth = 6; g.beginPath(); g.roundRect(22, 22, 212, 212, 40); g.stroke();
  g.fillStyle = "#d4b452"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "italic 700 150px Georgia, 'Times New Roman', serif"; g.fillText("B", 128, 118);
  g.font = "600 34px Georgia, serif"; g.fillText("1926", 128, 196);
  return c.toDataURL("image/png");
}
/* Restituisce l'API desktop (o null). Nella finestra dell'app installata
   imposta l'icona e apre direttamente il gestionale. */
let _desktop;
async function getDesktop() {
  if (_desktop !== undefined) return _desktop;
  _desktop = null;
  try {
    if (window.claude && window.claude.use) {
      _desktop = await Promise.race([window.claude.use("desktop"), new Promise((r) => setTimeout(() => r(null), 6000))]);
    }
  } catch {}
  if (_desktop && _desktop.app) {
    _desktop.app.dock.setIcon(drawAppIcon()).catch(() => {});
    if (document.body.dataset.page === "home") location.replace("gestionale.html");
  }
  return _desktop;
}

document.addEventListener("DOMContentLoaded", () => { renderChrome(); getDesktop(); applySiteStatus(); });
