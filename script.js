/* ============================================
   MIM — Muhammad Ismoil | Portfolio Scripts
   ============================================ */

'use strict';

/* ─── Shared helpers ─── */

// Viewport breakpoint. Deliberately width-only: the old build also treated
// `'ontouchstart' in window` as "mobile", which is true on touchscreen laptops,
// Windows tablets and Chromebooks — those machines got the swipe-only code path
// and lost every scroll animation. Width is the honest signal, and the
// `change` listener below means resizing or rotating re-configures live.
const mqMobile  = window.matchMedia('(max-width: 768px)');
const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqCoarse  = window.matchMedia('(hover: none), (pointer: coarse)');

let isMobile = mqMobile.matches;

// Collects everything that needs to know about a breakpoint flip.
const breakpointHandlers = [];
function onBreakpointChange(fn) { breakpointHandlers.push(fn); }

function syncBreakpoint() {
  if (mqMobile.matches === isMobile) return;
  isMobile = mqMobile.matches;
  breakpointHandlers.forEach(fn => fn(isMobile));
}
mqMobile.addEventListener('change', syncBreakpoint);

// Coalesces bursts of scroll/resize events into one job per animation frame.
function rafThrottle(fn) {
  let queued = false;
  return function throttled() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(); });
  };
}

function debounce(fn, ms) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Belt and braces: a couple of environments (older WebViews, some embedded
// browsers) resize the layout viewport without firing the matchMedia `change`
// event. syncBreakpoint() is idempotent, so re-checking on resize costs nothing
// and guarantees the layout mode always matches the actual width.
window.addEventListener('resize', () => syncBreakpoint(), { passive: true });
window.addEventListener('orientationchange', () => syncBreakpoint(), { passive: true });

// One rAF-throttled scroll pass drives every scroll-reactive feature, instead of
// each feature registering its own listener.
const scrollSubscribers = [];
function onScroll(fn) { scrollSubscribers.push(fn); }
const runScrollSubscribers = rafThrottle(() => {
  for (const fn of scrollSubscribers) fn();
});
window.addEventListener('scroll', runScrollSubscribers, { passive: true });


/* ─── Custom Cursor ─── */
// Skipped entirely on touch/coarse-pointer devices: no mouse, no cursor to draw.
const cursor = document.getElementById('cursor');
const cursorFollower = document.getElementById('cursorFollower');

if (cursor && cursorFollower && !mqCoarse.matches) {
  let mouseX = 0, mouseY = 0;
  let followerX = 0, followerY = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  }, { passive: true });

  (function animateFollower() {
    followerX += (mouseX - followerX) * 0.12;
    followerY += (mouseY - followerY) * 0.12;
    cursorFollower.style.transform =
      `translate(${followerX}px, ${followerY}px) translate(-50%, -50%)`;
    requestAnimationFrame(animateFollower);
  })();

  // Event delegation — one pair of listeners instead of one per element, so
  // controls created later (skill slides, dots) get the hover state too.
  const HOVER_SEL = 'a, button, input, textarea, .pdot, .ss-mdot, .ss-arc-num';
  document.addEventListener('mouseover', e => {
    if (e.target.closest(HOVER_SEL)) {
      cursor.classList.add('hovering');
      cursorFollower.classList.add('hovering');
    }
  }, { passive: true });
  document.addEventListener('mouseout', e => {
    if (e.target.closest(HOVER_SEL)) {
      cursor.classList.remove('hovering');
      cursorFollower.classList.remove('hovering');
    }
  }, { passive: true });
} else if (cursor && cursorFollower) {
  cursor.remove();
  cursorFollower.remove();
}


/* ─── Navbar ─── */
const nav = document.getElementById('nav');
const navSections = Array.from(document.querySelectorAll('section[id]'));
const navLinks    = Array.from(document.querySelectorAll('.nav-link'));

function updateNav() {
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 40);

  // getBoundingClientRect beats offsetTop here: it stays correct no matter how
  // the section is positioned or what its offsetParent turns out to be.
  let current = '';
  for (const section of navSections) {
    if (section.getBoundingClientRect().top <= 120) current = section.id;
  }
  for (const link of navLinks) {
    link.classList.toggle('active', link.getAttribute('href') === '#' + current);
  }
}
onScroll(updateNav);


/* ─── Mobile nav ─── */
const navToggle = document.getElementById('navToggle');
const mobMenu   = document.getElementById('mobMenu');

function setMobMenu(open) {
  navToggle.classList.toggle('open', open);
  mobMenu.classList.toggle('open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

navToggle.setAttribute('aria-expanded', 'false');
navToggle.addEventListener('click', () => setMobMenu(!mobMenu.classList.contains('open')));
document.querySelectorAll('.mob-link').forEach(link =>
  link.addEventListener('click', () => setMobMenu(false)));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && mobMenu.classList.contains('open')) setMobMenu(false);
});

// A menu left open while resizing to desktop would keep body scroll locked.
onBreakpointChange(mobile => { if (!mobile) setMobMenu(false); });


/* ─── Smooth scroll for in-page anchors ─── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const href = anchor.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({
      behavior: mqReduced.matches ? 'auto' : 'smooth',
      block: 'start'
    });
    history.replaceState(null, '', href);
  });
});


/* ─── Topographic Line Art background ─── */
const canvas = document.getElementById('bgCanvas');

