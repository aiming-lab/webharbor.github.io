// --- site data ------------------------------------------------------------
// `action` = the exact flow captured in the GIF (login + a DB-backed action).
const SITES = [
  { id: "allrecipes",           name: "Allrecipes",           port: 40000, tasks: 45, action: "Meal plan → Add recipes to weekly planner" },
  { id: "amazon",               name: "Amazon",               port: 40001, tasks: 41, action: "Today's Deals → Product → Add to Cart → Bag" },
  { id: "apple",                name: "Apple",                port: 40002, tasks: 43, action: "iPhone lineup → Product page → Add to Bag" },
  { id: "arxiv",                name: "arXiv",                port: 40003, tasks: 43, action: "cs.AI recent papers → Abstract → Metadata" },
  { id: "bbc_news",             name: "BBC News",             port: 40004, tasks: 42, action: "Sport section → Article → Reading List" },
  { id: "booking",              name: "Booking.com",          port: 40005, tasks: 44, action: "Destinations → NYC hotels → Reserve → Cart" },
  { id: "github",               name: "GitHub",               port: 40006, tasks: 41, action: "Repo → Issues tab → Issue detail" },
  { id: "google_flights",       name: "Google Flights",       port: 40007, tasks: 42, action: "NY→London search → Results → Date grid tool" },
  { id: "google_map",           name: "Google Maps",          port: 40008, tasks: 41, action: "Directions: Times Square → Central Park" },
  { id: "google_search",        name: "Google Search",        port: 40009, tasks: 43, action: "SERP → Switch to Google Scholar" },
  { id: "huggingface",          name: "Hugging Face",         port: 40010, tasks: 43, action: "Datasets → Dataset viewer → Table data" },
  { id: "wolfram_alpha",        name: "Wolfram Alpha",        port: 40011, tasks: 46, action: "Solve x²+3x−4=0 → Plots + Steps" },
  { id: "cambridge_dictionary", name: "Cambridge Dictionary", port: 40012, tasks: 43, action: "Definition → Thesaurus → Grammar" },
  { id: "coursera",             name: "Coursera",             port: 40013, tasks: 42, action: "Professional Certificates → Google Data Analytics" },
  { id: "espn",                 name: "ESPN",                 port: 40014, tasks: 44, action: "NFL Scoreboard → Box score → Player stats" },
];

const GIF    = id => `assets/gallery/${id}.gif`;
const POSTER = id => `assets/gallery/${id}.jpg`;

// --- hero strip: seamless looping marquee using all 15 sites --------------
const stripOrder = SITES.map(s => s.id);
const strip = document.querySelector("#hero-strip .strip-track");
if (strip) {
  const make = () => stripOrder.map(id =>
    `<img src="${POSTER(id)}" alt="" />`).join("");
  // triple to guarantee no gap at any viewport width
  strip.innerHTML = make() + make() + make();
}

// --- gallery: auto-play GIFs, click any to enlarge ------------------------
const grid = document.getElementById("gallery-grid");
if (grid) {
  grid.innerHTML = SITES.map(s => `
    <article class="card" data-site="${s.id}">
      <button class="card-shot" type="button" aria-label="Enlarge ${s.name} demo">
        <span class="shot-label">${s.action}</span>
        <span class="shot-badge">LIVE</span>
        <span class="shot-zoom" aria-hidden="true">⤢</span>
        <img class="shot-media"
             src="${POSTER(s.id)}"
             data-gif="${GIF(s.id)}"
             data-poster="${POSTER(s.id)}"
             alt="${s.name} demo — ${s.action}"
             loading="lazy" decoding="async" />
      </button>
      <div class="card-body">
        <div class="card-title-row">
          <h3 class="card-title">${s.name}</h3>
          <span class="card-port">:${s.port}</span>
        </div>
      </div>
    </article>
  `).join("");

  // IntersectionObserver: swap the poster for the GIF once the card is about
  // to enter the viewport. This auto-plays while avoiding the cost of
  // downloading all 15 GIFs up front.
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target.querySelector(".shot-media");
        if (img && img.dataset.gif && img.src.indexOf(".gif") === -1) {
          img.src = img.dataset.gif;
        }
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: "200px 0px", threshold: 0.05 });

  grid.querySelectorAll(".card").forEach(card => io.observe(card));

  // Click handler → open lightbox.
  grid.addEventListener("click", e => {
    const shot = e.target.closest(".card-shot");
    if (!shot) return;
    const card = shot.closest(".card");
    const idx  = [...grid.querySelectorAll(".card")].indexOf(card);
    openLightbox(idx);
  });
}

// --- lightbox (click-to-enlarge) ------------------------------------------
const lb       = document.getElementById("lightbox");
const lbImg    = document.getElementById("lb-img");
const lbTitle  = document.getElementById("lb-title");
const lbSub    = document.getElementById("lb-sub");
const lbClose  = document.getElementById("lb-close");
const lbPrev   = document.getElementById("lb-prev");
const lbNext   = document.getElementById("lb-next");
let lbCurrent = 0;

function openLightbox(index) {
  lbCurrent = ((index % SITES.length) + SITES.length) % SITES.length;
  const s = SITES[lbCurrent];
  // cache-bust so GIF restarts from frame 0 on open / nav
  lbImg.src = GIF(s.id) + "?t=" + Date.now();
  lbImg.alt = `${s.name} — ${s.action}`;
  lbTitle.textContent = `${s.name}  ·  :${s.port}`;
  lbSub.textContent   = s.action;
  lb.setAttribute("aria-hidden", "false");
  lb.classList.add("is-open");
  document.body.classList.add("lb-locked");
}
function closeLightbox() {
  lb.setAttribute("aria-hidden", "true");
  lb.classList.remove("is-open");
  document.body.classList.remove("lb-locked");
  lbImg.src = "";
}
function step(delta) { openLightbox(lbCurrent + delta); }

if (lb) {
  lbClose.addEventListener("click", closeLightbox);
  lbPrev .addEventListener("click", () => step(-1));
  lbNext .addEventListener("click", () => step(+1));
  // Click on backdrop (not the image/nav) closes.
  lb.addEventListener("click", e => {
    if (e.target === lb || e.target.classList.contains("lb-stage")) closeLightbox();
  });
  document.addEventListener("keydown", e => {
    if (!lb.classList.contains("is-open")) return;
    if (e.key === "Escape")     closeLightbox();
    if (e.key === "ArrowLeft")  step(-1);
    if (e.key === "ArrowRight") step(+1);
  });
}

// --- copy button ----------------------------------------------------------
document.querySelectorAll(".copy-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const text = btn.getAttribute("data-copy") || "";
    try {
      await navigator.clipboard.writeText(text);
      const orig = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied"); }, 1400);
    } catch (e) {
      btn.textContent = "Copy failed";
    }
  });
});

// --- scroll reveal --------------------------------------------------------
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

document.querySelectorAll(".section-head, .problem-card, .approach-card, .evo-step, .impact-card, .thesis, .outline-list li, .hero-strip").forEach((el, i) => {
  el.classList.add("reveal");
  el.style.transitionDelay = `${Math.min(i * 0.06, 0.3)}s`;
  revealObserver.observe(el);
});
