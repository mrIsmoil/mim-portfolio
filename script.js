/* ============================================
   MIM — Muhammad Ismoil | Portfolio Scripts
   ============================================ */

// ─── Custom Cursor ───
const cursor = document.getElementById('cursor');
const cursorFollower = document.getElementById('cursorFollower');
let mouseX = 0, mouseY = 0;
let followerX = 0, followerY = 0;

document.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  cursor.style.left = mouseX + 'px';
  cursor.style.top  = mouseY + 'px';
});

function animateFollower() {
  followerX += (mouseX - followerX) * 0.12;
  followerY += (mouseY - followerY) * 0.12;
  cursorFollower.style.left = followerX + 'px';
  cursorFollower.style.top  = followerY + 'px';
  requestAnimationFrame(animateFollower);
}
animateFollower();

document.querySelectorAll('a, button, .tool-bubble, .tag, .filter-btn, input, textarea').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.classList.add('hovering');
    cursorFollower.classList.add('hovering');
  });
  el.addEventListener('mouseleave', () => {
    cursor.classList.remove('hovering');
    cursorFollower.classList.remove('hovering');
  });
});

// ─── Navbar scroll ───
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
  updateActiveNav();
});

function updateActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-link');
  let current = '';
  sections.forEach(section => {
    if (window.scrollY >= section.offsetTop - 120) {
      current = section.getAttribute('id');
    }
  });
  links.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) {
      link.classList.add('active');
    }
  });
}

// ─── Mobile nav toggle ───
const navToggle = document.getElementById('navToggle');
const mobMenu   = document.getElementById('mobMenu');

function closeMobMenu() {
  navToggle.classList.remove('open');
  mobMenu.classList.remove('open');
  document.body.style.overflow = '';
}

navToggle.addEventListener('click', () => {
  const isOpen = mobMenu.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

// Close on mob-link click
document.querySelectorAll('.mob-link').forEach(link => {
  link.addEventListener('click', closeMobMenu);
});

// ─── Smooth scroll for all anchor links ───
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});


// ─── Topographic Line Art — Smooth Contours + Cursor Interaction ───
const canvas = document.getElementById('bgCanvas');
const ctx    = canvas.getContext('2d');

// Reduce complexity on mobile/touch devices for performance
const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches ||
                  ('ontouchstart' in window);
let topoTime = 0;
const CELL   = IS_MOBILE ? 44 : 26;
const LEVELS = IS_MOBILE ? 6  : 14;

let topoMX = -9999, topoMY = -9999;
let bumpAmt = 0;
let bumpVel = 0;

window.addEventListener('mousemove', e => {
  if (IS_MOBILE) return;
  topoMX = e.clientX;
  topoMY = e.clientY;
  bumpVel = 0.09;
});

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function topoNoise(nx, ny) {
  const base = (
    Math.sin(nx * 1.3 + topoTime * 0.22) * Math.cos(ny * 1.0 - topoTime * 0.17) +
    Math.sin(nx * 2.4 - ny * 0.6 + topoTime * 0.14) * 0.55 +
    Math.cos(nx * 0.5 + ny * 1.9 - topoTime * 0.20) * 0.45 +
    Math.sin(nx * 0.4 - ny * 0.5 + topoTime * 0.09) * 0.30
  ) / 2.3;
  if (bumpAmt > 0.02 && topoMX >= 0) {
    const cx = (topoMX / canvas.width)  * 5.5;
    const cy = (topoMY / canvas.height) * 5.5;
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
  const f = (a, b) => b !== a ? Math.max(0, Math.min(1, (thr - a) / (b - a))) : 0.5;
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
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
  }
}