if (canvas && !mqReduced.matches) {
  const ctx = canvas.getContext('2d');

  const CELL   = isMobile ? 44 : 26;
  const LEVELS = isMobile ? 6  : 14;

  let viewW = 0, viewH = 0;
  let topoTime = 0;
  let topoMX = -9999, topoMY = -9999;
  let bumpAmt = 0, bumpVel = 0;
  let rafId = null;
  let lastTs = 0;

  if (!mqCoarse.matches) {
    window.addEventListener('mousemove', e => {
      topoMX = e.clientX;
      topoMY = e.clientY;
      bumpVel = 0.09;
    }, { passive: true });
  }

  function resizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    // Back the canvas with real device pixels, capped so a 3× phone screen
    // doesn't triple the per-frame cost. Without this the hairlines were
    // resampled from a 1× buffer and looked soft on every retina display.
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    canvas.width  = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    canvas.style.width  = viewW + 'px';
    canvas.style.height = viewH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();

  // On phones, showing/hiding the URL bar fires `resize` with a new height on
  // every scroll. Reacting to that caused a visible re-render storm, so only a
  // real width change counts as a resize there.
  let lastW = window.innerWidth;
  window.addEventListener('resize', debounce(() => {
    if (isMobile && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    resizeCanvas();
  }, 150), { passive: true });

  function topoNoise(nx, ny) {
    const base = (
      Math.sin(nx * 1.3 + topoTime * 0.22) * Math.cos(ny * 1.0 - topoTime * 0.17) +
      Math.sin(nx * 2.4 - ny * 0.6 + topoTime * 0.14) * 0.55 +
      Math.cos(nx * 0.5 + ny * 1.9 - topoTime * 0.20) * 0.45 +
      Math.sin(nx * 0.4 - ny * 0.5 + topoTime * 0.09) * 0.30
    ) / 2.3;
    if (bumpAmt > 0.02 && topoMX >= 0) {
      const cx = (topoMX / viewW) * 5.5;
      const cy = (topoMY / viewH) * 5.5;
      const d2 = (nx - cx) * (nx - cx) + (ny - cy) * (ny - cy);
      return base + bumpAmt * Math.exp(-d2 * 9.0);
    }
    return base;
  }

  const SEG = [
    [], [[2,3]], [[1,2]], [[1,3]],
    [[0,1]], [[0,3],[1,2]], [[0,2]], [[0,3]],
    [[0,3]], [[0,2]], [[0,1],[2,3]], [[0,1]],
    [[1,3]], [[1,2]], [[2,3]], []
  ];

  function edgePt(e, x, y, cs, vTL, vTR, vBR, vBL, thr) {
    const f = (a, b) => b !== a ? clamp((thr - a) / (b - a), 0, 1) : 0.5;
    if (e === 0) return [x + cs * f(vTL, vTR), y];
    if (e === 1) return [x + cs, y + cs * f(vTR, vBR)];
    if (e === 2) return [x + cs * f(vBL, vBR), y + cs];
                 return [x, y + cs * f(vTL, vBL)];
  }

  const ptKey = (x, y) => `${Math.round(x * 2)},${Math.round(y * 2)}`;

  function buildChains(segs) {
    if (!segs.length) return [];
    const used    = new Uint8Array(segs.length);
    const headMap = new Map();
    const tailMap = new Map();
    segs.forEach(([a, b], i) => {
      headMap.set(ptKey(a[0], a[1]), i);
      tailMap.set(ptKey(b[0], b[1]), i);
    });
    const chains = [];
    for (let s = 0; s < segs.length; s++) {
      if (used[s]) continue;
      used[s] = 1;
      const pts = [segs[s][0], segs[s][1]];
      for (;;) {
        const [lx, ly] = pts[pts.length - 1];
        const k = ptKey(lx, ly);
        let i = headMap.get(k);
        if (i !== undefined && !used[i]) { used[i] = 1; pts.push(segs[i][1]); continue; }
        i = tailMap.get(k);
        if (i !== undefined && !used[i]) { used[i] = 1; pts.push(segs[i][0]); continue; }
        break;
      }
      for (;;) {
        const [fx, fy] = pts[0];
        const k = ptKey(fx, fy);
        let i = tailMap.get(k);
        if (i !== undefined && !used[i]) { used[i] = 1; pts.unshift(segs[i][0]); continue; }
        i = headMap.get(k);
        if (i !== undefined && !used[i]) { used[i] = 1; pts.unshift(segs[i][1]); continue; }
        break;
      }
      if (pts.length >= 2) chains.push(pts);
    }
    return chains;
  }

  function drawSmooth(pts) {
    if (pts.length < 2) return;
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) { ctx.lineTo(pts[1][0], pts[1][1]); return; }
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]
      );
    }
  }

  function drawTopo(ts) {
    rafId = requestAnimationFrame(drawTopo);

    // Advance by elapsed time, not by frame count — otherwise the animation
    // ran at double speed on 120 Hz displays.
    const dt = lastTs ? Math.min((ts - lastTs) / 16.667, 3) : 1;
    lastTs = ts;

    ctx.clearRect(0, 0, viewW, viewH);

    bumpAmt += bumpVel * dt;
    bumpVel  = bumpVel * Math.pow(0.65, dt) - bumpAmt * 0.06 * dt;
    if (Math.abs(bumpAmt) < 0.001 && Math.abs(bumpVel) < 0.001) { bumpAmt = 0; bumpVel = 0; }

    const cols = Math.ceil(viewW / CELL) + 1;
    const rows = Math.ceil(viewH / CELL) + 1;
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      grid[r] = [];
      for (let c = 0; c <= cols; c++) {
        grid[r][c] = topoNoise((c / cols) * 5.5, (r / rows) * 5.5);
      }
    }

    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';

    for (let lv = 0; lv < LEVELS; lv++) {
      const thr     = -0.9 + (lv / (LEVELS - 1)) * 1.8;
      const primary = lv % 4 === 0;
      const segs = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * CELL, y = r * CELL;
          const vTL = grid[r][c],       vTR = grid[r][c + 1];
          const vBR = grid[r + 1][c + 1], vBL = grid[r + 1][c];
          const st  = ((vTL>thr)?8:0)|((vTR>thr)?4:0)|((vBR>thr)?2:0)|((vBL>thr)?1:0);
          for (const [ea, eb] of SEG[st]) {
            segs.push([
              edgePt(ea, x, y, CELL, vTL, vTR, vBR, vBL, thr),
              edgePt(eb, x, y, CELL, vTL, vTR, vBR, vBL, thr)
            ]);
          }
        }
      }
      const chains = buildChains(segs);
      const boost  = Math.min(bumpAmt * 0.5, 0.3);
      ctx.strokeStyle = primary
        ? `rgba(255,255,255,${0.65 + boost})`
        : `rgba(255,255,255,${0.30 + boost * 0.5})`;
      ctx.lineWidth = primary ? 1.2 : 0.7;
      ctx.beginPath();
      for (const chain of chains) drawSmooth(chain);
      ctx.stroke();
    }

    if (bumpAmt > 0.03 && topoMX >= 0) {
      const glowRadius = 140 + bumpAmt * 60;
      const glowAlpha  = Math.min(bumpAmt * 0.12, 0.18);
      const grd = ctx.createRadialGradient(topoMX, topoMY, 0, topoMX, topoMY, glowRadius);
      grd.addColorStop(0,   `rgba(255,255,255,${glowAlpha})`);
      grd.addColorStop(0.4, `rgba(255,255,255,${glowAlpha * 0.3})`);
      grd.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(topoMX, topoMY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      const dotGrd = ctx.createRadialGradient(topoMX, topoMY, 0, topoMX, topoMY, 18);
      dotGrd.addColorStop(0, `rgba(255,255,255,${Math.min(bumpAmt * 0.4, 0.5)})`);
      dotGrd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = dotGrd;
      ctx.beginPath();
      ctx.arc(topoMX, topoMY, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    topoTime += 0.004 * dt;
  }

  function startTopo() { if (rafId === null) { lastTs = 0; rafId = requestAnimationFrame(drawTopo); } }
  function stopTopo()  { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }

  // No point burning battery on a background tab.
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopTopo() : startTopo();
  });
  startTopo();
}


