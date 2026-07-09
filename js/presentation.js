// ============================================================
// presentation.js — scroll-driven "deck" layer
// Cinematic preloader + Lenis smooth-scroll + GSAP ScrollTrigger reveals.
// Loads before main.js. Degrades gracefully (no GSAP / reduced-motion).
// ============================================================
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;

window.__presentation = true;                 // tell main.js: I control the hero reveal
document.body.classList.add('loading');
const loaderEl = document.getElementById('loader');

function revealHero(){ const h = document.querySelector('.hero'); if (h) h.classList.add('in'); }
function endLoading(){ document.body.classList.remove('loading'); }

if (gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });   // mobile address-bar jank fix
  document.documentElement.classList.add('gsap-on');

  runPreloader();
  initLenis();
  initSceneIndicator();
  initHeroDissolve();
  initStatReveal();

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
} else {
  document.documentElement.classList.add('no-gsap');
  if (loaderEl) loaderEl.remove();
  endLoading(); revealHero();
  const stats = document.getElementById('otanStats');
  if (stats) stats.querySelectorAll('[data-count]').forEach((el) => {
    const t = parseFloat(el.dataset.count), d = parseInt(el.dataset.dec || '0', 10);
    el.textContent = (el.dataset.prefix || '') + t.toFixed(d) + (el.dataset.suffix || '');
  });
}

// ---- cinematic preloader: count 0→100, then wipe up to reveal hero ----
function runPreloader(){
  if (!loaderEl || REDUCED){ if (loaderEl) loaderEl.remove(); endLoading(); revealHero(); return; }
  const num = document.getElementById('loaderNum');
  const fill = document.getElementById('loaderFill');
  const o = { v: 0 };
  gsap.to(o, { v: 100, duration: 1.55, ease: 'power2.inOut',
    onUpdate: () => { const v = Math.round(o.v); if (num) num.textContent = v; if (fill) fill.style.width = v + '%'; },
    onComplete: () => {
      gsap.to(loaderEl, { yPercent: -101, duration: 1.0, ease: 'expo.inOut',
        onStart: () => { endLoading(); revealHero(); },
        onComplete: () => { loaderEl.remove(); ScrollTrigger.refresh(); } });
    }
  });
  // safety net if anything stalls
  setTimeout(() => { const l = document.getElementById('loader'); if (l){ l.remove(); endLoading(); revealHero(); } }, 4200);
}

// ---- Lenis smooth scroll — the core "presentation" weight ----
function initLenis(){
  if (!Lenis || REDUCED) return;
  try {
    const lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1.0, touchMultiplier: 1.4 });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } catch (e) { console.warn('[lenis] disabled', e); }
}

// ---- scene indicator: active chapter as you scroll ----
function initSceneIndicator(){
  const ids = ['top','otan','early','range','compare','method','about','contact'];
  const wrap = document.getElementById('scenes');
  const dots = wrap ? [...wrap.querySelectorAll('.sc')] : [];
  const setActive = (i) => dots.forEach((s, j) => s.classList.toggle('active', j === i));
  ids.forEach((id, i) => {
    const el = document.getElementById(id); if (!el) return;
    ScrollTrigger.create({ trigger: el, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => { if (self.isActive) setActive(i); } });
  });
}

// ---- hero dissolve: copy parallaxes up + fades, canvas dims ----
function initHeroDissolve(){
  if (REDUCED) return;
  // hold the hero fully, then dissolve only in the last ~35% as the pin releases
  gsap.fromTo('.hero-in', { yPercent: 0, opacity: 1 }, { yPercent: -8, opacity: 0.08, ease: 'none',
    scrollTrigger: { trigger: '.hero-scene', start: '64% top', end: 'bottom top', scrub: 0.5 } });
}

// ---- OTAN stat grid: presentation reveal (one metric at a time) + count-up ----
function fireCount(cell){
  const el = cell.querySelector('[data-count]'); if (!el || el.dataset.done) return;
  el.dataset.done = '1';
  const target = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
  const suf = el.dataset.suffix || '', pre = el.dataset.prefix || '';
  if (REDUCED){ el.textContent = pre + target.toFixed(dec) + suf; return; }
  const o = { v: 0 };
  gsap.to(o, { v: target, duration: 1.05, ease: 'power2.out',
    onUpdate: () => { el.textContent = pre + o.v.toFixed(dec) + suf; },
    onComplete: () => { el.textContent = pre + target.toFixed(dec) + suf; } });
}
function initStatReveal(){
  const stats = document.getElementById('otanStats');
  const cells = stats ? gsap.utils.toArray('#otanStats .cell') : [];
  if (!cells.length) return;
  if (REDUCED){ gsap.set(cells, { opacity: 1, y: 0 }); cells.forEach(fireCount); return; }
  gsap.set(cells, { opacity: 0, y: 28 });
  ScrollTrigger.matchMedia({
    '(min-width: 900px)': () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: stats, start: 'top 74%', end: '+=85%', scrub: 0.5 } });
      cells.forEach((c, i) => tl.to(c, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', onStart: () => fireCount(c) }, i * 0.34));
    },
    '(max-width: 899px)': () => {
      ScrollTrigger.batch(cells, { start: 'top 90%',
        onEnter: (batch) => batch.forEach((c, i) => gsap.to(c, { opacity: 1, y: 0, duration: 0.5, delay: i * 0.06, onStart: () => fireCount(c) })) });
    }
  });
}