function drawTopo() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  bumpAmt += bumpVel;
  bumpVel  = bumpVel * 0.65 - bumpAmt * 0.06;
  if (Math.abs(bumpAmt) < 0.001 && Math.abs(bumpVel) < 0.001) { bumpAmt = 0; bumpVel = 0; }

  const cols = Math.ceil(canvas.width  / CELL) + 1;
  const rows = Math.ceil(canvas.height / CELL) + 1;
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
        const vTL = grid[r][c],     vTR = grid[r][c + 1];
        const vBR = grid[r+1][c+1], vBL = grid[r+1][c];
        const st  = ((vTL>thr)?8:0)|((vTR>thr)?4:0)|((vBR>thr)?2:0)|((vBL>thr)?1:0);
        for (const [ea, eb] of SEG[st]) {
          segs.push([
            edgePt(ea, x, y, CELL, vTL, vTR, vBR, vBL, thr),
            edgePt(eb, x, y, CELL, vTL, vTR, vBR, vBL, thr)
          ]);
        }
      }
    }
    const chains  = buildChains(segs);
    const boost   = Math.min(bumpAmt * 0.5, 0.3);
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

  topoTime += 0.004;
  requestAnimationFrame(drawTopo);
}

drawTopo();

// ─── Profile card 3D tilt ───
const profileCard = document.getElementById('profileCard');
if (profileCard) {
  profileCard.parentElement.addEventListener('mousemove', e => {
    const rect   = profileCard.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top  + rect.height / 2;
    const rotY = ((e.clientX - centerX) / (rect.width  / 2)) * 15;
    const rotX = ((e.clientY - centerY) / (rect.height / 2)) * -15;
    profileCard.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
  });
  profileCard.parentElement.addEventListener('mouseleave', () => {
    profileCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
  });
}

// ─── Hero cube — mouse parallax ───
const avatar3d = document.getElementById('avatar3d');
document.addEventListener('mousemove', e => {
  if (!avatar3d) return;
  const rx = ((e.clientY / window.innerHeight) - 0.5) * 20;
  const ry = ((e.clientX / window.innerWidth)  - 0.5) * 20;
  avatar3d.querySelector('.avatar-inner').style.animationPlayState = 'paused';
  avatar3d.querySelector('.avatar-inner').style.transform =
    `rotateX(${10 + rx}deg) rotateY(${ry}deg)`;
});
document.addEventListener('mouseleave', () => {
  if (!avatar3d) return;
  avatar3d.querySelector('.avatar-inner').style.animationPlayState = 'running';
});

// ─── Scroll Reveal ───
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.project-card, .channel-card, .skill-category, .stat-card, .about-text, .about-card-3d, .contact-text, .contact-form, .section-header').forEach((el, i) => {
  el.classList.add('reveal');
  if (i % 2 === 1) el.classList.add('reveal-delay-1');
  if (i % 3 === 2) el.classList.add('reveal-delay-2');
  revealObserver.observe(el);
});

// ─── Skill bars animate on scroll ───
const skillFills = document.querySelectorAll('.skill-fill');
const skillObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const target = entry.target.getAttribute('data-width');
      entry.target.style.width = target + '%';
      skillObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
skillFills.forEach(fill => skillObserver.observe(fill));

// ─── Portfolio filter ───
const filterBtns  = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.getAttribute('data-filter');
    projectCards.forEach(card => {
      if (filter === 'all' || card.getAttribute('data-category') === filter) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });
  });
});

// ─── Contact Form ───
// ─── EmailJS init ───
// Keys: emailjs.com dan olingan (to'ldiring)
const EJS_SERVICE  = 'service_b317zyh';
const EJS_TEMPLATE = 'template_3w4hisk';
const EJS_KEY      = 'ClVyIQU-leRs4bEwP';

emailjs.init(EJS_KEY);

