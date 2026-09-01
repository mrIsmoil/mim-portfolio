/* ============================================
   MIM Admin — dashboard logic
   Vanilla JS, no build step, same conventions as the public site's script.js.
   ============================================ */

'use strict';

const SUPABASE_URL = 'https://kbdagyzgyufbpvtsubhh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_A5EJdvR7OxKfkLf0wpsu1g_3bvX0kbN';

function getSupabaseClient() {
  if (typeof supabase === 'undefined') return null;
  try { return supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY); }
  catch { return null; }
}
const sb = getSupabaseClient();

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// Declared early: applyLang() below runs immediately at boot and calls the
// render*Table() functions, which read these — they must already exist.
let projectsCache = [];
let skillsCache = [];
let inquiriesCache = [];
let inquiryFilter = 'all';


/* ─── i18n — the dashboard's own chrome/labels, bilingual EN/UZ.
   Deep form-field labels (Slug, Live URL, etc.) stay English — they're
   short technical nouns, and the only person who ever sees this panel
   already reads both languages fluently. ─── */
const translations = {
  en: {
    nav_projects: 'Projects', nav_skills: 'Skills', nav_inquiries: 'Inquiries', nav_settings: 'Settings',
    sign_in: 'Sign in', sign_out: 'Sign out', signing_in: 'Signing in…',
    login_error: 'Invalid email or password.',
    new_project: '+ New Project', new_skill: '+ New Skill',
    save: 'Save', delete: 'Delete', saving: 'Saving…', saved: 'Saved ✓',
    delete_confirm: 'Delete this item? This cannot be undone.',
    th_title: 'Title', th_category: 'Category', th_status: 'Status', th_name: 'Name', th_pct: '%',
    status_published: 'Published', status_draft: 'Draft', status_featured: 'Featured',
    filter_all: 'All', filter_hire: 'Hire', filter_contact: 'Contact',
    inbox_empty: 'No messages yet.', settings_saved: 'Settings saved ✓',
    table_empty: 'Nothing here yet — click "+ New" to add one.',
  },
  uz: {
    nav_projects: 'Loyihalar', nav_skills: "Ko'nikmalar", nav_inquiries: 'Xabarlar', nav_settings: 'Sozlamalar',
    sign_in: 'Kirish', sign_out: 'Chiqish', signing_in: 'Kirilmoqda…',
    login_error: "Email yoki parol noto'g'ri.",
    new_project: '+ Yangi loyiha', new_skill: '+ Yangi skill',
    save: 'Saqlash', delete: "O'chirish", saving: 'Saqlanmoqda…', saved: 'Saqlandi ✓',
    delete_confirm: "Bu elementni o'chirasizmi? Buni qaytarib bo'lmaydi.",
    th_title: 'Sarlavha', th_category: 'Kategoriya', th_status: 'Holat', th_name: 'Nomi', th_pct: '%',
    status_published: 'Chop etilgan', status_draft: 'Qoralama', status_featured: 'Tanlangan',
    filter_all: 'Hammasi', filter_hire: 'Buyurtma', filter_contact: 'Xabar',
    inbox_empty: "Hozircha xabar yo'q.", settings_saved: 'Sozlamalar saqlandi ✓',
    table_empty: 'Hali hech narsa yo\'q — qo\'shish uchun "+ Yangi" tugmasini bosing.',
  },
};

let currentLang = localStorage.getItem('mim-admin-lang') === 'uz' ? 'uz' : 'en';
function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || translations.en[key] || key;
}
function applyLang(lang) {
  currentLang = translations[lang] ? lang : 'en';
  try { localStorage.setItem('mim-admin-lang', currentLang); } catch { /* private mode */ }
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.getElementById('adminLangEN')?.classList.toggle('lang-active', currentLang === 'en');
  document.getElementById('adminLangUZ')?.classList.toggle('lang-active', currentLang === 'uz');
  renderProjectsTable();
  renderSkillsTable();
  renderInquiries();
}
document.getElementById('adminLangEN')?.addEventListener('click', () => applyLang('en'));
document.getElementById('adminLangUZ')?.addEventListener('click', () => applyLang('uz'));
applyLang(currentLang);


