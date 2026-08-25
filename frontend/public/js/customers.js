// ─── CUSTOMERS MODULE ─────────────────────────────────────────────────────────
let allCustomers = [];
let currentCustomer = null;
let customerNavStack = []; // Håller koll på navigeringshistorik
let selectedPhotos = new Set();

// Nivånamn
const LEVEL_NAMES = ['Huvudkund', 'Område', 'Objekt/Byggnad'];
const LEVEL_ICONS = ['👥', '🏘️', '🏠'];
const CHILD_LABELS = ['Lägg till område', 'Lägg till objekt', null];

// ── LIST ──────────────────────────────────────────────────────────────────────
async function loadCustomers() {
  const q = document.getElementById('customers-search')?.value || '';
  allCustomers = await api('GET', `/api/customers${q ? '?q='+encodeURIComponent(q) : ''}`);
  renderCustomersList();
}

function renderCustomersList() {
  const list = document.getElementById('customers-list');
  if (!list) return;

  if (allCustomers.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">👥</div>
      <p>Inga kunder</p>
      <button class="btn btn-accent" onclick="showNewCustomerModal()">+ Lägg till kund</button>
    </div>`;
    return;
  }

  list.innerHTML = allCustomers.map(c => `
    <div class="customer-card" onclick="openCustomer(${c.id})">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:24px">${LEVEL_ICONS[0]}</div>
        <div style="flex:1">
          <div style="font-size:11px;color:var(--accent);font-weight:700">${c.customer_number}</div>
          <div style="font-weight:700;font-size:15px">${escHtml(c.name)}</div>
          ${c.company ? `<div style="font-size:12px;color:var(--muted)">${escHtml(c.company)}</div>` : ''}
          <div style="font-size:12px;color:var(--muted);margin-top:2px">
            ${c.child_count > 0 ? `<span>📂 ${c.child_count} områden</span> · ` : ''}
            ${c.phone ? `<span>📞 ${escHtml(c.phone)}</span> · ` : ''}
            <span>🔧 ${c.active_jobs} aktiva</span>
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  `).join('');
}

let custSearchTimeout;
function searchCustomers(val) {
  clearTimeout(custSearchTimeout);
  custSearchTimeout = setTimeout(() => loadCustomers(), 300);
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
async function openCustomer(id) {
  currentCustomer = await api('GET', `/api/customers/${id}`);
  customerNavStack.push(id);
  renderCustomerDetail();
  document.getElementById('customers-list-view').style.display = 'none';
  document.getElementById('customers-detail-view').style.display = '';
}

function closeCustomerDetail() {
  customerNavStack = [];
  document.getElementById('customers-list-view').style.display = '';
  document.getElementById('customers-detail-view').style.display = 'none';
  loadCustomers();
}

async function navigateUp() {
  customerNavStack.pop();
  if (customerNavStack.length === 0) {
    closeCustomerDetail();
    return;
  }
  const parentId = customerNavStack[customerNavStack.length - 1];
  currentCustomer = await api('GET', `/api/customers/${parentId}`);
  renderCustomerDetail();
}

function renderCustomerDetail() {
  if (!currentCustomer) return;
  const c = currentCustomer;
  const level = c.level || 0;

  // ── BREADCRUMB ──────────────────────────────────────────────────────────────
  let breadcrumb = '';
  if (c.grandparent) {
    breadcrumb += `<span onclick="openCustomer(${c.grandparent.id})" style="cursor:pointer;color:var(--muted)">${escHtml(c.grandparent.name)}</span> › `;
  }
  if (c.parent) {
    breadcrumb += `<span onclick="openCustomer(${c.parent.id})" style="cursor:pointer;color:var(--muted)">${escHtml(c.parent.name)}</span> › `;
  }
  breadcrumb += `<span style="color:var(--text)">${escHtml(c.name)}</span>`;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  document.getElementById('customer-detail-header').innerHTML = `
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">${breadcrumb}</div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:32px">${LEVEL_ICONS[level]}</div>
        <div>
          <div style="font-size:11px;color:var(--accent);font-weight:700">${c.customer_number} · ${LEVEL_NAMES[level]}</div>
          <div style="font-size:20px;font-weight:700">${escHtml(c.name)}</div>
          ${c.company ? `<div style="font-size:13px;color:var(--muted)">${escHtml(c.company)}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-ghost" onclick="showEditCustomerModal()">✏️</button>
        <button class="btn btn-sm btn-danger admin-only" onclick="deleteCurrentCustomer()">🗑</button>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;font-size:13px;margin-bottom:12px">
      ${c.phone ? `<a href="tel:${c.phone}" style="color:var(--accent);text-decoration:none">📞 ${escHtml(c.phone)}</a>` : ''}
      ${c.email ? `<a href="mailto:${c.email}" style="color:var(--accent);text-decoration:none">✉️ ${escHtml(c.email)}</a>` : ''}
      ${c.address ? `<span>📍 ${escHtml(c.address)}${c.city ? ', '+escHtml(c.city) : ''}</span>` : ''}
      ${c.notes ? `<span style="color:var(--muted)">📋 ${escHtml(c.notes)}</span>` : ''}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-accent" onclick="createJobForCustomer(${c.id},'${escHtml(c.name)}','${escHtml(c.phone||'')}','${escHtml(c.address||'')}')">+ Nytt jobb</button>
      <button class="btn btn-sm btn-ghost" onclick="showCustomerPhotos(${c.id})">📷 Bilder</button>
      <button class="btn btn-sm btn-ghost" onclick="uploadPhotoToCustomer(${c.id})">📷 Ladda upp bild</button>
      <button class="btn btn-sm btn-ghost" onclick="showCustomerNotes(${c.id})">📋 Anteckningar</button>
      ${CHILD_LABELS[level] ? `<button class="btn btn-sm btn-ghost" onclick="showNewSubCustomerModal(${c.id},${level+1})">+ ${CHILD_LABELS[level]}</button>` : ''}
    </div>
  `;

  // ── UNDERKUNDER ─────────────────────────────────────────────────────────────
  const childLabel = level === 0 ? 'OMRÅDEN' : level === 1 ? 'OBJEKT' : null;
  let childrenHtml = '';
  if (childLabel && c.children && c.children.length > 0) {
    childrenHtml = `
      <div class="settings-label" style="margin-top:16px">${LEVEL_ICONS[level+1]} ${childLabel}</div>
      ${c.children.map(child => `
        <div class="card" style="margin-bottom:8px;cursor:pointer" onclick="openCustomer(${child.id})">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:20px">${LEVEL_ICONS[level+1]}</div>
            <div style="flex:1">
              <div style="font-size:11px;color:var(--accent)">${child.customer_number}</div>
              <div style="font-weight:600">${escHtml(child.name)}</div>
              <div style="font-size:12px;color:var(--muted)">
                ${child.child_count > 0 ? `📂 ${child.child_count} objekt · ` : ''}
                🔧 ${child.active_jobs} aktiva jobb
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
      `).join('')}
    `;
  } else if (childLabel && (!c.children || c.children.length === 0)) {
    childrenHtml = `
      <div class="settings-label" style="margin-top:16px">${LEVEL_ICONS[level+1]} ${childLabel}</div>
      <div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">
        Inga ${childLabel.toLowerCase()} ännu
        <br><button class="btn btn-sm btn-accent" style="margin-top:8px" onclick="showNewSubCustomerModal(${c.id},${level+1})">+ ${CHILD_LABELS[level]}</button>
      </div>
    `;
  }

  // ── JOBB ────────────────────────────────────────────────────────────────────
  const jobsHtml = `
    <div class="settings-label" style="margin-top:16px">🔧 JOBB</div>
    ${!c.jobs || c.jobs.length === 0
      ? `<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">Inga jobb</div>`
      : c.jobs.map(j => `
        <div class="card" style="margin-bottom:8px;cursor:pointer" onclick="goToJob(${j.id})">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-weight:600;font-size:13px">${j.order_number ? 'AO: '+escHtml(j.order_number) : escHtml(j.customer_name||'Jobb')}</div>
              ${j.description ? `<div style="font-size:12px;color:var(--muted)">${escHtml(j.description)}</div>` : ''}
              ${j.address ? `<div style="font-size:12px;color:var(--muted)">📍 ${escHtml(j.address)}</div>` : ''}
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${formatDate(j.created_at)}</div>
            </div>
            <span style="font-size:11px;padding:2px 8px;border-radius:10px;background:${j.status==='active'?'var(--accent-dim)':'var(--card2)'};color:${j.status==='active'?'var(--accent)':'var(--muted)'}">${j.status==='active'?'Aktivt':'Arkiverat'}</span>
          </div>
        </div>
      `).join('')
    }
  `;

  document.getElementById('customer-jobs-list').innerHTML = childrenHtml + jobsHtml;
  document.querySelectorAll('.admin-only').forEach(el => { el.style.display = user?.role==='admin' ? '' : 'none'; });
}

function goToJob(jobId) {
  closeCustomerDetail();
  showScreen('jobs');
  setTimeout(() => openJob(jobId), 300);
}

function createJobForCustomer(customerId, customerName, phone, address) {
  closeCustomerDetail();
  showScreen('jobs');
  setTimeout(() => {
    showNewJobModal();
    document.getElementById('job-form-customer').value = customerName || '';
    document.getElementById('job-form-phone').value = phone || '';
    document.getElementById('job-form-address').value = address || '';
    document.getElementById('job-form-customer-id').value = customerId;
  }, 300);
}

// ── SKAPA KUND / UNDER-KUND ───────────────────────────────────────────────────
async function showNewCustomerModal(parentId = null, level = 0) {
  document.getElementById('customer-modal-title').textContent = parentId
    ? `+ ${CHILD_LABELS[level-1] || 'Ny underkund'}`
    : 'Ny kund';
  document.getElementById('customer-form-id').value = '';
  document.getElementById('customer-form-name').value = '';
  document.getElementById('customer-form-company').value = '';
  document.getElementById('customer-form-phone').value = '';
  document.getElementById('customer-form-email').value = '';
  document.getElementById('customer-form-address').value = '';
  document.getElementById('customer-form-city').value = '';
  document.getElementById('customer-form-notes').value = '';

  // Spara parent_id i ett dolt fält
  let parentField = document.getElementById('customer-form-parent-id');
  if (!parentField) {
    parentField = document.createElement('input');
    parentField.type = 'hidden';
    parentField.id = 'customer-form-parent-id';
    document.getElementById('customer-form-id').parentNode.appendChild(parentField);
  }
  parentField.value = parentId || '';

  try {
    const url = parentId
      ? `/api/customers/meta/next-number?parent_id=${parentId}`
      : '/api/customers/meta/next-number';
    const { number } = await api('GET', url);
    document.getElementById('customer-form-number').value = number;
  } catch(e) {}

  openModal('modal-customer-form');
}

function showNewSubCustomerModal(parentId, level) {
  showNewCustomerModal(parentId, level);
}

function showEditCustomerModal() {
  if (!currentCustomer) return;
  const c = currentCustomer;
  document.getElementById('customer-modal-title').textContent = 'Redigera';
  document.getElementById('customer-form-id').value = c.id;
  document.getElementById('customer-form-number').value = c.customer_number;
  document.getElementById('customer-form-name').value = c.name;
  document.getElementById('customer-form-company').value = c.company||'';
  document.getElementById('customer-form-phone').value = c.phone||'';
  document.getElementById('customer-form-email').value = c.email||'';
  document.getElementById('customer-form-address').value = c.address||'';
  document.getElementById('customer-form-city').value = c.city||'';
  document.getElementById('customer-form-notes').value = c.notes||'';
  let parentField = document.getElementById('customer-form-parent-id');
  if (parentField) parentField.value = '';
  openModal('modal-customer-form');
}

async function saveCustomer() {
  const id = document.getElementById('customer-form-id').value;
  const parentId = document.getElementById('customer-form-parent-id')?.value || '';
  const body = {
    customer_number: document.getElementById('customer-form-number').value.trim(),
    name: document.getElementById('customer-form-name').value.trim(),
    company: document.getElementById('customer-form-company').value.trim(),
    phone: document.getElementById('customer-form-phone').value.trim(),
    email: document.getElementById('customer-form-email').value.trim(),
    address: document.getElementById('customer-form-address').value.trim(),
    city: document.getElementById('customer-form-city').value.trim(),
    notes: document.getElementById('customer-form-notes').value.trim(),
  };
  if (parentId) body.parent_id = parentId;
  if (!body.name) { toast('Namn krävs','error'); return; }
  try {
    if (id) {
      await api('PUT', `/api/customers/${id}`, body);
      toast('Uppdaterad!','success');
      currentCustomer = await api('GET', `/api/customers/${id}`);
      renderCustomerDetail();
    } else {
      const res = await api('POST', '/api/customers', body);
      toast('Skapad!','success');
      closeModal('modal-customer-form');
      await openCustomer(res.id);
      return;
    }
    closeModal('modal-customer-form');
  } catch(e) { toast(e.message,'error'); }
}

async function deleteCurrentCustomer() {
  const msg = currentCustomer.children?.length > 0
    ? `Ta bort "${currentCustomer.name}" och alla dess underkunder?\nJobben tas inte bort.`
    : `Ta bort "${currentCustomer.name}"?`;
  if (!confirm(msg)) return;
  await api('DELETE', `/api/customers/${currentCustomer.id}`);
  toast('Borttagen','success');
  if (customerNavStack.length > 1) {
    customerNavStack.pop();
    const parentId = customerNavStack[customerNavStack.length - 1];
    currentCustomer = await api('GET', `/api/customers/${parentId}`);
    renderCustomerDetail();
  } else {
    closeCustomerDetail();
  }
}

// ── CUSTOMER SEARCH I JOBBFORMULÄR ────────────────────────────────────────────
let customerPickTimeout;
let selectedCustomerId = null;

function searchCustomerForJob(val) {
  const resultsEl = document.getElementById('job-customer-results');
  if (!val || val.length < 2) { resultsEl.innerHTML = ''; return; }
  clearTimeout(customerPickTimeout);
  customerPickTimeout = setTimeout(async () => {
    const results = await api('GET', `/api/customers?q=${encodeURIComponent(val)}`);
    if (results.length === 0) {
      resultsEl.innerHTML = `<div style="padding:8px;font-size:13px;color:var(--muted)">Ingen kund hittad</div>`;
      return;
    }
    resultsEl.innerHTML = results.map(c => `
      <div class="customer-search-result" onclick="pickCustomerForJob(${c.id},'${escHtml(c.name)}','${escHtml(c.customer_number)}','${escHtml(c.phone||'')}','${escHtml(c.address||''+(c.city?', '+c.city:''))}')">
        <div style="font-weight:600">${escHtml(c.name)} <span style="color:var(--accent);font-size:11px">${c.customer_number}</span></div>
        <div style="font-size:12px;color:var(--muted)">${c.phone||''} ${c.address||''}</div>
      </div>
    `).join('');
  }, 250);
}

function pickCustomerForJob(id, name, number, phone, address) {
  selectedCustomerId = id;
  document.getElementById('job-form-customer').value = name;
  document.getElementById('job-form-phone').value = phone;
  document.getElementById('job-form-address').value = address;
  document.getElementById('job-form-customer-id').value = id;
  document.getElementById('job-customer-results').innerHTML = `<div style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:6px;padding:8px;font-size:13px">✓ ${escHtml(name)} (${number})</div>`;
  document.getElementById('job-customer-search').value = '';
}

// ── GLOBAL PHOTO SELECTION ────────────────────────────────────────────────────
function togglePhotoSelect(id, idx, event) {
  const checkEl = document.getElementById(`cgcheck-${id}`);
  const photoEl = document.getElementById(`cgphoto-${id}`);
  if (!checkEl || !photoEl) return;

  // Om inget är markerat och man inte klickar på checken — öppna bilden
  if (selectedPhotos.size === 0 && !event.target.closest(`[id="cgcheck-${id}"]`)) {
    openCustomerGalleryPhoto(idx);
    return;
  }

  if (selectedPhotos.has(id)) {
    selectedPhotos.delete(id);
    photoEl.style.borderColor = 'transparent';
    checkEl.textContent = '';
    checkEl.style.background = 'rgba(0,0,0,0.5)';
  } else {
    selectedPhotos.add(id);
    photoEl.style.borderColor = 'var(--accent)';
    checkEl.textContent = '✓';
    checkEl.style.background = 'var(--accent)';
  }

  // Uppdatera urvalsbaren
  const bar = document.getElementById('cgallery-selection-bar');
  const count = document.getElementById('cgallery-sel-count');
  if (bar && count) {
    bar.style.display = selectedPhotos.size > 0 ? 'flex' : 'none';
    count.textContent = `${selectedPhotos.size} markerade`;
  }
}

// ── BILDER & ANTECKNINGAR ─────────────────────────────────────────────────────
async function showCustomerPhotos(customerId) {
  // Bygg galleri-overlay precis som på jobbet
  const existing = document.getElementById('customer-gallery-overlay');
  if (existing) existing.remove();

  const folders = await api('GET', `/api/customers/${customerId}/folders`);
  const photos = await api('GET', `/api/customers/${customerId}/photos`);

  const overlay = document.createElement('div');
  overlay.id = 'customer-gallery-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:9000;display:flex;flex-direction:column;overflow:hidden';

  let activeFolderId = null;
  let activeJobId = null;

  function renderGallery(filteredPhotos) {
    const grid = overlay.querySelector('#cgallery-grid');
    if (!grid) return;
    if (filteredPhotos.length === 0) {
      grid.innerHTML = '<div style="color:var(--muted);text-align:center;padding:40px">Inga bilder</div>';
      return;
    }
    grid.innerHTML = filteredPhotos.map((p, idx) => `
      <div id="cgphoto-${p.id}" style="position:relative;cursor:pointer;border-radius:10px;overflow:hidden;aspect-ratio:1;background:var(--card2);border:3px solid transparent;transition:border-color 0.15s"
        onclick="togglePhotoSelect(${p.id}, ${idx}, event)">
        <img src="${imgAuth(p.image_url)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
        <div id="cgcheck-${p.id}" style="position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.5);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:12px"></div>
        ${p.address||p.order_number ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);padding:3px 6px;font-size:10px;color:#fff">${escHtml(p.address||p.order_number||'')}</div>` : ''}
      </div>
    `).join('');
    window._customerGalleryPhotos = filteredPhotos;
    selectedPhotos.clear();
    
    // Uppdatera urvalsbaren (inline istället för updateSelectionBar-anrop)
    const bar = document.getElementById('cgallery-selection-bar');
    const count = document.getElementById('cgallery-sel-count');
    if (bar && count) {
      bar.style.display = 'none';
      count.textContent = '';
    }
  }

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border);flex-shrink:0">
      <h2 style="font-size:18px;font-weight:700">📷 Bilder (${photos.length})</h2>
      <div style="display:flex;gap:8px">
        <button onclick="uploadPhotosToCustomer(${customerId})" style="background:var(--accent);border:none;color:#000;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer">+ Ladda upp</button>
        <button onclick="document.getElementById('customer-gallery-overlay').remove()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer">✕</button>
      </div>
    </div>

    <div style="display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto">
      <div id="cgallery-filter-all" onclick="cgalleryFilter(null,null,${customerId})" style="padding:6px 14px;border-radius:20px;background:var(--accent);color:#000;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Alla (${photos.length})</div>
      ${folders.map(f => `
        <div onclick="cgalleryFilter(${f.id},null,${customerId})" style="padding:6px 14px;border-radius:20px;background:var(--card2);border:1px solid var(--border);font-size:12px;cursor:pointer;white-space:nowrap">📁 ${escHtml(f.name)} (${f.photo_count})</div>
      `).join('')}
      <div onclick="showCreateFolderDialog(${customerId})" style="padding:6px 14px;border-radius:20px;background:var(--card2);border:1px solid var(--border);font-size:12px;cursor:pointer;white-space:nowrap;color:var(--accent)">+ Ny mapp</div>
    </div>

    <div style="flex:1;overflow-y:auto;padding:12px">
      <div id="cgallery-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px"></div>
      <div id="cgallery-selection-bar" style="display:none;position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--border);padding:10px 16px;gap:8px;align-items:center;justify-content:space-between">
        <span id="cgallery-sel-count" style="font-weight:700;font-size:13px"></span>
        <div style="display:flex;gap:8px">
          <button onclick="moveSelectedPhotos(${customerId})" style="background:var(--accent);border:none;color:#000;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">📁 Flytta</button>
          <button onclick="deleteSelectedPhotos(${customerId})" style="background:var(--danger);border:none;color:#fff;padding:8px 14px;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px">🗑 Radera</button>
          <button onclick="selectedPhotos.clear();renderGallery(window._customerGalleryPhotos)" style="background:var(--card2);border:1px solid var(--border);color:var(--text);padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px">Avmarkera</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  window._customerGalleryPhotos = photos;
  window._cgalleryCustomerId = customerId;
  renderGallery(photos);

  window.cgalleryFilter = async (folderId, jobId, custId) => {
    let url = `/api/customers/${custId}/photos`;
    const params = [];
    if (folderId) params.push(`folder_id=${folderId}`);
    if (jobId) params.push(`job_id=${jobId}`);
    if (params.length) url += '?' + params.join('&');
    const filtered = await api('GET', url);
    renderGallery(filtered);
  };
}

function openCustomerGalleryPhoto(idx) {
  const photos = window._customerGalleryPhotos;
  if (!photos) return;
  const overlay = document.createElement('div');
  overlay.id = 'customer-photo-viewer';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center';
  let currentIdx = idx;

  function render() {
    const p = photos[currentIdx];
    overlay.innerHTML = `
      <div style="position:absolute;top:16px;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:0 16px">
        <span style="color:#888;font-size:13px">${currentIdx+1} / ${photos.length}</span>
        <div style="display:flex;gap:8px">
          <button onclick="movePhotoToFolder(${p.id},${window._cgalleryCustomerId})" style="background:rgba(255,255,255,0.1);border:none;color:#fff;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px">📁 Flytta</button>
          <button onclick="deleteCustomerPhoto(${p.id},${window._cgalleryCustomerId})" style="background:rgba(248,113,113,0.3);border:none;color:#fff;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:13px">🗑 Radera</button>
          <button onclick="document.getElementById('customer-photo-viewer').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer">✕</button>
        </div>
      </div>
      <img src="${imgAuth(p.image_url)}" style="max-width:95vw;max-height:75vh;object-fit:contain;border-radius:8px">
      <div style="color:#ccc;font-size:12px;margin-top:10px;text-align:center">
        ${escHtml(p.address||p.customer_name||'')}
        ${p.order_number ? ' · AO: '+escHtml(p.order_number) : ''}
        <br>${formatDate(p.created_at)} · ${escHtml(p.display_name||'')}
      </div>
      <div style="position:absolute;bottom:24px;display:flex;gap:16px">
        ${currentIdx > 0 ? `<button onclick="navCustPhoto(-1)" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:10px 24px;border-radius:24px;font-size:16px;cursor:pointer">← Föregående</button>` : '<span></span>'}
        ${currentIdx < photos.length-1 ? `<button onclick="navCustPhoto(1)" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:10px 24px;border-radius:24px;font-size:16px;cursor:pointer">Nästa →</button>` : ''}
      </div>
    `;
  }

  window.navCustPhoto = (dir) => {
    currentIdx = Math.max(0, Math.min(photos.length-1, currentIdx+dir));
    render();
  };

  document.body.appendChild(overlay);
  render();
}

async function showCreateFolderDialog(customerId) {
  const name = prompt('Namn på ny mapp:');
  if (!name) return;
  try {
    await api('POST', `/api/customers/${customerId}/folders`, { name });
    toast('Mapp skapad!', 'success');
    // Uppdatera galleriet
    document.getElementById('customer-gallery-overlay')?.remove();
    showCustomerPhotos(customerId);
  } catch(e) { toast(e.message, 'error'); }
}

async function uploadPhotosToCustomer(customerId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Hämta eller skapa standardjobb
    let jobId = null;
    try {
      const customer = await api('GET', `/api/customers/${customerId}`);
      if (customer.jobs && customer.jobs.length > 0) {
        jobId = customer.jobs[0].id;
      } else {
        const job = await api('POST', '/api/jobs', {
          customer_name: customer.name,
          customer_id: customerId,
          description: 'Bildarkiv',
          is_shared: 1
        });
        jobId = job.id;
      }

      toast(`Laddar upp ${files.length} bild(er)...`, '');
      for (const file of files) {
        if (file.size > 8 * 1024 * 1024) { toast(`${file.name} för stor`, 'error'); continue; }
        await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              await api('POST', `/api/jobs/${jobId}/entries`, {
                type: 'photo', content: '', image_data: ev.target.result, mime_type: file.type
              });
            } catch(err) { toast(err.message, 'error'); }
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      toast(`${files.length} bild(er) uppladdade!`, 'success');
      document.getElementById('customer-gallery-overlay')?.remove();
      showCustomerPhotos(customerId);
    } catch(e) { toast(e.message, 'error'); }
  };
  input.click();
}

async function uploadPhotoToCustomer(customerId) {
  // Skapa ett jobb om det inte finns, eller använd ett befintligt
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast('Bilden är för stor (max 8MB)', 'error'); return; }

    // Hämta eller skapa ett standardjobb för kunden
    let jobId = null;
    try {
      const customer = await api('GET', `/api/customers/${customerId}`);
      if (customer.jobs && customer.jobs.length > 0) {
        jobId = customer.jobs[0].id;
      } else {
        // Skapa ett standardjobb
        const job = await api('POST', '/api/jobs', {
          customer_name: customer.name,
          customer_id: customerId,
          description: 'Bildarkiv',
          is_shared: 1
        });
        jobId = job.id;
      }

      toast('Laddar upp...', '');
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          await api('POST', `/api/jobs/${jobId}/entries`, {
            type: 'photo',
            content: '',
            image_data: ev.target.result,
            mime_type: file.type
          });
          toast('Bild uppladdad!', 'success');
          currentCustomer = await api('GET', `/api/customers/${customerId}`);
          renderCustomerDetail();
        } catch(err) { toast(err.message, 'error'); }
      };
      reader.readAsDataURL(file);
    } catch(e) { toast(e.message, 'error'); }
  };
  input.click();
}

async function movePhotoToFolder(entryId, customerId) {
  const folders = await api('GET', `/api/customers/${customerId}/folders`);
  if (folders.length === 0) {
    toast('Inga mappar finns — skapa en mapp först', 'warn');
    return;
  }
  const options = ['0: Ingen mapp', ...folders.map((f,i) => `${i+1}: ${f.name}`)];
  const choice = prompt(`Flytta till mapp:\n${options.join('\n')}\n\nAnge nummer:`);
  if (choice === null) return;
  const idx = parseInt(choice);
  if (isNaN(idx)) return;
  const folderId = idx === 0 ? null : folders[idx-1]?.id;
  try {
    await api('PUT', `/api/jobs/entries/${entryId}/folder`, { folder_id: folderId });
    toast('Bild flyttad!', 'success');
    document.getElementById('customer-photo-viewer')?.remove();
    document.getElementById('customer-gallery-overlay')?.remove();
    showCustomerPhotos(customerId);
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteCustomerPhoto(entryId, customerId) {
  if (!confirm('Radera denna bild permanent?')) return;
  try {
    await api('DELETE', `/api/jobs/entries/${entryId}`);
    toast('Bild raderad', 'success');
    document.getElementById('customer-photo-viewer')?.remove();
    document.getElementById('customer-gallery-overlay')?.remove();
    showCustomerPhotos(customerId);
  } catch(e) { toast(e.message, 'error'); }
}

async function moveSelectedPhotos(customerId) {
  const folders = await api('GET', `/api/customers/${customerId}/folders`);
  if (folders.length === 0) { toast('Inga mappar finns', 'warn'); return; }
  const options = ['0: Ingen mapp', ...folders.map((f,i) => `${i+1}: ${f.name}`)];
  const choice = prompt(`Flytta ${selectedPhotos.size} bilder till:\n${options.join('\n')}\n\nAnge nummer:`);
  if (choice === null) return;
  const idx = parseInt(choice);
  if (isNaN(idx)) return;
  const folderId = idx === 0 ? null : folders[idx-1]?.id;
  try {
    for (const id of selectedPhotos) {
      await api('PUT', `/api/jobs/entries/${id}/folder`, { folder_id: folderId });
    }
    toast(`${selectedPhotos.size} bilder flyttade!`, 'success');
    document.getElementById('customer-gallery-overlay')?.remove();
    showCustomerPhotos(customerId);
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteSelectedPhotos(customerId) {
  if (!confirm(`Radera ${selectedPhotos.size} bilder permanent?`)) return;
  try {
    for (const id of selectedPhotos) {
      await api('DELETE', `/api/jobs/entries/${id}`);
    }
    toast(`${selectedPhotos.size} bilder raderade!`, 'success');
    document.getElementById('customer-gallery-overlay')?.remove();
    showCustomerPhotos(customerId);
  } catch(e) { toast(e.message, 'error'); }
}