const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('.ct-btn');
    const originalText = btn.textContent;

    btn.textContent = 'Sending...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    const params = {
      from_name:  contactForm.querySelector('#name').value,
      from_email: contactForm.querySelector('#email').value,
      message:    contactForm.querySelector('#message').value,
    };

    try {
      await emailjs.send(EJS_SERVICE, EJS_TEMPLATE, params);

      btn.textContent = 'Message Sent ✓';
      btn.style.background = 'rgba(74,222,128,0.15)';
      btn.style.color = '#4ade80';
      btn.style.opacity = '1';
      contactForm.reset();
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
        btn.disabled = false;
      }, 4000);

    } catch (err) {
      console.error('EmailJS error:', err);
      btn.textContent = 'Error — try again';
      btn.style.background = 'rgba(255,60,60,0.12)';
      btn.style.color = 'rgba(255,100,100,0.9)';
      btn.style.opacity = '1';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
        btn.disabled = false;
      }, 3500);
    }
  });
}

// ─── i18n — bilingual EN / UZ ───
const translations = {
  en: {
    nav_about:           'About',
    nav_portfolio:       'Portfolio',
    nav_skills:          'Skills',
    nav_channels:        'Channels',
    nav_contact:         'Contact',
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
    filter_all:          'All',
    filter_web:          'Web',
    filter_app:          'App',
    filter_design:       'Design',
    proj1_title:         'Tonsor',
    proj1_desc:          'An exclusive digital platform connecting elite barbers with their clients — booking, profiles, and business tools in one place.',
    proj2_title:         "O'zbekiston",
    proj2_desc:          "An immersive web experience showcasing the history, culture, and regions of Uzbekistan — built with cinematic design.",
    proj3_title:         'MIM Logistic',
    proj3_desc:          'A professional website for logistics companies — clean design with tracking, routing, and service showcase features.',
    wip_tag:             'In Progress',
    proj4_title:         'Maison Aura',
    proj4_desc:          'A classic-style online boutique with luxury aesthetics — elegant product showcase, smooth UI, and refined shopping experience.',
    coming_soon:         'Coming Soon',
    link_live:           'Live →',
    link_code:           'Code →',
    link_ask:            'Ask me →',
    link_view:           'View →',
    skills_title:        'Skills',
    skill_frontend:      'Frontend',
    skill_backend:       'Backend',
    skill_tools:         'Tools',
    skill_languages:     'Languages',
    skill_db:            'Databases',
    lang_uz:             'Uzbek',
    lang_en:             'English',
    lang_ru:             'Russian',
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
    form_message:        'Message',
    form_message_ph:     'Tell me about your project...',
    form_send:           'Send Message →',
    footer_brand:        'Muhammad Ismoil — Building the future, one project at a time.',
    footer_nav:          'Navigation',
    footer_social:       'Social',
    footer_copy:         '© 2026 Muhammad Ismoil — MIM. All rights reserved.',
    footer_made:         'Made in Uzbekistan',
  },
  uz: {
    nav_about:           'Haqimda',
    nav_portfolio:       'Portfolio',
    nav_skills:          "Ko'nikmalar",
    nav_channels:        'Kanallar',
    nav_contact:         'Aloqa',
    hero_badge:          'Imkoniyatlarga tayyor',
    hero_tagline:        'Full Stack Dasturchi',
    hero_btn1:           'Ishlarimni ko\'ring',
    hero_btn2:           'Bog\'laning',
    about_title:         'Men haqimda',
    about_lead:          "Kokand, O'zbekistonlik 17 yoshli dasturchi va ijodkorman, foydali va mazmunli loyihalar yaratishga katta qiziqishim bor.",
    about_p1:            "Men <strong>Target International School</strong>'da o'qiyman va u yerda akademik bilimlarni texnologiya hamda amaliy dasturlash bilan uyg'unlashtiraman. Men \"o'rganish — bu yaratish orqali bo'ladi\" degan tamoyilga ishonaman va har bir loyiha orqali o'zimni rivojlantirib boraman.",
    about_p2:            "Bo'sh vaqtlarimda yangi g'oyalarni o'rganaman, ijodiy loyihalar ustida ishlayman va dasturchi sifatida o'sish uchun doim o'zimni sinovdan o'tkazaman.",
    stat_age:            'Yosh',
    stat_projects:       'Loyihalar',
    stat_ideas:          "G'oyalar",
    card_role:           'Dasturchi va Ijodkor',
    portfolio_title:     'Portfolio',
    filter_all:          'Barchasi',
    filter_web:          'Web',
    filter_app:          'Ilova',
    filter_design:       'Dizayn',
    proj1_title:         'Tonsor',
    proj1_desc:          "Sartaroshlar va ularning mijozlarini bog'lovchi eksklyuziv raqamli platforma — bron qilish, profil va biznes vositalari bir joyda.",
    proj2_title:         "O'zbekiston",
    proj2_desc:          "O'zbekistonning tarixi, madaniyati va hududlarini kinematografik dizayn bilan taqdim etuvchi veb-tajriba.",
    proj3_title:         'MIM Logistic',
    wip_tag:             'Jarayonda',
    proj3_desc:          "Logistika kompaniyalari uchun professional veb-sayt — yuk kuzatish, marshrutlash va xizmatlarni namoyish qilish.",
    proj4_title:         'Maison Aura',
    proj4_desc:          "Klassik uslubdagi onlayn butik — elegantlik, silliq interfeys va professional xarid tajribasi.",
    coming_soon:         'Tez Orada',
    link_live:           'Ko\'rish →',
    link_code:           'Kod →',
    link_ask:            'So\'rang →',
    link_view:           'Ko\'rish →',
    skills_title:        "Ko'nikmalar",
    skill_frontend:      'Frontend',
    skill_backend:       'Backend',
    skill_tools:         'Asboblar',
    skill_languages:     'Tillar',
    skill_db:            "Ma'lumotlar bazasi",
    lang_uz:             "O'zbek",
    lang_en:             'Ingliz',
    lang_ru:             'Rus',
    channels_title:      'Kanallar',
    channels_lead:       "Meni internetda toping. Kontent, yangiliklar va sahna ortidan xabardor bo'lib turing.",
    contact_title:       'Aloqa',
    contact_h3:          'Keling, birgalikda biror narsa qurайик.',
    contact_p:           "Loyihangiz bormi? Hamkorlik qilmoqchimisiz? Yoki shunchaki salom demoqchimisiz? Mening pochtam doim ochiq.",
    contact_loc_label:   'Manzil',
    contact_loc_val:     'Kokand, O\'zbekiston',
    contact_school_label:'Maktab',
    contact_status_label:'Holat',
    contact_status_val:  'Loyihalarga tayyor',
    form_name:           'Ism',
    form_name_ph:        'Ismingiz',
    form_email:          'Elektron pochta',
    form_message:        'Xabar',
    form_message_ph:     'Loyihangiz haqida yozing...',
    form_send:           'Xabar yuborish →',
    footer_brand:        "Muhammad Ismoil — Kelajakni qurmoqdaman, bir loyiha biridan.",
    footer_nav:          'Navigatsiya',
    footer_social:       'Ijtimoiy',
    footer_copy:         "© 2026 Muhammad Ismoil — MIM. Barcha huquqlar himoyalangan.",
    footer_made:         "O'zbekistonda yaratildi",
  }
};