/* ─── Modal helpers (same pattern as the public site) ─── */
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
  if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(closeModal);
});


/* ─── Auth ─── */
const loginView   = document.getElementById('adminLogin');
const shellView   = document.getElementById('adminShell');
const loginForm   = document.getElementById('loginForm');
const loginBtn    = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');
let sessionActive = false;

async function refreshSession() {
  if (!sb) {
    loginStatus.textContent = 'Supabase unavailable.';
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  const wasActive = sessionActive;
  sessionActive = Boolean(session);
  loginView.hidden = sessionActive;
  shellView.hidden = !sessionActive;
  if (sessionActive && !wasActive) loadAllData();
}

loginForm?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!sb) { loginStatus.textContent = 'Supabase unavailable.'; return; }
  loginBtn.disabled = true;
  loginBtn.textContent = t('signing_in');
  loginStatus.textContent = '';
  loginStatus.classList.remove('error');

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });

  loginBtn.disabled = false;
  loginBtn.textContent = t('sign_in');
  if (error) {
    loginStatus.textContent = t('login_error');
    loginStatus.classList.add('error');
    return;
  }
  await refreshSession();
});

document.getElementById('signOutBtn')?.addEventListener('click', async () => {
  await sb?.auth.signOut();
  await refreshSession();
});

sb?.auth.onAuthStateChange(() => refreshSession());
refreshSession();


/* ─── View switching ─── */
document.querySelectorAll('.admin-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.admin-view').forEach(v => { v.hidden = true; });
    document.getElementById('view-' + btn.dataset.view).hidden = false;
  });
});


/* ─── Data loading ─── */
async function loadAllData() {
  await Promise.all([loadProjects(), loadSkills(), loadSettings()]);
  await loadInquiries();   // after projects, so reference-project lookups resolve
}


/* ─── Projects ─── */
async function loadProjects() {
  const { data, error } = await sb.from('projects').select('*').order('sort_order');
  if (error) { console.error('loadProjects:', error.message); return; }
  projectsCache = data;
  renderProjectsTable();
}