/* ─── Profile card 3D tilt ─── */
const profileCard = document.getElementById('profileCard');
if (profileCard && !mqCoarse.matches) {
  const holder = profileCard.parentElement;
  holder.addEventListener('mousemove', e => {
    const rect = profileCard.getBoundingClientRect();
    const rotY = ((e.clientX - (rect.left + rect.width  / 2)) / (rect.width  / 2)) * 15;
    const rotX = ((e.clientY - (rect.top  + rect.height / 2)) / (rect.height / 2)) * -15;
    profileCard.style.transform =
      `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
  }, { passive: true });
  holder.addEventListener('mouseleave', () => {
    profileCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
  }, { passive: true });
}


/* ─── Scroll Reveal ─── */
// These selectors used to name classes from an older markup revision
// (.project-card, .channel-card, .skill-category, .contact-text …) that no
// longer exist, so most of the page never animated in. Now they match reality.
const revealTargets = Array.from(document.querySelectorAll(
  '.section-header, .about-text, .about-card-3d, .stat-card, ' +
  '.ch-header, .ch-sub, .ch-card, ' +
  '.ct-header, .ct-left, .ct-form, .ct-info-card'
));

// `.reveal` starts at opacity:0, so anything that stops the reveal from running
// leaves whole sections permanently invisible. Only opt in to the animation
// when we can guarantee an element will be un-hidden again.
const revealPending = new Set(revealTargets);
let revealObserver = null;

if ('IntersectionObserver' in window && !mqReduced.matches) {
  const show = el => { el.classList.add('visible'); revealPending.delete(el); };

  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        show(entry.target);
        revealObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });

  revealTargets.forEach((el, i) => {
    el.classList.add('reveal');
    if (i % 2 === 1) el.classList.add('reveal-delay-1');
    if (i % 3 === 2) el.classList.add('reveal-delay-2');
    revealObserver.observe(el);
  });

  // Safety net for a starved observer (bfcache restore, layout race): reveal
  // anything that is on screen but still hidden. Scoped to the viewport so
  // content further down keeps its entrance animation, and it unhooks itself
  // once every target has been shown.
  function revealWhatIsOnScreen() {
    if (!revealPending.size) return;
    for (const el of Array.from(revealPending)) {
      // Anything whose top has crossed the bottom edge has been reached —
      // including things already scrolled past, which must never stay hidden.
      if (el.getBoundingClientRect().top < window.innerHeight) {
        show(el);
        revealObserver.unobserve(el);
      }
    }
  }
  onScroll(revealWhatIsOnScreen);
  setTimeout(revealWhatIsOnScreen, 1200);
}

// Lets content built after the fact (project grid cards, populated once
// their data arrives from Supabase) opt into the same reveal animation the
// static targets above get — they don't exist yet when this file first runs.
function observeReveal(el) {
  el.classList.add('reveal');
  if (!revealObserver) { el.classList.add('visible'); return; }
  revealPending.add(el);
  revealObserver.observe(el);
}


/* ─── i18n — bilingual EN / UZ ─── */
const translations = {
  en: {
    nav_about:           'About',
    nav_portfolio:       'Portfolio',
    nav_skills:          'Skills',
    nav_channels:        'Channels',
    nav_contact:         'Contact',
    page_title:          'MIM — Muhammad Ismoil | Full Stack Developer',
    hero_badge:          'Available for opportunities',
    hero_tagline:        'Full Stack Developer',
    hero_btn1:           'See my work',
    hero_btn2:           'Get in Touch',
    about_title:         'About Me',
    about_lead:          'A 17-year-old developer and creator from <strong>Kokand, Uzbekistan</strong>, passionate about building useful and meaningful projects.',
    about_p1:            'I study at <strong>Target International School</strong>, where I balance academic learning with a strong focus on technology and hands-on development. I strongly believe in learning through building, and I improve my skills with every project I complete.',
    about_p2:            'Outside of coding, I explore new ideas, work on creative projects, and continuously challenge myself to grow as a developer and thinker.',
    stat_age:            'Age',
    stat_projects:       'Projects',
    stat_ideas:          'Ideas',
    card_role:           'Developer & Creator',
    portfolio_title:     'Portfolio',
    link_live:           'Live →',
    link_code:           'Code →',
    more_projects_title: 'More Projects',
    filter_all:          'All',
    load_more:           'Load more',
    no_more_projects:    'More projects coming soon.',
    want_like_this:      'Want something like this →',
    hire_fab:             'Hire Me',
    hire_modal_title:    'Start a project',
    hire_ref_lead:       'Request inspired by',
    hire_project_type:   'Project type',
    hire_type_business:  'Business site',
    hire_type_ecommerce: 'E-commerce',
    hire_type_webapp:    'Web app',
    hire_type_landing:   'Landing page',
    hire_type_other:     'Other',
    hire_budget:         'Budget',
    hire_budget_unset:   'Not sure yet',
    hire_timeline:       'Timeline',
    hire_timeline_unset: 'Flexible',
    hire_timeline_asap:  'As soon as possible',
    hire_timeline_2w:    '1–2 weeks',
    hire_timeline_1m:    '1 month+',
    hire_send:           'Send request →',
    hire_sent:           'Request sent ✓',
    hire_sent_msg:       "Thanks — I'll get back to you within a day.",
    hire_error_msg:      'Could not send — please try the contact form below instead.',
    skills_title:        'Skills',
    channels_title:      'Channels',
    channels_lead:       'Find me across the internet. Follow along for content, updates, and behind-the-scenes.',
    contact_title:       'Contact',
    contact_h3:          "Let's build something together.",
    contact_p:           'Have a project in mind? Want to collaborate? Or just want to say hi? My inbox is always open.',
    contact_loc_label:   'Location',
    contact_loc_val:     'Kokand, Uzbekistan',
    contact_school_label:'School',
    contact_status_label:'Status',
    contact_status_val:  'Available for projects',
    form_name:           'Name',
    form_name_ph:        'Your name',
    form_email:          'Email',
    form_email_ph:       'your@email.com — for a reply',
    form_optional:       'optional',
    form_message:        'Message',
    form_message_ph:     'Tell me about your project...',
    form_send:           'Send Message →',
    form_sending:        'Sending…',
    form_sent:           'Message sent ✓',
    form_sent_msg:       'Thanks — your message is on its way. I usually reply within a day.',
    form_error:          'Could not send',
    form_error_msg:      'The mail service is not responding right now.',
    form_fallback_lead:  'Mail service is down — reach me directly:',
    form_err_name:       'Please enter your name.',
    form_err_email:      'Please enter a valid email address.',
    form_err_message:    'Please write a short message (at least 10 characters).',
    footer_brand:        'Muhammad Ismoil Muminkhujaev',
    footer_nav:          'Navigation',
    footer_social:       'Social',
    footer_copy:         '© {year} Muhammad Ismoil — MIM. All rights reserved.',
    footer_made:         'Made with passion in Uzbekistan',
    mob_copy:            '© {year} MIM',
  },
  uz: {
    nav_about:           'Haqimda',
    nav_portfolio:       'Portfolio',
    nav_skills:          "Ko'nikmalar",
    nav_channels:        'Kanallar',
    nav_contact:         'Aloqa',
    page_title:          'MIM — Muhammad Ismoil | Full Stack Dasturchi',
    hero_badge:          'Imkoniyatlarga tayyor',
    hero_tagline:        'Full Stack Dasturchi',
    hero_btn1:           "Ishlarimni ko'ring",
    hero_btn2:           "Bog'laning",
    about_title:         'Men haqimda',
    about_lead:          "<strong>Qo'qon, O'zbekiston</strong>lik 17 yoshli dasturchi va ijodkorman, foydali va mazmunli loyihalar yaratishga katta qiziqishim bor.",
    about_p1:            "Men <strong>Target International School</strong>'da o'qiyman va u yerda akademik bilimlarni texnologiya hamda amaliy dasturlash bilan uyg'unlashtiraman. Men \"o'rganish — bu yaratish orqali bo'ladi\" degan tamoyilga ishonaman va har bir loyiha orqali o'zimni rivojlantirib boraman.",
    about_p2:            "Bo'sh vaqtlarimda yangi g'oyalarni o'rganaman, ijodiy loyihalar ustida ishlayman va dasturchi sifatida o'sish uchun doim o'zimni sinovdan o'tkazaman.",
    stat_age:            'Yosh',
    stat_projects:       'Loyihalar',
    stat_ideas:          "G'oyalar",
    card_role:           'Dasturchi va Ijodkor',
    portfolio_title:     'Portfolio',
    link_live:           "Ko'rish →",
    link_code:           'Kod →',
    more_projects_title: 'Boshqa loyihalar',
    filter_all:          'Hammasi',
    load_more:           "Yana ko'rsatish",
    no_more_projects:    'Tez orada yangi loyihalar qo\'shiladi.',
    want_like_this:      'Shunga o\'xshash loyiha xohlayman →',
    hire_fab:             'Buyurtma berish',
    hire_modal_title:    'Loyiha boshlash',
    hire_ref_lead:       'Ilhomlangan loyiha',
    hire_project_type:   'Loyiha turi',
    hire_type_business:  'Biznes sayti',
    hire_type_ecommerce: 'Onlayn do\'kon',
    hire_type_webapp:    'Veb-ilova',
    hire_type_landing:   'Landing sahifa',
    hire_type_other:     'Boshqa',
    hire_budget:         'Byudjet',
    hire_budget_unset:   'Hali aniq emas',
    hire_timeline:       'Muddat',
    hire_timeline_unset: 'Moslashuvchan',
    hire_timeline_asap:  'Imkon qadar tezroq',
    hire_timeline_2w:    '1–2 hafta',
    hire_timeline_1m:    "1 oy+",
    hire_send:           'Yuborish →',
    hire_sent:           'Yuborildi ✓',
    hire_sent_msg:       "Rahmat — bir kun ichida javob beraman.",
    hire_error_msg:      "Yuborilmadi — pastdagi Contact formasidan foydalaning.",
    skills_title:        "Ko'nikmalar",
    channels_title:      'Kanallar',
    channels_lead:       "Meni internetda toping. Kontent, yangiliklar va sahna ortidan xabardor bo'lib turing.",
    contact_title:       'Aloqa',
    contact_h3:          'Keling, birgalikda biror narsa quraylik.',
    contact_p:           "Loyihangiz bormi? Hamkorlik qilmoqchimisiz? Yoki shunchaki salom demoqchimisiz? Mening pochtam doim ochiq.",
    contact_loc_label:   'Manzil',
    contact_loc_val:     "Qo'qon, O'zbekiston",
    contact_school_label:'Maktab',
    contact_status_label:'Holat',
    contact_status_val:  'Loyihalarga tayyor',
    form_name:           'Ism',
    form_name_ph:        'Ismingiz',
    form_email:          'Elektron pochta',
    form_email_ph:       'pochta@manzil.com — javob olish uchun',
    form_optional:       'ixtiyoriy',
    form_message:        'Xabar',
    form_message_ph:     'Loyihangiz haqida yozing...',
    form_send:           'Xabar yuborish →',
    form_sending:        'Yuborilmoqda…',
    form_sent:           'Xabar yuborildi ✓',
    form_sent_msg:       "Rahmat — xabaringiz yuborildi. Odatda bir kun ichida javob beraman.",
    form_error:          'Yuborilmadi',
    form_error_msg:      "Pochta xizmati hozir javob bermayapti.",
    form_fallback_lead:  "Pochta xizmati ishlamayapti — men bilan to'g'ridan-to'g'ri bog'laning:",
    form_err_name:       'Iltimos, ismingizni kiriting.',
    form_err_email:      "Iltimos, to'g'ri elektron pochta manzilini kiriting.",
    form_err_message:    "Iltimos, qisqacha xabar yozing (kamida 10 ta belgi).",
    footer_brand:        'Muhammad Ismoil Muminkhujaev',
    footer_nav:          'Navigatsiya',
    footer_social:       'Ijtimoiy',
    footer_copy:         "© {year} Muhammad Ismoil — MIM. Barcha huquqlar himoyalangan.",
    footer_made:         "O'zbekistonda mehr bilan yaratildi",
    mob_copy:            '© {year} MIM',
  }
};

const YEAR = new Date().getFullYear();
let currentLang = localStorage.getItem('mim-lang') === 'uz' ? 'uz' : 'en';

function t(key) {
  const dict = translations[currentLang] || translations.en;
  const val = dict[key] !== undefined ? dict[key] : translations.en[key];
  return val === undefined ? '' : String(val).replace('{year}', YEAR);
}

// Anything that needs re-rendering when the language flips registers here.
const langSubscribers = [];
function onLangChange(fn) { langSubscribers.push(fn); }

function applyLang(lang) {
  currentLang = translations[lang] ? lang : 'en';
  try { localStorage.setItem('mim-lang', currentLang); } catch { /* private mode */ }

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.getAttribute('data-i18n'));
    if (val !== '') el.innerHTML = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const val = t(el.getAttribute('data-i18n-placeholder'));
    if (val !== '') el.setAttribute('placeholder', val);
  });

  document.getElementById('langEN').classList.toggle('lang-active', currentLang === 'en');
  document.getElementById('langUZ').classList.toggle('lang-active', currentLang === 'uz');
  document.documentElement.lang = currentLang;
  document.title = t('page_title');

  langSubscribers.forEach(fn => fn(currentLang));
}

document.getElementById('langToggle').addEventListener('click', () => {
  applyLang(currentLang === 'en' ? 'uz' : 'en');
});


/* ============================================================
   Slide stages — portfolio & skills

   One controller, two presentations:

   • wide screens — the stage is position:sticky and the active slide is
     derived from scroll position. Nothing is preventDefault-ed, so the wheel,
     the trackpad, a touchscreen, the scrollbar, Page Down and the arrow keys
     all drive it. The previous build hijacked `wheel`, which is why the
     animation was dead on trackpad-less and touch-first machines.

   • narrow screens — the slides are a native horizontal scroll-snap carousel
     (see styles.css). Vertical swipes scroll the page, horizontal swipes move
     the carousel; the browser arbitrates, so the visitor can never get stuck.
   ============================================================ */
function createStage({ wrapper, stage, track, slides, dots, onActivate }) {
  if (!wrapper || !stage || !track || !slides.length) return null;

  let current = -1;
  let mode = null;

  function setActive(i, notify = true) {
    i = clamp(i, 0, slides.length - 1);
    if (i === current) return;
    current = i;
    slides.forEach((slide, n) => {
      slide.classList.toggle('active', n === i);
      slide.classList.toggle('exited', n < i);
      // No aria-hidden here: on desktop `visibility:hidden` already removes the
      // inactive slides from the a11y tree and the tab order, and on mobile
      // every slide really is reachable by swiping.
    });
    dots.forEach((d, n) => {
      d.classList.toggle('active', n === i);
      if (n === i) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
    if (notify && onActivate) onActivate(i);
  }

  const stepHeight = () => stage.offsetHeight || window.innerHeight;

  function syncFromScroll() {
    if (mode !== 'desktop') return;
    setActive(Math.round(-wrapper.getBoundingClientRect().top / stepHeight()));
  }

  const syncFromTrack = rafThrottle(() => {
    if (mode !== 'mobile') return;
    const w = track.clientWidth;
    if (w) setActive(Math.round(track.scrollLeft / w));
  });
  track.addEventListener('scroll', syncFromTrack, { passive: true });

  function goTo(i, smooth = true) {
    i = clamp(i, 0, slides.length - 1);
    const behavior = (smooth && !mqReduced.matches) ? 'smooth' : 'auto';
    if (mode === 'mobile') {
      track.scrollTo({ left: i * track.clientWidth, behavior });
    } else {
      const top = wrapper.getBoundingClientRect().top + window.scrollY + i * stepHeight();
      window.scrollTo({ top, behavior });
    }
    setActive(i);
  }

  dots.forEach((dot, i) => {
    if (!dot.getAttribute('aria-label')) dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
  });

  // Arrow keys work when a dot has focus — keyboard users get the same control.
  dots.forEach(dot => dot.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(current + 1); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); goTo(current - 1); }
  }));

  // One viewport of real page scroll per slide. Measured in pixels from the
  // stage rather than written as `calc(N * 100vh)`: the stage is sized in svh,
  // and on tablets with a collapsing toolbar vh and svh differ, so a vh-based
  // wrapper would drift further out of step with every slide.
  function applyDesktopHeight() {
    wrapper.style.height = (slides.length * stepHeight()) + 'px';
  }

  function configure(mobile) {
    const next = mobile ? 'mobile' : 'desktop';
    if (next === mode) return;
    mode = next;
    if (mode === 'desktop') {
      applyDesktopHeight();
      track.scrollLeft = 0;
      syncFromScroll();
    } else {
      wrapper.style.height = '';           // CSS drives it (one screen tall)
      const keep = Math.max(current, 0);
      current = -1;                        // force class re-application
      setActive(keep, false);
      requestAnimationFrame(() => { track.scrollLeft = keep * track.clientWidth; });
    }
  }

  configure(isMobile);
  onBreakpointChange(configure);
  onScroll(syncFromScroll);
  // Re-derive after a resize so the slide matches where the page actually sits.
  window.addEventListener('resize', debounce(() => {
    if (mode === 'desktop') { applyDesktopHeight(); syncFromScroll(); }
    else track.scrollLeft = Math.max(current, 0) * track.clientWidth;
  }, 160), { passive: true });

  return { goTo, setActive, get current() { return current; } };
}


/* ─── Supabase ───
   The anon/publishable key is meant to be public — same trust model already
   used for the EmailJS key above. The real security boundary is Row Level
   Security on the database side (see supabase/schema.sql), not secrecy of
   this key. */
const SUPABASE_URL = 'https://kbdagyzgyufbpvtsubhh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_A5EJdvR7OxKfkLf0wpsu1g_3bvX0kbN';

function getSupabaseClient() {
  if (typeof supabase === 'undefined') return null;
  try { return supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY); }
  catch { return null; }
}

// Project text is now admin-editable DB content, not developer-written
// literals, so anything interpolated into innerHTML gets escaped.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}


/* ─── Shared form helpers — used by both the contact form and the
   hire-me form below ─── */
const EJS_SERVICE  = 'service_b317zyh';
const EJS_TEMPLATE = 'template_3w4hisk';
const EJS_KEY      = 'ClVyIQU-leRs4bEwP';
const OWNER_EMAIL  = 'mr2009ismoil@gmail.com';

// The SDK is loaded from a CDN. A blocked or failed CDN must only cost the
// forms that need it, not the rest of the page.
let emailjsReady = false;
function initEmailJS() {
  if (typeof emailjs === 'undefined') return false;
  try {
    emailjs.init({ publicKey: EJS_KEY });     // v4 signature
    emailjsReady = true;
  } catch {
    try { emailjs.init(EJS_KEY); emailjsReady = true; }  // pre-v4 fallback
    catch { emailjsReady = false; }
  }
  return emailjsReady;
}
// `defer` on the SDK tag means it is parsed before DOMContentLoaded.
document.addEventListener('DOMContentLoaded', initEmailJS);

// Deliberately permissive: the goal is catching typos, not policing RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function fieldError(input, message) {
  input.classList.toggle('invalid', Boolean(message));
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  let slot = input.parentElement.querySelector('.ct-field-error');
  if (!slot) {
    slot = document.createElement('span');
    slot.className = 'ct-field-error';
    input.parentElement.appendChild(slot);
  }
  slot.textContent = message || '';
}


/* ─── Portfolio stage — built from Supabase `projects` rows ───
   Four legacy projects (seeded before any admin panel existed) still use
   their original hand-built CSS illustrations, keyed by slug, since they
   don't have an uploaded screenshot yet. The moment a project's admin-set
   cover_image_url is filled in, buildProjectVisual() below switches to a
   real <img> automatically — no code change needed. */
const LEGACY_PREVIEW_HTML = {
  tonsor: `
    <div class="ps-glow" style="--c:123,155,92"></div>
    <div class="ps-tonsor-preview">
      <div class="ps-tonsor-label">DEVELOPED BY MIM</div>
      <div class="ps-tonsor-heading">Pure Mastery.</div>
      <div class="ps-tonsor-sub">Tonsor — Elite Barber Platform</div>
      <div class="ps-tonsor-btn">START EXPERIENCE</div>
    </div>`,
  ozbekiston: `
    <div class="ps-glow" style="--c:0,120,200"></div>
    <div class="ps-uzbek-preview">
      <div class="ps-uzbek-flag-stripe"></div>
      <div class="ps-uzbek-body">
        <div class="ps-uzbek-crescent">
          <div class="ps-uzbek-moon"></div>
          <div class="ps-uzbek-stars">
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
          </div>
        </div>
        <div class="ps-uzbek-label">MARKAZIY OSIYO · 1991</div>
        <div class="ps-uzbek-heading">O'ZBEKISTON</div>
        <div class="ps-uzbek-tagline">BIR XALQ · BIR TARIX · BIR KELAJAK</div>
      </div>
    </div>`,
  'mim-logistic': `
    <div class="ps-glow" style="--c:255,160,40"></div>
    <div class="ps-logistic-preview">
      <div class="ps-logistic-grid"></div>
      <div class="ps-logistic-content">
        <div class="ps-logistic-label">LOGISTICS · DELIVERY</div>
        <div class="ps-logistic-heading">MIM<span>LOGISTIC</span></div>
        <div class="ps-logistic-sub">Fast · Reliable · Global</div>
        <div class="ps-logistic-wip">⚡ In Progress</div>
      </div>
    </div>`,
  'maison-aura': `
    <div class="ps-glow" style="--c:210,175,120"></div>
    <div class="ps-aura-preview">
      <div class="ps-aura-overline">COLLECTION 2025</div>
      <div class="ps-aura-brand">MAISON<br>AURA</div>
      <div class="ps-aura-tagline">Luxury Online Boutique</div>
      <div class="ps-aura-divider"></div>
      <div class="ps-aura-sub">SHOP · DISCOVER · ELEVATE</div>
    </div>`,
};
// Tonsor's dark-frame CSS override only fires together with the `.featured`
// class on the slide (styles.css:1097-1106) — reproduced in buildProjectSlide.
const LEGACY_FRAME_CLASS = {
  tonsor: 'tonsor-frame',
  ozbekiston: 'uzbek-frame',
  'mim-logistic': 'logistic-frame',
  'maison-aura': 'aura-frame',
};

function buildProjectVisual(p) {
  const frame = document.createElement('div');
  frame.className = 'ps-img-frame';
  if (p.cover_image_url) {
    frame.innerHTML = `<img class="ps-project-img" src="${p.cover_image_url}" alt="${p.title_en} screenshot" loading="lazy" />`;
  } else if (LEGACY_PREVIEW_HTML[p.slug]) {
    frame.classList.add(LEGACY_FRAME_CLASS[p.slug]);
    frame.innerHTML = LEGACY_PREVIEW_HTML[p.slug];
  } else {
    frame.innerHTML = `<span class="ps-placeholder">${escapeHtml((p.category || 'PROJECT').toUpperCase())}</span>`;
  }
  return frame;
}

function buildProjectSlide(p, i, total) {
  const slide = document.createElement('div');
  slide.className = 'portfolio-slide' + (p.slug === 'tonsor' ? ' featured' : '');
  slide.dataset.index = i;

  const bgNum = document.createElement('div');
  bgNum.className = 'ps-bg-num';
  bgNum.textContent = String(i + 1).padStart(2, '0');

  const visual = document.createElement('div');
  visual.className = 'ps-visual';
  visual.appendChild(buildProjectVisual(p));

  const info = document.createElement('div');
  info.className = 'ps-info';
  const links = [];
  if (p.live_url) links.push(`<a href="${p.live_url}" target="_blank" rel="noopener" class="ps-link" data-i18n="link_live">Live →</a>`);
  if (p.code_url) links.push(`<a href="${p.code_url}" target="_blank" rel="noopener" class="ps-link" data-i18n="link_code">Code →</a>`);
  info.innerHTML = `
    <div class="ps-num">${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
    <h3 class="ps-title"></h3>
    <p class="ps-desc"></p>
    <div class="ps-tags">${(p.tech_tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="ps-links">
      ${links.join('')}
      <button type="button" class="ps-link ps-hire-link" data-i18n="want_like_this">Want something like this →</button>
    </div>`;
  info.querySelector('.ps-hire-link').addEventListener('click', () => openHireModal(p));

  slide.append(bgNum, visual, info);
  return slide;
}

function renderFeaturedProjects(rows) {
  const track = document.getElementById('psTrack');
  const dotsEl = document.getElementById('portfolioDots');
  if (!track || !dotsEl || !rows.length) return;

  track.innerHTML = '';
  dotsEl.innerHTML = '';

  rows.forEach((p, i) => {
    track.appendChild(buildProjectSlide(p, i, rows.length));
    const dot = document.createElement('button');
    dot.className = 'pdot' + (i === 0 ? ' active' : '');
    dot.dataset.index = i;
    dotsEl.appendChild(dot);
  });

  const slideEls = Array.from(track.querySelectorAll('.portfolio-slide'));

  // Titles/descriptions are DB strings, not translations-dict keys, so they
  // re-render on a language flip the same way skill copy does below.
  const setProjectText = lang => {
    slideEls.forEach((el, i) => {
      const p = rows[i];
      el.querySelector('.ps-title').textContent = lang === 'uz' ? p.title_uz : p.title_en;
      el.querySelector('.ps-desc').textContent  = (lang === 'uz' ? p.summary_uz : p.summary_en) || '';
    });
  };
  setProjectText(currentLang);
  onLangChange(setProjectText);

  createStage({
    wrapper: document.getElementById('portfolioWrapper'),
    stage:   document.getElementById('portfolioStage'),
    track,
    slides:  slideEls,
    dots:    Array.from(dotsEl.querySelectorAll('.pdot')),
  });
}


/* ─── Skills stage — built from Supabase `skills` rows ─── */
function renderSkills(rows) {
  const SKILLS = rows.map(r => ({
    cat:  { en: r.category_en, uz: r.category_uz },
    name: r.name,
    pct:  r.proficiency_pct,
    note: { en: r.note_en, uz: r.note_uz },
  }));

  const skWrapper  = document.getElementById('skillsWrapper');
  const skStage    = document.getElementById('skillsStage');
  const skArcWrap  = document.getElementById('ssArcWrap');
  const skSlidesEl = document.getElementById('ssSlides');

  if (skWrapper && skStage && skArcWrap && skSlidesEl && SKILLS.length) {

  // ── Build slides ──
  SKILLS.forEach((sk, i) => {
    const slide = document.createElement('div');
    slide.className = 'ss-slide' + (i === 0 ? ' active' : '');
    slide.dataset.index = i;
    slide.innerHTML = `
      <div class="ss-cat"></div>
      <h3 class="ss-name"></h3>
      <div class="ss-bar-row">
        <div class="ss-bar"><div class="ss-fill" style="--w:${sk.pct}%"></div></div>
        <span class="ss-pct">${sk.pct}%</span>
      </div>
      <p class="ss-note"></p>`;
    slide.querySelector('.ss-name').textContent = sk.name;
    skSlidesEl.appendChild(slide);
  });

  // ── Mobile dot navigation (always built; CSS decides when it shows) ──
  const mobileDots = document.createElement('div');
  mobileDots.className = 'ss-mobile-dots';
  SKILLS.forEach((_, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'ss-mdot' + (i === 0 ? ' active' : '');
    d.dataset.index = i;
    d.setAttribute('aria-label', `Skill ${i + 1}`);
    mobileDots.appendChild(d);
  });
  skStage.appendChild(mobileDots);

  // ── Arc navigation (desktop) ──
  const arcSvg  = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arcSvg.setAttribute('class', 'ss-arc-svg');
  arcSvg.setAttribute('aria-hidden', 'true');
  const arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  arcPath.setAttribute('stroke', 'rgba(255,255,255,0.1)');
  arcPath.setAttribute('stroke-width', '1');
  arcPath.setAttribute('fill', 'none');
  arcSvg.appendChild(arcPath);
  skArcWrap.appendChild(arcSvg);

  const arcNums = SKILLS.map((_, i) => {
    const el = document.createElement('div');
    el.className = 'ss-arc-num';
    el.dataset.index = i;
    el.textContent = String(i + 1).padStart(2, '0');
    skArcWrap.appendChild(el);
    return el;
  });

  const arcDot = document.createElement('div');
  arcDot.className = 'ss-arc-dot';
  skArcWrap.appendChild(arcDot);

  const R  = 540;   // circle radius
  const CX = -95;   // circle centre X, in arc-wrap coordinates

  function arcPoint(relStep) {
    const rad = relStep * 30 * Math.PI / 180;
    const cy  = (skStage.offsetHeight || window.innerHeight) * 0.5;
    return { x: CX + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  }

  function updateArc(active) {
    if (isMobile) return;
    const stageH = skStage.offsetHeight || window.innerHeight;
    arcSvg.setAttribute('viewBox', `0 0 480 ${stageH}`);

    const visStart = clamp(0 - active, -5, 5);
    const visEnd   = clamp((SKILLS.length - 1) - active, -5, 5);
    const p0 = arcPoint(visStart);
    const p1 = arcPoint(visEnd);
    const largeArc = Math.abs(visEnd - visStart) * 30 > 180 ? 1 : 0;
    arcPath.setAttribute('d',
      `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${largeArc} ${visEnd > visStart ? 1 : 0} ${p1.x} ${p1.y}`);

    arcNums.forEach((el, i) => {
      const rel = i - active;
      const absRel = Math.abs(rel);
      const { x, y } = arcPoint(rel);
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.style.fontSize = absRel === 0 ? '3.2rem'
                        : absRel === 1 ? '2.1rem'
                        : absRel === 2 ? '1.5rem'
                        : '1rem';
      el.style.opacity = Math.max(0, 1 - absRel * 0.22);
      el.className = 'ss-arc-num'
        + (absRel === 0 ? ' active' : '')
        + (absRel === 1 ? ' near1'  : '')
        + (absRel === 2 ? ' near2'  : '');
    });

    const { x: dx, y: dy } = arcPoint(0);
    arcDot.style.left = (dx + 22) + 'px';
    arcDot.style.top  = dy + 'px';
  }

  const skillsStage = createStage({
    wrapper: skWrapper,
    stage:   skStage,
    track:   skSlidesEl,
    slides:  Array.from(skSlidesEl.querySelectorAll('.ss-slide')),
    dots:    Array.from(mobileDots.querySelectorAll('.ss-mdot')),
    onActivate: updateArc,
  });

  arcNums.forEach((el, i) => el.addEventListener('click', () => skillsStage.goTo(i)));
  updateArc(0);
  window.addEventListener('resize', debounce(() => updateArc(skillsStage.current), 160), { passive: true });

  // Skill copy is data-driven, so it re-renders on a language flip.
  onLangChange(lang => {
    const slides = skSlidesEl.querySelectorAll('.ss-slide');
    slides.forEach((slide, i) => {
      slide.querySelector('.ss-cat').textContent  = SKILLS[i].cat[lang]  || SKILLS[i].cat.en;
      slide.querySelector('.ss-note').textContent = SKILLS[i].note[lang] || SKILLS[i].note.en;
    });
  });
  }
}


/* ─── Modal helpers — shared by the project-detail and hire-me modals ─── */
function openModal(el) {
  if (!el) return;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeModal(el) {
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  // Only release the scroll lock if no other modal is still open.
  if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
});


/* ─── Project detail modal (opened from a grid card) ─── */
const projectModalEl = document.getElementById('projectModal');
let modalProject = null;

function openProjectModal(p) {
  modalProject = p;
  const visualHost = document.getElementById('pmVisual');
  visualHost.innerHTML = '';
  visualHost.appendChild(buildProjectVisual(p));

  document.getElementById('pmCat').textContent = (p.category || '').toUpperCase();
  document.getElementById('pmTitle').textContent = currentLang === 'uz' ? p.title_uz : p.title_en;
  document.getElementById('pmDesc').textContent =
    (currentLang === 'uz' ? p.description_uz : p.description_en) ||
    (currentLang === 'uz' ? p.summary_uz     : p.summary_en) || '';
  document.getElementById('pmTags').innerHTML =
    (p.tech_tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('');

  const liveEl = document.getElementById('pmLive');
  const codeEl = document.getElementById('pmCode');
  liveEl.hidden = !p.live_url; if (p.live_url) liveEl.href = p.live_url;
  codeEl.hidden = !p.code_url; if (p.code_url) codeEl.href = p.code_url;

  openModal(projectModalEl);
}
document.getElementById('projectModalClose')?.addEventListener('click', () => closeModal(projectModalEl));
document.getElementById('pmHireBtn')?.addEventListener('click', () => {
  closeModal(projectModalEl);
  openHireModal(modalProject);
});


/* ─── All-projects grid — filterable, paginated, fed by non-featured
   published projects. The featured carousel above stays small and
   cinematic; everything else lives here so the catalog can grow past a
   handful of projects without the scroll experience degrading. ─── */
const GRID_PAGE_SIZE = 9;
let gridProjectsAll = [];
let gridCategory = 'all';
let gridVisibleCount = GRID_PAGE_SIZE;

function buildProjectCard(p) {
  const card = document.createElement('div');
  card.className = 'proj-card reveal';
  card.setAttribute('role', 'button');
  card.tabIndex = 0;

  const visual = document.createElement('div');
  visual.className = 'proj-card-visual';
  visual.appendChild(buildProjectVisual(p));

  const title   = currentLang === 'uz' ? p.title_uz : p.title_en;
  const summary = (currentLang === 'uz' ? p.summary_uz : p.summary_en) || '';

  const body = document.createElement('div');
  body.className = 'proj-card-body';
  body.innerHTML = `
    <div class="proj-card-cat">${escapeHtml((p.category || '').toUpperCase())}</div>
    <h3 class="proj-card-title">${escapeHtml(title)}</h3>
    <p class="proj-card-summary">${escapeHtml(summary)}</p>
    <div class="proj-card-tags">${(p.tech_tags || []).slice(0, 4).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>`;

  card.append(visual, body);
  const open = () => openProjectModal(p);
  card.addEventListener('click', open);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  observeReveal(card);
  return card;
}

function renderProjectFilters() {
  const wrap = document.getElementById('projFilters');
  if (!wrap) return;
  const categories = Array.from(new Set(gridProjectsAll.map(p => p.category).filter(Boolean)));

  const makeChip = (value, label) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'proj-filter-chip' + (gridCategory === value ? ' active' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => {
      gridCategory = value;
      gridVisibleCount = GRID_PAGE_SIZE;
      renderProjectFilters();
      renderGrid();
    });
    return chip;
  };

  wrap.innerHTML = '';
  wrap.appendChild(makeChip('all', t('filter_all')));
  categories.forEach(c => wrap.appendChild(makeChip(c, c)));
  // Single-category catalogs don't need a filter row at all.
  wrap.hidden = categories.length < 2;
}

function renderGrid() {
  const gridEl     = document.getElementById('projGrid');
  const loadMoreBtn = document.getElementById('projLoadMore');
  const emptyEl    = document.getElementById('projEmpty');
  if (!gridEl) return;

  const filtered = gridCategory === 'all'
    ? gridProjectsAll
    : gridProjectsAll.filter(p => p.category === gridCategory);

  gridEl.innerHTML = '';

  if (!filtered.length) {
    emptyEl.hidden = false;
    loadMoreBtn.hidden = true;
    return;
  }
  emptyEl.hidden = true;

  filtered.slice(0, gridVisibleCount).forEach(p => gridEl.appendChild(buildProjectCard(p)));
  loadMoreBtn.hidden = gridVisibleCount >= filtered.length;
}

document.getElementById('projLoadMore')?.addEventListener('click', () => {
  gridVisibleCount += GRID_PAGE_SIZE;
  renderGrid();
});

function renderProjectsGrid(rows) {
  gridProjectsAll = rows;
  gridCategory = 'all';
  gridVisibleCount = GRID_PAGE_SIZE;
  renderProjectFilters();
  renderGrid();
}

onLangChange(() => { renderProjectFilters(); renderGrid(); });


/* ─── Hire-me flow ─── */
const hireModalEl = document.getElementById('hireModal');
const hireForm     = document.getElementById('hireForm');
let hireReferenceProject = null;

function openHireModal(refProject = null) {
  hireReferenceProject = refProject || null;
  const note = document.getElementById('hireRefNote');
  if (refProject) {
    const title = currentLang === 'uz' ? refProject.title_uz : refProject.title_en;
    note.textContent = `${t('hire_ref_lead')}: "${title}"`;
    note.hidden = false;
  } else {
    note.hidden = true;
  }
  openModal(hireModalEl);
}
document.getElementById('hireFab')?.addEventListener('click', () => openHireModal(null));
document.getElementById('hireModalClose')?.addEventListener('click', () => closeModal(hireModalEl));

// The floating CTA only appears once the visitor has scrolled past the hero.
const hireFabEl = document.getElementById('hireFab');
if (hireFabEl) {
  onScroll(() => hireFabEl.classList.toggle('visible', window.scrollY > window.innerHeight * 0.6));
}

if (hireForm) {
  const hBtn      = document.getElementById('hireBtn');
  const hBtnLabel = hBtn.querySelector('[data-i18n="hire_send"]');
  const hStatus   = document.getElementById('hireStatus');
  const hName     = document.getElementById('hireName');
  const hEmail    = document.getElementById('hireEmail');
  const hMessage  = document.getElementById('hireMessage');
  const hHoneypot = document.getElementById('hireCompany');

  function setHireStatus(text, kind) {
    hStatus.textContent = text || '';
    hStatus.classList.toggle('ok', kind === 'ok');
    hStatus.classList.toggle('error', kind === 'error');
  }

  function hireValidate() {
    let firstBad = null;
    const email = hEmail.value.trim();
    const checks = [
      [hName,    hName.value.trim().length >= 2,    'form_err_name'],
      [hEmail,   EMAIL_RE.test(email),               'form_err_email'],
      [hMessage, hMessage.value.trim().length >= 10, 'form_err_message'],
    ];
    for (const [el, ok, key] of checks) {
      fieldError(el, ok ? '' : t(key));
      if (!ok && !firstBad) firstBad = el;
    }
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  [hName, hEmail, hMessage].forEach(el => el.addEventListener('input', () => {
    if (el.classList.contains('invalid')) fieldError(el, '');
  }));

  hireForm.addEventListener('submit', async e => {
    e.preventDefault();

    // A bot filled the hidden field: act successful, send nothing.
    if (hHoneypot && hHoneypot.value.trim() !== '') {
      setHireStatus(t('hire_sent_msg'), 'ok');
      hireForm.reset();
      return;
    }
    if (!hireValidate()) return;

    const sb = getSupabaseClient();
    if (!sb) {
      setHireStatus(t('hire_error_msg'), 'error');
      return;
    }

    hBtn.disabled = true;
    hBtnLabel.textContent = t('form_sending');
    setHireStatus('', null);

    const payload = {
      type: 'hire',
      name: hName.value.trim(),
      email: hEmail.value.trim(),
      message: hMessage.value.trim(),
      project_type: document.getElementById('hireType').value || null,
      budget: document.getElementById('hireBudget').value || null,
      timeline: document.getElementById('hireTimeline').value || null,
      reference_project_id: hireReferenceProject ? hireReferenceProject.id : null,
    };

    // The DB insert is the durable record the admin inbox depends on — it
    // must succeed for the request to count as sent.
    const { error } = await sb.from('inquiries').insert(payload);

    if (error) {
      console.error('Hire request insert failed:', error.message);
      hBtnLabel.textContent = t('form_error');
      hBtn.classList.add('is-error');
      setHireStatus(t('hire_error_msg'), 'error');
      setTimeout(() => {
        hBtnLabel.textContent = t('hire_send');
        hBtn.classList.remove('is-error');
        hBtn.disabled = false;
      }, 4000);
      return;
    }

    // Best-effort notification on top of the durable DB row — a failure here
    // is not shown as an error, same non-fatal pattern as the contact form.
    if (emailjsReady || initEmailJS()) {
      const refLine = hireReferenceProject ? `\nReference project: ${hireReferenceProject.title_en}` : '';
      emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
        from_name:  payload.name,
        from_email: payload.email,
        reply_to:   payload.email,
        message:    `[HIRE REQUEST]\nProject type: ${payload.project_type || '-'}\nBudget: ${payload.budget || '-'}\nTimeline: ${payload.timeline || '-'}${refLine}\n\n${payload.message}`,
      }).catch(err => console.error('Hire notification email failed:', err && (err.text || err.message || err)));
    }

    hBtnLabel.textContent = t('hire_sent');
    hBtn.classList.add('is-ok');
    setHireStatus(t('hire_sent_msg'), 'ok');
    hireForm.reset();
    setTimeout(() => {
      hBtnLabel.textContent = t('hire_send');
      hBtn.classList.remove('is-ok');
      hBtn.disabled = false;
      closeModal(hireModalEl);
    }, 1800);
  });
}


/* ─── Load projects + skills from Supabase ─── */
async function initDynamicContent() {
  const sb = getSupabaseClient();
  if (!sb) {
    console.error('Supabase unavailable — skills and portfolio will not load.');
    return;
  }

  const [skillsRes, projectsRes] = await Promise.all([
    sb.from('skills').select('*').order('sort_order'),
    sb.from('projects').select('*').eq('is_published', true).order('sort_order'),
  ]);

  if (skillsRes.error) console.error('Skills fetch failed:', skillsRes.error.message);
  else renderSkills(skillsRes.data);

  if (projectsRes.error) {
    console.error('Projects fetch failed:', projectsRes.error.message);
  } else {
    const featured = projectsRes.data.filter(p => p.featured);
    const others   = projectsRes.data.filter(p => !p.featured);
    renderFeaturedProjects(featured);
    renderProjectsGrid(others);
  }

  // Populate any [data-i18n] elements created just now (e.g. the ps-link
  // labels built above) — applyLang() is an idempotent full-DOM rescan.
  applyLang(currentLang);
}


/* ─── Contact Form ─── */
const contactForm = document.getElementById('contactForm');

if (contactForm) {
  const btn        = document.getElementById('ctBtn');
  const btnLabel   = btn.querySelector('[data-i18n="form_send"]');
  const statusEl   = document.getElementById('ctStatus');
  const fallbackEl = document.getElementById('ctFallback');
  const mailtoEl   = document.getElementById('ctMailto');
  const nameEl     = document.getElementById('name');
  const emailEl    = document.getElementById('email');
  const messageEl  = document.getElementById('message');
  const honeypot   = document.getElementById('company');

  function setStatus(text, kind) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('ok',    kind === 'ok');
    statusEl.classList.toggle('error', kind === 'error');
  }

  function validate() {
    let firstBad = null;
    const email = emailEl.value.trim();
    const checks = [
      [nameEl,    nameEl.value.trim().length >= 2,             'form_err_name'],
      // Email is optional — but if one is typed it still has to be usable,
      // otherwise a reply would silently bounce.
      [emailEl,   email === '' || EMAIL_RE.test(email),        'form_err_email'],
      [messageEl, messageEl.value.trim().length >= 10,         'form_err_message'],
    ];
    for (const [el, ok, key] of checks) {
      fieldError(el, ok ? '' : t(key));
      if (!ok && !firstBad) firstBad = el;
    }
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  // Clear a field's error as soon as the visitor starts fixing it.
  [nameEl, emailEl, messageEl].forEach(el =>
    el.addEventListener('input', () => {
      if (el.classList.contains('invalid')) fieldError(el, '');
    }));

  function showFallback() {
    const who   = nameEl.value.trim();
    const email = emailEl.value.trim();
    const subject = `Portfolio message from ${who || 'a visitor'}`;
    const signoff = email ? `${who} (${email})` : who;   // no empty "( )" tail
    const body    = `${messageEl.value.trim()}\n\n— ${signoff}`;
    mailtoEl.href = `mailto:${OWNER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    fallbackEl.hidden = false;
  }

  function resetButton(originalLabel) {
    setTimeout(() => {
      btnLabel.textContent = originalLabel;
      btn.classList.remove('is-ok', 'is-error');
      btn.disabled = false;
    }, 4000);
  }

  contactForm.addEventListener('submit', async e => {
    e.preventDefault();

    // A bot filled the hidden field: act successful, send nothing.
    if (honeypot && honeypot.value.trim() !== '') {
      setStatus(t('form_sent_msg'), 'ok');
      contactForm.reset();
      return;
    }

    if (!validate()) {
      setStatus('', null);
      return;
    }

    const originalLabel = t('form_send');
    btn.disabled = true;
    btn.classList.remove('is-ok', 'is-error');
    btnLabel.textContent = t('form_sending');
    setStatus('', null);
    fallbackEl.hidden = true;

    if (!emailjsReady && !initEmailJS()) {
      btnLabel.textContent = t('form_error');
      btn.classList.add('is-error');
      setStatus(t('form_error_msg'), 'error');
      showFallback();
      resetButton(originalLabel);
      return;
    }

    const senderEmail = emailEl.value.trim();

    // Best-effort: also keep a durable copy in the admin inbox, alongside
    // the email notification below. Never blocks or affects the form's
    // existing success/error UX, which is proven and stays EmailJS-driven.
    const sb = getSupabaseClient();
    sb?.from('inquiries').insert({
      type: 'contact',
      name: nameEl.value.trim(),
      email: senderEmail || null,
      message: messageEl.value.trim(),
    }).then(({ error }) => { if (error) console.error('Inquiry insert failed:', error.message); });

    try {
      await emailjs.send(EJS_SERVICE, EJS_TEMPLATE, {
        from_name:  nameEl.value.trim(),
        // Shown in the received mail. English on purpose: it lands in the
        // owner's inbox, whose template language does not follow the visitor's.
        from_email: senderEmail || '(no email provided)',
        // Never send an empty reply_to — EmailJS rejects a blank Reply-To
        // address. Falling back to the owner keeps the send valid; hitting
        // Reply then simply goes nowhere new, which is the honest outcome
        // when the visitor chose not to leave an address.
        reply_to:   senderEmail || OWNER_EMAIL,
        message:    messageEl.value.trim(),
      });

      btnLabel.textContent = t('form_sent');
      btn.classList.add('is-ok');
      setStatus(t('form_sent_msg'), 'ok');
      contactForm.reset();
      resetButton(originalLabel);

    } catch (err) {
      // `err` is EmailJS's {status, text}, not an Error instance.
      console.error('EmailJS send failed:', err && (err.text || err.message || err));
      btnLabel.textContent = t('form_error');
      btn.classList.add('is-error');
      setStatus(t('form_error_msg'), 'error');
      showFallback();   // the visitor's message is never lost
      resetButton(originalLabel);
    }
  });
}


/* ─── Boot ─── */
function boot() {
  document.body.classList.add('page-loaded');
  applyLang(currentLang);
  updateNav();
  initDynamicContent();   // async, fire-and-forget — static UI never waits on it
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