let currentLang = localStorage.getItem('mim-lang') || 'en';

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('mim-lang', lang);
  const t = translations[lang];

  // text nodes
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.innerHTML = t[key];
  });

  // placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (t[key] !== undefined) el.setAttribute('placeholder', t[key]);
  });

  // toggle button active state
  document.getElementById('langEN').classList.toggle('lang-active', lang === 'en');
  document.getElementById('langUZ').classList.toggle('lang-active', lang === 'uz');

  document.documentElement.lang = lang === 'uz' ? 'uz' : 'en';
}

document.getElementById('langToggle').addEventListener('click', () => {
  applyLang(currentLang === 'en' ? 'uz' : 'en');
});

// ─── Page load animation ───
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('page-loaded');
  applyLang(currentLang);
});

// ─── Portfolio full-page scroll ───
const portfolioWrapper = document.getElementById('portfolioWrapper');
const portfolioStage   = document.getElementById('portfolioStage');
const portfolioSlides  = document.querySelectorAll('.portfolio-slide');
const portfolioDots    = document.querySelectorAll('.pdot');
let currentSlide = 0;
let pfLocked     = false;
let pfWasInside  = false;

function pfWrapperTop() {
  return portfolioWrapper.getBoundingClientRect().top + window.scrollY;
}
function inPortfolio() {
  const top = pfWrapperTop();
  const y   = window.scrollY;
  const ih  = window.innerHeight;
  return y + 4 >= top && y + ih - 4 <= top + portfolioWrapper.offsetHeight;
}
function goToSlide(index) {
  if (index === currentSlide) return;
  portfolioSlides[currentSlide].classList.remove('active');
  portfolioSlides[currentSlide].classList.add('exited');
  portfolioSlides[index].classList.remove('exited');
  portfolioSlides[index].classList.add('active');
  portfolioDots.forEach((d, i) => d.classList.toggle('active', i === index));
  currentSlide = index;
}
function pfSnapTo(index) {
  window.scrollTo({ top: pfWrapperTop() + index * window.innerHeight, behavior: 'instant' });
}