function renderProjectsTable() {
  const tbody = document.getElementById('projectsTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!projectsCache.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">${escapeHtml(t('table_empty'))}</td></tr>`;
    return;
  }
  projectsCache.forEach(p => {
    const statusParts = [p.is_published ? t('status_published') : t('status_draft')];
    if (p.featured) statusParts.push(t('status_featured'));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(p.title_en)}</td>
      <td>${escapeHtml(p.category || '—')}</td>
      <td>${escapeHtml(statusParts.join(' · '))}</td>
      <td><button type="button" class="admin-row-edit">✎</button></td>`;
    tr.querySelector('.admin-row-edit').addEventListener('click', () => openProjectForm(p));
    tbody.appendChild(tr);
  });
}

document.getElementById('newProjectBtn')?.addEventListener('click', () => openProjectForm(null));
document.getElementById('projectFormClose')?.addEventListener('click', () => closeModal(document.getElementById('projectFormModal')));

const projectFormModal = document.getElementById('projectFormModal');
const projectForm = document.getElementById('projectForm');
let editingProjectId = null;
let pendingCoverFile = null;

function openProjectForm(p) {
  editingProjectId = p ? p.id : null;
  pendingCoverFile = null;
  document.getElementById('projectFormTitle').textContent = p ? p.title_en : 'New Project';
  document.getElementById('pfSlug').value = p?.slug || '';
  document.getElementById('pfCategory').value = p?.category || '';
  document.getElementById('pfTitleEn').value = p?.title_en || '';
  document.getElementById('pfTitleUz').value = p?.title_uz || '';
  document.getElementById('pfSummaryEn').value = p?.summary_en || '';
  document.getElementById('pfSummaryUz').value = p?.summary_uz || '';
  document.getElementById('pfDescEn').value = p?.description_en || '';
  document.getElementById('pfDescUz').value = p?.description_uz || '';
  document.getElementById('pfLiveUrl').value = p?.live_url || '';
  document.getElementById('pfCodeUrl').value = p?.code_url || '';
  document.getElementById('pfTags').value = (p?.tech_tags || []).join(', ');
  document.getElementById('pfFeatured').checked = Boolean(p?.featured);
  document.getElementById('pfPublished').checked = Boolean(p?.is_published);
  document.getElementById('pfImageFile').value = '';
  const preview = document.getElementById('pfImagePreview');
  preview.innerHTML = p?.cover_image_url ? `<img src="${escapeHtml(p.cover_image_url)}" alt="" />` : '';
  document.getElementById('pfDeleteBtn').hidden = !p;
  document.getElementById('pfStatus').textContent = '';
  openModal(projectFormModal);
}

document.getElementById('pfImageFile')?.addEventListener('change', e => {
  pendingCoverFile = e.target.files[0] || null;
  const preview = document.getElementById('pfImagePreview');
  if (pendingCoverFile) preview.innerHTML = `<img src="${URL.createObjectURL(pendingCoverFile)}" alt="" />`;
});

projectForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const saveBtn = document.getElementById('pfSaveBtn');
  const statusEl = document.getElementById('pfStatus');
  saveBtn.disabled = true;
  statusEl.textContent = t('saving');

  let coverUrl = document.getElementById('pfImagePreview').querySelector('img')?.getAttribute('src') || null;
  // A freshly-picked file's preview is an in-memory blob: URL — only a
  // remote URL (an existing cover already uploaded) should pass through
  // untouched; a blob URL means an upload still has to happen below.
  if (coverUrl && coverUrl.startsWith('blob:')) coverUrl = null;

  if (pendingCoverFile) {
    const slug = document.getElementById('pfSlug').value.trim() || 'project';
    const ext = (pendingCoverFile.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${slug}-${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('project-images').upload(path, pendingCoverFile, { upsert: true });
    if (upErr) {
      statusEl.textContent = upErr.message;
      saveBtn.disabled = false;
      return;
    }
    coverUrl = sb.storage.from('project-images').getPublicUrl(path).data.publicUrl;
  }

  const payload = {
    slug: document.getElementById('pfSlug').value.trim(),
    category: document.getElementById('pfCategory').value.trim() || null,
    title_en: document.getElementById('pfTitleEn').value.trim(),
    title_uz: document.getElementById('pfTitleUz').value.trim(),
    summary_en: document.getElementById('pfSummaryEn').value.trim() || null,
    summary_uz: document.getElementById('pfSummaryUz').value.trim() || null,
    description_en: document.getElementById('pfDescEn').value.trim() || null,
    description_uz: document.getElementById('pfDescUz').value.trim() || null,
    live_url: document.getElementById('pfLiveUrl').value.trim() || null,
    code_url: document.getElementById('pfCodeUrl').value.trim() || null,
    tech_tags: document.getElementById('pfTags').value.split(',').map(s => s.trim()).filter(Boolean),
    featured: document.getElementById('pfFeatured').checked,
    is_published: document.getElementById('pfPublished').checked,
    cover_image_url: coverUrl,
  };

  const query = editingProjectId
    ? sb.from('projects').update(payload).eq('id', editingProjectId)
    : sb.from('projects').insert(payload);
  const { error } = await query;

  saveBtn.disabled = false;
  if (error) { statusEl.textContent = error.message; return; }
  statusEl.textContent = t('saved');
  await loadProjects();
  setTimeout(() => closeModal(projectFormModal), 600);
});

document.getElementById('pfDeleteBtn')?.addEventListener('click', async () => {
  if (!editingProjectId || !confirm(t('delete_confirm'))) return;
  const { error } = await sb.from('projects').delete().eq('id', editingProjectId);
  if (error) { document.getElementById('pfStatus').textContent = error.message; return; }
  await loadProjects();
  closeModal(projectFormModal);
});


/* ─── Skills ─── */
async function loadSkills() {
  const { data, error } = await sb.from('skills').select('*').order('sort_order');
  if (error) { console.error('loadSkills:', error.message); return; }
  skillsCache = data;
  renderSkillsTable();
}

function renderSkillsTable() {
  const tbody = document.getElementById('skillsTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!skillsCache.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="admin-table-empty">${escapeHtml(t('table_empty'))}</td></tr>`;
    return;
  }
  skillsCache.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.category_en || '—')}</td>
      <td>${s.proficiency_pct}%</td>
      <td><button type="button" class="admin-row-edit">✎</button></td>`;
    tr.querySelector('.admin-row-edit').addEventListener('click', () => openSkillForm(s));
    tbody.appendChild(tr);
  });
}

document.getElementById('newSkillBtn')?.addEventListener('click', () => openSkillForm(null));
document.getElementById('skillFormClose')?.addEventListener('click', () => closeModal(document.getElementById('skillFormModal')));

const skillFormModal = document.getElementById('skillFormModal');
const skillForm = document.getElementById('skillForm');
let editingSkillId = null;

function openSkillForm(s) {
  editingSkillId = s ? s.id : null;
  document.getElementById('skillFormTitle').textContent = s ? s.name : 'New Skill';
  document.getElementById('sfCategoryEn').value = s?.category_en || '';
  document.getElementById('sfCategoryUz').value = s?.category_uz || '';
  document.getElementById('sfName').value = s?.name || '';
  document.getElementById('sfPct').value = s?.proficiency_pct ?? 50;
  document.getElementById('sfNoteEn').value = s?.note_en || '';
  document.getElementById('sfNoteUz').value = s?.note_uz || '';
  document.getElementById('sfSortOrder').value = s?.sort_order ?? skillsCache.length;
  document.getElementById('sfDeleteBtn').hidden = !s;
  document.getElementById('sfStatus').textContent = '';
  openModal(skillFormModal);
}

skillForm?.addEventListener('submit', async e => {
  e.preventDefault();
  const statusEl = document.getElementById('sfStatus');
  statusEl.textContent = t('saving');

  const payload = {
    category_en: document.getElementById('sfCategoryEn').value.trim() || null,
    category_uz: document.getElementById('sfCategoryUz').value.trim() || null,
    name: document.getElementById('sfName').value.trim(),
    proficiency_pct: Number(document.getElementById('sfPct').value),
    note_en: document.getElementById('sfNoteEn').value.trim() || null,
    note_uz: document.getElementById('sfNoteUz').value.trim() || null,
    sort_order: Number(document.getElementById('sfSortOrder').value) || 0,
  };

  const query = editingSkillId
    ? sb.from('skills').update(payload).eq('id', editingSkillId)
    : sb.from('skills').insert(payload);
  const { error } = await query;

  if (error) { statusEl.textContent = error.message; return; }
  statusEl.textContent = t('saved');
  await loadSkills();
  setTimeout(() => closeModal(skillFormModal), 500);
});

document.getElementById('sfDeleteBtn')?.addEventListener('click', async () => {
  if (!editingSkillId || !confirm(t('delete_confirm'))) return;
  const { error } = await sb.from('skills').delete().eq('id', editingSkillId);
  if (error) { document.getElementById('sfStatus').textContent = error.message; return; }
  await loadSkills();
  closeModal(skillFormModal);
});


/* ─── Inquiries inbox ─── */
async function loadInquiries() {
  const { data, error } = await sb.from('inquiries').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadInquiries:', error.message); return; }
  inquiriesCache = data;
  renderInquiries();
  const newCount = data.filter(i => i.status === 'new').length;
  const badge = document.getElementById('inquiryBadge');
  if (badge) { badge.hidden = !newCount; badge.textContent = String(newCount); }
}

function renderInquiries() {
  const list = document.getElementById('inquiriesList');
  if (!list) return;
  const filtered = inquiryFilter === 'all' ? inquiriesCache : inquiriesCache.filter(i => i.type === inquiryFilter);
  list.innerHTML = '';

  if (!filtered.length) {
    list.innerHTML = `<p class="admin-empty">${escapeHtml(t('inbox_empty'))}</p>`;
    return;
  }

  filtered.forEach(i => {
    const refProject = i.reference_project_id ? projectsCache.find(p => p.id === i.reference_project_id) : null;
    const row = document.createElement('div');
    row.className = 'admin-inbox-row admin-inbox-' + i.status;
    row.innerHTML = `
      <div class="admin-inbox-main">
        <div class="admin-inbox-top">
          <span>${i.type === 'hire' ? '💼' : '✉️'} ${escapeHtml(i.name)}</span>
          <span class="admin-inbox-date">${new Date(i.created_at).toLocaleDateString()}</span>
        </div>
        <div class="admin-inbox-email">${escapeHtml(i.email || '—')}</div>
        ${i.type === 'hire' ? `<div class="admin-inbox-meta">${escapeHtml(i.project_type || '—')} · ${escapeHtml(i.budget || '—')} · ${escapeHtml(i.timeline || '—')}${refProject ? ' · ref: ' + escapeHtml(refProject.title_en) : ''}</div>` : ''}
        <p class="admin-inbox-message">${escapeHtml(i.message)}</p>
      </div>
      <select class="admin-status-select">
        <option value="new"${i.status === 'new' ? ' selected' : ''}>New</option>
        <option value="replied"${i.status === 'replied' ? ' selected' : ''}>Replied</option>
        <option value="won"${i.status === 'won' ? ' selected' : ''}>Won</option>
        <option value="archived"${i.status === 'archived' ? ' selected' : ''}>Archived</option>
      </select>`;
    row.querySelector('.admin-status-select').addEventListener('change', async e => {
      const { error } = await sb.from('inquiries').update({ status: e.target.value }).eq('id', i.id);
      if (error) { console.error('status update:', error.message); return; }
      i.status = e.target.value;
      row.className = 'admin-inbox-row admin-inbox-' + i.status;
      const newCount = inquiriesCache.filter(x => x.status === 'new').length;
      const badge = document.getElementById('inquiryBadge');
      if (badge) { badge.hidden = !newCount; badge.textContent = String(newCount); }
    });
    list.appendChild(row);
  });
}

document.querySelectorAll('#inquiryFilters [data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    inquiryFilter = btn.dataset.filter;
    document.querySelectorAll('#inquiryFilters [data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderInquiries();
  });
});


/* ─── Settings ─── */
async function loadSettings() {
  const { data, error } = await sb.from('site_settings').select('*').eq('id', 1).single();
  if (error) { console.error('loadSettings:', error.message); return; }
  document.getElementById('settingsBioEn').value = data.bio_en || '';
  document.getElementById('settingsBioUz').value = data.bio_uz || '';
  document.getElementById('settingsAvailable').checked = Boolean(data.available_for_work);
}

document.getElementById('settingsForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const statusEl = document.getElementById('settingsStatus');
  statusEl.textContent = t('saving');
  const { error } = await sb.from('site_settings').update({
    bio_en: document.getElementById('settingsBioEn').value.trim(),
    bio_uz: document.getElementById('settingsBioUz').value.trim(),
    available_for_work: document.getElementById('settingsAvailable').checked,
  }).eq('id', 1);
  statusEl.textContent = error ? error.message : t('settings_saved');
});
