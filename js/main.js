// ============================================================
// main.js — interactions, reveals, count-up, working buttons
// ============================================================

// ---- nav scroll state + progress bar ----
const nav = document.getElementById('nav');
const prog = document.getElementById('prog');
function onScroll(){
  const y = window.scrollY || document.documentElement.scrollTop;
  nav.classList.toggle('scrolled', y > 40);
  const h = document.documentElement.scrollHeight - window.innerHeight;
  prog.style.width = (h > 0 ? (y / h * 100) : 0) + '%';
}
window.addEventListener('scroll', onScroll, { passive:true });
onScroll();

// ---- smooth-scroll anchors (all data-scroll links) ----
document.querySelectorAll('a[data-scroll]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id || id.charAt(0) !== '#') return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    closeMenu();
    const top = id === '#top' ? 0 : el.getBoundingClientRect().top + window.scrollY - 10;
    window.scrollTo({ top, behavior:'smooth' });
  });
});

// ---- mobile burger menu ----
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
function closeMenu(){ burger && burger.classList.remove('open'); navLinks && navLinks.classList.remove('open'); document.body.style.overflow=''; }
if (burger){
  burger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    burger.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
}

// ---- hero intro ----
requestAnimationFrame(() => setTimeout(() => {
  const h = document.querySelector('.hero'); if (h) h.classList.add('in');
}, 90));

// ---- count-up ----
function animateCount(el){
  const target = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.dec || '0', 10);
  const suf = el.dataset.suffix || '';
  const pre = el.dataset.prefix || '';
  const dur = 1400; let start = null;
  function step(t){
    if (!start) start = t;
    const p = Math.min((t - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);           // easeOutCubic
    el.textContent = pre + (target * e).toFixed(dec) + suf;
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = pre + target.toFixed(dec) + suf;
  }
  requestAnimationFrame(step);
}
function fireCounts(root){
  root.querySelectorAll('[data-count]').forEach((c) => {
    if (!c.dataset.done){ c.dataset.done = '1'; animateCount(c); }
  });
}

// ---- reveal on scroll + trigger counts ----
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting){
      en.target.classList.add('in');
      fireCounts(en.target);
      io.unobserve(en.target);
    }
  });
}, { threshold:0.16, rootMargin:'0px 0px -8% 0px' });
document.querySelectorAll('.rv').forEach((el) => io.observe(el));

// hero stats (not .rv) — count when hero visible
const hs = document.querySelector('.hero-stats');
if (hs){
  const io2 = new IntersectionObserver((e) => {
    e.forEach((en) => { if (en.isIntersecting){ fireCounts(hs); io2.unobserve(hs); } });
  }, { threshold:0.3 });
  io2.observe(hs);
}

// ---- copy email + toast ----
const toast = document.getElementById('toast');
let toastTimer = null;
function showToast(msg){
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
const copyBtn = document.getElementById('copyEmail');
if (copyBtn){
  copyBtn.addEventListener('click', async () => {
    const email = 'kazsultan.uni@gmail.com';
    try {
      await navigator.clipboard.writeText(email);
      showToast('Email скопирован ✓');
    } catch(e){
      // fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = email; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); showToast('Email скопирован ✓'); }
      catch(_){ showToast(email); }
      document.body.removeChild(ta);
    }
  });
}

// ---- to-top ----
const toTop = document.getElementById('toTop');
if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));

// ---- year + Astana clock (UTC+5) ----
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
const clockEl = document.getElementById('clock');
function tickClock(){
  if (!clockEl) return;
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ast = new Date(utc + 5 * 3600000);
  const p = (n) => (n < 10 ? '0' : '') + n;
  clockEl.textContent = p(ast.getHours()) + ':' + p(ast.getMinutes()) + ':' + p(ast.getSeconds());
}
tickClock(); setInterval(tickClock, 1000);