if (IS_MOBILE) {
  // ── MOBILE PORTFOLIO ──
  // On iOS sticky+scroll = unreliable. Solution:
  // wrapper = 1 screen, stage = position:relative (no sticky).
  // Page scrolls normally. Slides change via swipe on the stage.
  const ih = window.innerHeight;
  portfolioWrapper.style.height    = ih + 'px';
  portfolioStage.style.position    = 'relative';
  portfolioStage.style.top         = 'auto';
  portfolioStage.style.height      = ih + 'px';

  window.addEventListener('resize', () => {
    const nih = window.innerHeight;
    portfolioWrapper.style.height = nih + 'px';
    portfolioStage.style.height   = nih + 'px';
  }, { passive: true });

  let _pfTY = null;

  portfolioStage.addEventListener('touchstart', e => {
    _pfTY = e.touches[0].clientY;
  }, { passive: true });

  portfolioStage.addEventListener('touchmove', e => {
    e.preventDefault(); // block page scroll while on stage
  }, { passive: false });

  portfolioStage.addEventListener('touchend', e => {
    if (_pfTY === null) return;
    const diff = _pfTY - e.changedTouches[0].clientY;
    _pfTY = null;
    if (Math.abs(diff) < 35 || pfLocked) return;
    const max = portfolioSlides.length - 1;
    if (diff < 0 && currentSlide === 0)  return;
    if (diff > 0 && currentSlide === max) return;
    pfLocked = true;
    goToSlide(diff > 0 ? currentSlide + 1 : currentSlide - 1);
    setTimeout(() => { pfLocked = false; }, 650);
  }, { passive: true });

} else {
  // ── DESKTOP: sticky scroll-lock with wheel ──
  window.addEventListener('scroll', () => {
    if (!inPortfolio()) pfWasInside = false;
  }, { passive: true });

  window.addEventListener('wheel', (e) => {
    if (!inPortfolio()) return;
    if (!pfWasInside) {
      pfWasInside = true; pfLocked = true; e.preventDefault();
      setTimeout(() => { pfLocked = false; }, 600);
      return;
    }
    const max = portfolioSlides.length - 1;
    if (e.deltaY < 0 && currentSlide === 0)  return;
    if (e.deltaY > 0 && currentSlide === max) return;
    e.preventDefault();
    if (pfLocked) return;
    pfLocked = true;
    const next = e.deltaY > 0 ? currentSlide + 1 : currentSlide - 1;
    goToSlide(next);
    pfSnapTo(next);
    setTimeout(() => { pfLocked = false; }, 1000);
  }, { passive: false });
}

// Dot clicks
portfolioDots.forEach((dot, i) => {
  dot.addEventListener('click', () => {
    goToSlide(i);
    window.scrollTo({ top: pfWrapperTop() + i * window.innerHeight, behavior: IS_MOBILE ? 'instant' : 'smooth' });
  });
});

// ─── Skills radial scroll ───
const SKILLS = [
  { cat:{en:'Frontend',  uz:'Frontend'},  name:'HTML / CSS',   pct:80,
    note:{en:'Semantic markup, responsive layouts, CSS animations, Grid & Flexbox.',
          uz:'Semantik belgilash, moslashuvchan layout, CSS animatsiyalar.'} },
  { cat:{en:'Frontend',  uz:'Frontend'},  name:'JavaScript',   pct:40,
    note:{en:'ES6+, DOM manipulation, async/await and modern JS patterns.',
          uz:'ES6+, DOM boshqaruvi, async/await va zamonaviy JS usullari.'} },
  { cat:{en:'Frontend',  uz:'Frontend'},  name:'React',        pct:10,
    note:{en:'Component architecture, hooks, state management & routing.',
          uz:'Komponent arxitekturasi, hooklar va holat boshqaruvi.'} },
  { cat:{en:'Backend',   uz:'Backend'},   name:'Python',       pct:50,
    note:{en:'Scripting, automation, data processing and backend development.',
          uz:'Skriptlar, avtomatlashtirish va backend dasturlash.'} },
  { cat:{en:'Backend',   uz:'Backend'},   name:'Django',       pct:90,
    note:{en:'Full-stack web framework — models, views, templates, REST APIs.',
          uz:"To'liq stekli freymvork — modellar, ko'rinishlar, REST API."} },
  { cat:{en:'Tools',     uz:'Asboblar'},  name:'Git / GitHub', pct:65,
    note:{en:'Version control, branching, CI/CD workflows and pull requests.',
          uz:'Versiya nazorati, tarmoqlash, CI/CD va pull requestlar.'} },
  { cat:{en:'Languages', uz:'Tillar'},    name:'English',      pct:90,
    note:{en:'Fluent in reading, writing, and speaking — primary working language.',
          uz:"O'qish, yozish va gaplashishda ravon — asosiy ish tili."} },
  { cat:{en:'Languages', uz:'Tillar'},    name:'Russian',      pct:10,
    note:{en:'Basic understanding — can follow simple conversations.',
          uz:"Boshlang'ich daraja — oddiy suhbatlarni tushuna olaman."} },
  { cat:{en:'Languages', uz:'Tillar'},    name:'French',       pct:10,
    note:{en:'Beginner level — learning the fundamentals.',
          uz:"Boshlang'ich daraja — asoslarni o'rganmoqdaman."} },
  { cat:{en:'Hobby',     uz:'Qiziqish'},  name:'Chess',        pct:50,
    note:{en:'Strategic thinking, pattern recognition and competitive play.',
          uz:"Strategik fikrlash, naqshlarni tanish va musobaqa o'yinlari."} },
];

const skWrapper  = document.getElementById('skillsWrapper');
const skStage    = document.getElementById('skillsStage');
const skArcWrap  = document.getElementById('ssArcWrap');
const skSlidesEl = document.getElementById('ssSlides');

if (skWrapper && skStage && skArcWrap && skSlidesEl) {
  // Set wrapper height
  skWrapper.style.height = SKILLS.length * 100 + 'vh';

  // Build slides
  SKILLS.forEach((sk, i) => {
    const lang = currentLang;
    const slide = document.createElement('div');
    slide.className = 'ss-slide' + (i === 0 ? ' active' : '');
    slide.setAttribute('data-index', i);
    slide.innerHTML = `
      <div class="ss-cat">${sk.cat[lang]}</div>
      <h2 class="ss-name">${sk.name}</h2>
      <div class="ss-bar-row">
        <div class="ss-bar"><div class="ss-fill" style="--w:${sk.pct}%"></div></div>
        <span class="ss-pct">${sk.pct}%</span>
      </div>
      <p class="ss-note">${sk.note[lang]}</p>`;
    skSlidesEl.appendChild(slide);
  });

  // Mobile dot navigation for skills
  if (IS_MOBILE) {
    const mobileDots = document.createElement('div');
    mobileDots.className = 'ss-mobile-dots';
    SKILLS.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'ss-mdot' + (i === 0 ? ' active' : '');
      d.setAttribute('data-index', i);
      d.addEventListener('click', () => {
        skGoTo(i);
        window.scrollTo({ top: skWrapTop() + i * window.innerHeight, behavior: 'smooth' });
      });
      mobileDots.appendChild(d);
    });
    skStage.appendChild(mobileDots);
  }

  // Build arc numbers + dot
  const arcSvg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  arcSvg.setAttribute('class','ss-arc-svg');
  const arcPath = document.createElementNS('http://www.w3.org/2000/svg','path');
  arcPath.setAttribute('stroke','rgba(255,255,255,0.1)');
  arcPath.setAttribute('stroke-width','1');
  arcPath.setAttribute('fill','none');
  arcSvg.appendChild(arcPath);
  skArcWrap.appendChild(arcSvg);

  SKILLS.forEach((_, i) => {
    const el = document.createElement('div');
    el.className = 'ss-arc-num';
    el.setAttribute('data-index', i);
    el.textContent = String(i + 1).padStart(2, '0');
    el.addEventListener('click', () => {
      skGoTo(i);
      window.scrollTo({ top: skWrapTop() + i * window.innerHeight, behavior: 'smooth' });
    });
    skArcWrap.appendChild(el);
  });

  const arcDot = document.createElement('div');
  arcDot.className = 'ss-arc-dot';
  skArcWrap.appendChild(arcDot);

  // ── Arc geometry ──
  const R  = 540;    // circle radius
  const CX = -95;    // circle center X (in arc-wrap coords)

  function arcPoint(relStep) {
    const deg = relStep * 30;
    const rad = deg * Math.PI / 180;
    const stageH = skStage.offsetHeight || window.innerHeight;
    const cy = stageH * 0.5;
    return {
      x: CX + R * Math.cos(rad),
      y: cy + R * Math.sin(rad),
    };
  }

  function updateArc(active) {
    const nums = skArcWrap.querySelectorAll('.ss-arc-num');
    const stageH = skStage.offsetHeight || window.innerHeight;

    // Keep SVG coordinate system in sync with actual pixel dimensions
    arcSvg.setAttribute('viewBox', `0 0 480 ${stageH}`);

    // SVG arc path — draw portion of circle from first to last visible item
    const startRel = 0 - active;
    const endRel   = (SKILLS.length - 1) - active;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const visStart = clamp(startRel, -5, 5);
    const visEnd   = clamp(endRel,   -5, 5);
    const p0 = arcPoint(visStart);
    const p1 = arcPoint(visEnd);
    const sweepDir  = visEnd > visStart ? 1 : 0;
    const angleDiff = Math.abs(visEnd - visStart) * 30;
    const largeArc  = angleDiff > 180 ? 1 : 0;
    arcPath.setAttribute('d',
      `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${largeArc} ${sweepDir} ${p1.x} ${p1.y}`);

    nums.forEach((el, i) => {
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

    // dot follows active item
    const { x: dx, y: dy } = arcPoint(0);
    arcDot.style.left = (dx + 22) + 'px';
    arcDot.style.top  = dy + 'px';
  }

  // ── Slide switching ──
  const skSlides = skSlidesEl.querySelectorAll('.ss-slide');
  let skCurrent = 0;
  let skLocked  = false;
  let skWasIn   = false;

  function skWrapTop() {
    return skWrapper.getBoundingClientRect().top + window.scrollY;
  }
  function inSkills() {
    const top = skWrapTop();
    const y   = window.scrollY;
    const ih  = window.innerHeight;
    return y + 4 >= top && y + ih - 4 <= top + skWrapper.offsetHeight;
  }
  function skGoTo(idx) {
    if (idx === skCurrent) return;
    skSlides[skCurrent].classList.remove('active');
    skSlides[skCurrent].classList.add('exited');
    skSlides[idx].classList.remove('exited');
    skSlides[idx].classList.add('active');
    skCurrent = idx;
    if (!IS_MOBILE) updateArc(idx);
    skStage.querySelectorAll('.ss-mdot').forEach((d, i) =>
      d.classList.toggle('active', i === idx));
  }

  if (!IS_MOBILE) updateArc(0);

  if (IS_MOBILE) {
    // ── MOBILE SKILLS ── same pattern as portfolio
    const sih = window.innerHeight;
    skWrapper.style.height  = sih + 'px';
    skStage.style.position  = 'relative';
    skStage.style.top       = 'auto';
    skStage.style.height    = sih + 'px';

    window.addEventListener('resize', () => {
      const nih = window.innerHeight;
      skWrapper.style.height = nih + 'px';
      skStage.style.height   = nih + 'px';
    }, { passive: true });

    let _skTY = null;

    skStage.addEventListener('touchstart', e => {
      _skTY = e.touches[0].clientY;
    }, { passive: true });

    skStage.addEventListener('touchmove', e => {
      e.preventDefault();
    }, { passive: false });

    skStage.addEventListener('touchend', e => {
      if (_skTY === null) return;
      const diff = _skTY - e.changedTouches[0].clientY;
      _skTY = null;
      if (Math.abs(diff) < 35 || skLocked) return;
      const max = SKILLS.length - 1;
      if (diff < 0 && skCurrent === 0)  return;
      if (diff > 0 && skCurrent === max) return;
      skLocked = true;
      skGoTo(diff > 0 ? skCurrent + 1 : skCurrent - 1);
      setTimeout(() => { skLocked = false; }, 650);
    }, { passive: true });

  } else {
    // ── DESKTOP: sticky scroll-lock with wheel ──
    window.addEventListener('scroll', () => {
      if (!inSkills()) skWasIn = false;
    }, { passive: true });

    window.addEventListener('wheel', (e) => {
      if (!inSkills()) return;
      if (!skWasIn) {
        skWasIn = true; skLocked = true; e.preventDefault();
        setTimeout(() => { skLocked = false; }, 600);
        return;
      }
      const max = SKILLS.length - 1;
      if (e.deltaY < 0 && skCurrent === 0)  return;
      if (e.deltaY > 0 && skCurrent === max) return;
      e.preventDefault();
      if (skLocked) return;
      skLocked = true;
      const next = e.deltaY > 0 ? skCurrent + 1 : skCurrent - 1;
      skGoTo(next);
      window.scrollTo({ top: skWrapTop() + next * window.innerHeight, behavior: 'instant' });
      setTimeout(() => { skLocked = false; }, 1000);
    }, { passive: false });
  }

  // Re-render on language change
  const _origApplyLang = applyLang;
  applyLang = function(lang) {
    _origApplyLang(lang);
    skSlides.forEach((slide, i) => {
      slide.querySelector('.ss-cat').textContent  = SKILLS[i].cat[lang];
      slide.querySelector('.ss-note').textContent = SKILLS[i].note[lang];
    });
  };
}

// ─── Year in footer ───
const yearEl = document.querySelector('.footer-bottom span:first-child');
if (yearEl) {
  yearEl.textContent = yearEl.textContent.replace('2026', new Date().getFullYear());
}
