// ─── JOBS MODULE ──────────────────────────────────────────────────────────────
let currentJobs = [];
let currentJob = null;
let jobsViewMode = 'active'; // 'active' or 'archived'

// ── LIST ──────────────────────────────────────────────────────────────────────
async function loadJobs(status) {
  jobsViewMode = status || jobsViewMode;
  const q = document.getElementById('jobs-search')?.value || '';
  currentJobs = await api('GET', `/api/jobs?status=${jobsViewMode}&q=${encodeURIComponent(q)}`);
  renderJobsList();
}

function renderJobsList() {
  const list = document.getElementById('jobs-list');
  const activeBtn = document.getElementById('jobs-tab-active');
  const archiveBtn = document.getElementById('jobs-tab-archived');
  if (activeBtn) activeBtn.classList.toggle('active', jobsViewMode === 'active');
  if (archiveBtn) archiveBtn.classList.toggle('active', jobsViewMode === 'archived');

  if (currentJobs.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${jobsViewMode === 'active' ? '🔧' : '📁'}</div>
      <p>${jobsViewMode === 'active' ? 'Inga aktiva jobb' : 'Inga arkiverade jobb'}</p>
      ${jobsViewMode === 'active' ? '<button class="btn btn-accent" onclick="showNewJobModal()">+ Nytt jobb</button>' : ''}
    </div>`;
    return;
  }

  list.innerHTML = currentJobs.map(job => `
    <div class="job-card ${jobsViewMode === 'active' ? 'active-job' : 'archived-job'}" onclick="openJob(${job.id})">
      <div class="job-card-header">
        <span class="job-order">${job.order_number ? `AO: ${escHtml(job.order_number)}` : 'Inget AO-nr'}</span>
        <span class="job-date">${formatDate(job.created_at)}</span>
      </div>
      <div class="job-customer">${escHtml(job.customer_name)}</div>
      ${job.address ? `<div class="job-address">📍 ${escHtml(job.address)}</div>` : ''}
      ${job.phone ? `<div class="job-address">📞 ${escHtml(job.phone)}</div>` : ''}
      <div class="job-meta">
        <span>👤 ${escHtml(job.created_by_name||'')}</span>
        <span>📝 ${job.entry_count} anteckningar</span>
        <span>📦 ${job.material_count} material</span>
      </div>
    </div>
  `).join('');
}

let jobSearchTimeout;
function searchJobs(val) {
  clearTimeout(jobSearchTimeout);
  jobSearchTimeout = setTimeout(() => loadJobs(), 300);
}

// ── JOB DETAIL ────────────────────────────────────────────────────────────────
async function openJob(id) {
  currentJob = await api('GET', `/api/jobs/${id}`);
  renderJobDetail();
  document.getElementById('jobs-list-view').style.display = 'none';
  document.getElementById('jobs-detail-view').style.display = '';
}

function closeJobDetail() {
  document.getElementById('jobs-list-view').style.display = '';
  document.getElementById('jobs-detail-view').style.display = 'none';
  loadJobs();
}

function renderJobDetail() {
  if (!currentJob) return;
  const j = currentJob;

  // Header
  const mapsUrl = j.address ? `https://maps.google.com/?q=${encodeURIComponent(j.address)}` : null;
  document.getElementById('job-detail-header').innerHTML = `
    <div class="job-detail-name">${escHtml(j.customer_name)}</div>
    ${j.order_number ? `<div class="job-detail-order">AO: ${escHtml(j.order_number)}</div>` : ''}
    <div class="job-detail-info">
      ${j.phone ? `<span>📞 <a href="tel:${j.phone}">${escHtml(j.phone)}</a></span>` : ''}
      ${j.address ? `<span>📍 <a href="${mapsUrl}" target="_blank">${escHtml(j.address)} 🗺️</a></span>` : ''}
      ${j.description ? `<span>📋 ${escHtml(j.description)}</span>` : ''}
      <span style="font-size:11px;color:var(--muted)">Skapat: ${formatDate(j.created_at)} av ${escHtml(j.created_by_name||'')}</span>
    </div>
    <div class="job-action-btns">
      <button class="btn btn-sm btn-ghost" onclick="showEditJobModal()">✏️ Redigera</button>
      <button class="btn btn-sm ${j.is_shared ? 'btn-accent' : 'btn-ghost'}" onclick="toggleJobShare(${j.id}, ${j.is_shared})">${j.is_shared ? '🔓 Delat' : '🔒 Privat'}</button>
      ${j.status === 'active'
        ? `<button class="btn btn-sm btn-warn" onclick="archiveJob(${j.id})">📁 Arkivera</button>`
        : `<button class="btn btn-sm btn-ghost" onclick="restoreJob(${j.id})">↩️ Återöppna</button>`
      }
      ${user.role === 'admin' ? `<button class="btn btn-sm btn-danger" onclick="deleteJob(${j.id})">🗑 Ta bort</button>` : ''}
    </div>
  `;

  // Timeline
  renderTimeline();

  // Materials
  renderMaterials();
  // Bookings
  renderJobBookings();
}

function renderTimeline() {
  const el = document.getElementById('job-timeline');
  if (!currentJob.entries || currentJob.entries.length === 0) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">Inga anteckningar ännu</div>';
    return;
  }

  el.innerHTML = `<div class="timeline">` + currentJob.entries.map(entry => {
    const dotClass = entry.type === 'note' ? 'note' : entry.type === 'photo' ? 'photo' : entry.type === 'archived' || entry.type === 'restored' ? 'archived' : 'created';
    const icon = entry.type === 'note' ? '📝' : entry.type === 'photo' ? '📷' : entry.type === 'archived' ? '📁' : entry.type === 'restored' ? '↩️' : '✓';
    const canDelete = entry.user_id === user.id || user.role === 'admin';
    const isSystem = ['created','archived','restored'].includes(entry.type);

    return `
      <div class="timeline-entry">
        <div class="timeline-dot ${dotClass}">${icon}</div>
        <div class="timeline-body">
          <div class="timeline-meta">
            ${escHtml(entry.user_name||'')} · ${formatDate(entry.created_at)}
            ${canDelete && !isSystem ? `<button class="timeline-delete" onclick="deleteEntry(${entry.id})">✕</button>` : ''}
          </div>
          ${entry.content ? `<div class="timeline-content">${escHtml(entry.content)}</div>` : ''}
          ${entry.image_url ? `<img src="${imgAuth(entry.image_url)}" class="timeline-img" onclick="openImageFullscreen('${entry.image_url}')">` : ''}
        </div>
      </div>`;
  }).join('') + '</div>';
}

function renderMaterials() {
  const el = document.getElementById('job-materials');
  if (!currentJob.materials || currentJob.materials.length === 0) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:8px">Inga material tillagda</div>';
    return;
  }
  el.innerHTML = currentJob.materials.map(m => `
    <div class="material-item">
      <div>
        <div class="material-e">${m.e_number}</div>
        <div>${escHtml(m.product_name)}</div>
      </div>
      <div class="material-qty">${m.quantity} ${m.unit}</div>
      <button class="btn btn-xs btn-danger" onclick="deleteMaterial(${m.id})">✕</button>
    </div>
  `).join('');
}

// ── ADD ENTRIES ───────────────────────────────────────────────────────────────
function showAddNoteModal() {
  document.getElementById('note-input').value = '';
  openModal('modal-job-note');
  setTimeout(() => document.getElementById('note-input').focus(), 300);
}

async function submitNote() {
  const content = document.getElementById('note-input').value.trim();
  if (!content) { toast('Skriv en anteckning','error'); return; }
  await api('POST', `/api/jobs/${currentJob.id}/entries`, { type: 'note', content });
  closeModal('modal-job-note');
  currentJob = await api('GET', `/api/jobs/${currentJob.id}`);
  renderTimeline();
  toast('Anteckning tillagd','success');
}

function showAddPhotoModal() {
  document.getElementById('qty-modal-title').textContent = '📷 Lägg till foto';
  document.getElementById('qty-modal-info').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;padding:8px 0">
      <button class="btn btn-primary btn-full" onclick="closeModal('modal-quantity'); triggerPhotoInput(false)">📷 Ta foto med kamera</button>
      <button class="btn btn-ghost btn-full" onclick="closeModal('modal-quantity'); triggerPhotoInput(true)">🖼️ Välj från bildbibliotek</button>
    </div>
  `;
  document.querySelector('.qty-controls').style.display = 'none';
  document.querySelector('#modal-quantity .modal-actions').innerHTML =
    `<button class="btn btn-ghost btn-full" onclick="closeModal('modal-quantity')">Avbryt</button>`;
  openModal('modal-quantity');
}

function triggerPhotoInput(fromLibrary) {
  const input = document.getElementById('job-photo-input');
  if (fromLibrary) {
    input.removeAttribute('capture');
  } else {
    input.setAttribute('capture', 'environment');
  }
  input.click();
}

async function handleJobPhoto(input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  const tooBig = files.filter(f => f.size > 8 * 1024 * 1024);
  if (tooBig.length > 0) { toast(`${tooBig.length} bild(er) för stora (max 8MB)`, 'error'); return; }

  toast(`Laddar upp ${files.length} bild(er)...`, '');

  for (const file of files) {
    await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          await api('POST', `/api/jobs/${currentJob.id}/entries`, {
            type: 'photo',
            content: '',
            image_data: e.target.result,
            mime_type: file.type
          });
        } catch(err) { toast(err.message, 'error'); }
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  currentJob = await api('GET', `/api/jobs/${currentJob.id}`);
  renderTimeline();
  toast(`${files.length} bild(er) uppladdade!`, 'success');
  input.value = '';
}

async function deleteEntry(entryId) {
  if (!confirm('Ta bort denna post?')) return;
  await api('DELETE', `/api/jobs/${currentJob.id}/entries/${entryId}`);
  currentJob = await api('GET', `/api/jobs/${currentJob.id}`);
  renderTimeline();
}

// ── MATERIALS ─────────────────────────────────────────────────────────────────
function showAddMaterialModal() {
  document.getElementById('job-material-search').value = '';
  document.getElementById('job-material-results').innerHTML = '';
  openModal('modal-job-material');
  setTimeout(() => document.getElementById('job-material-search').focus(), 300);
}

let matSearchTimeout;
function searchJobMaterials(val) {
  clearTimeout(matSearchTimeout);
  if (!val) { document.getElementById('job-material-results').innerHTML = ''; return; }
  matSearchTimeout = setTimeout(async () => {
    const results = await api('GET', `/api/products?q=${encodeURIComponent(val)}`);
    const el = document.getElementById('job-material-results');
    if (results.length === 0) { el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:8px">Inga artiklar hittades</div>'; return; }
    el.innerHTML = results.map(p => `
      <div class="search-result-item" onclick="selectJobMaterial(${p.id},'${escHtml(p.e_number)}','${escHtml(p.name)}','${p.unit}')">
        <div class="search-result-name">${escHtml(p.name)}</div>
        <div class="search-result-e">E-nr: ${p.e_number}</div>
      </div>
    `).join('');
  }, 250);
}

let selectedMaterial = null;
function selectJobMaterial(id, e_number, name, unit) {
  selectedMaterial = { id, e_number, name, unit };
  document.getElementById('job-material-selected').innerHTML = `
    <div style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:var(--radius-sm);padding:10px;margin-top:10px">
      <div style="font-weight:600">${escHtml(name)}</div>
      <div style="font-size:12px;color:var(--accent)">E-nr: ${e_number}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
        <label style="font-size:13px">Antal:</label>
        <input type="number" id="mat-qty" value="1" min="0.1" step="0.1" style="width:80px;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px;font-size:14px">
        <span style="font-size:13px;color:var(--muted)">${unit}</span>
      </div>
    </div>
  `;
  document.getElementById('job-material-results').innerHTML = '';
  document.getElementById('job-material-search').value = name;
}

async function addJobMaterial() {
  if (!selectedMaterial) { toast('Välj en artikel','error'); return; }
  const qty = parseFloat(document.getElementById('mat-qty')?.value || 1);
  await api('POST', `/api/jobs/${currentJob.id}/materials`, {
    product_id: selectedMaterial.id,
    e_number: selectedMaterial.e_number,
    product_name: selectedMaterial.name,
    quantity: qty,
    unit: selectedMaterial.unit
  });
  closeModal('modal-job-material');
  selectedMaterial = null;
  currentJob = await api('GET', `/api/jobs/${currentJob.id}`);
  renderMaterials();
  toast('Material tillagt!','success');
}

async function deleteMaterial(matId) {
  await api('DELETE', `/api/jobs/${currentJob.id}/materials/${matId}`);
  currentJob = await api('GET', `/api/jobs/${currentJob.id}`);
  renderMaterials();
}

async function renderJobBookings() {
  const el = document.getElementById('job-bookings');
  if (!el) return;
  try {
    const bookings = await api('GET', `/api/jobs/${currentJob.id}/bookings`);
    if (bookings.length === 0) {
      el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:8px">Inga tider bokade</div>';
      return;
    }
    el.innerHTML = bookings.map(b => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-weight:600;font-size:14px">${escHtml(b.title)}</div>
          <div style="font-size:12px;color:var(--accent);margin-top:2px">
            📅 ${formatDate(b.start_datetime)}${b.end_datetime ? ' → ' + formatDate(b.end_datetime) : ''}
          </div>
          ${b.notes ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${escHtml(b.notes)}</div>` : ''}
        </div>
        <button class="btn btn-xs btn-danger" onclick="deleteBooking(${b.id})">✕</button>
      </div>
    `).join('');
  } catch(e) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px">Kunde inte ladda tider</div>';
  }
}

async function deleteBooking(bookingId) {
  if (!confirm('Ta bort denna bokning?')) return;
  await api('DELETE', `/api/jobs/${currentJob.id}/bookings/${bookingId}`);
  renderJobBookings();
  toast('Bokning borttagen','success');
}

function showAddBookingModal() {
  document.getElementById('booking-title').value = '';
  document.getElementById('booking-start').value = '';
  document.getElementById('booking-end').value = '';
  document.getElementById('booking-notes').value = '';
  openModal('modal-job-booking');
}

async function saveBooking() {
  const title = document.getElementById('booking-title').value.trim();
  const start = document.getElementById('booking-start').value;
  if (!title || !start) { toast('Titel och starttid krävs','error'); return; }
  const end = document.getElementById('booking-end').value;
  const notes = document.getElementById('booking-notes').value.trim();
  try {
    await api('POST', `/api/jobs/${currentJob.id}/bookings`, {
      title, 
      start_datetime: start,
      end_datetime: end || null,
      notes
    });
    closeModal('modal-job-booking');
    renderJobBookings();
    toast('Tid bokad! Läggs till i kalendern automatiskt','success');
  } catch(e) { toast(e.message,'error'); }
}

// ── CREATE / EDIT JOB ─────────────────────────────────────────────────────────
function showNewJobModal() {
  document.getElementById('job-modal-title').textContent = 'Nytt jobb';
  document.getElementById('job-form-id').value = '';
  document.getElementById('job-form-order').value = '';
  document.getElementById('job-form-customer').value = '';
  document.getElementById('job-form-customer-id').value = '';
  const resultsEl = document.getElementById('job-customer-results');
  if (resultsEl) resultsEl.innerHTML = '';
  document.getElementById('job-form-phone').value = '';
  document.getElementById('job-form-address').value = '';
  document.getElementById('job-form-desc').value = '';
  openModal('modal-job-form');
}

function showEditJobModal() {
  if (!currentJob) return;
  document.getElementById('job-modal-title').textContent = 'Redigera jobb';
  document.getElementById('job-form-id').value = currentJob.id;
  document.getElementById('job-form-order').value = currentJob.order_number||'';
  document.getElementById('job-form-customer').value = currentJob.customer_name||'';
  document.getElementById('job-form-phone').value = currentJob.phone||'';
  document.getElementById('job-form-address').value = currentJob.address||'';
  document.getElementById('job-form-desc').value = currentJob.description||'';
  document.getElementById('job-form-deadline').value = currentJob.deadline||'';
  openModal('modal-job-form');
}

async function saveJobForm() {
  const id = document.getElementById('job-form-id').value;
  const body = {
    order_number: document.getElementById('job-form-order').value.trim(),
    customer_name: document.getElementById('job-form-customer').value.trim(),
    phone: document.getElementById('job-form-phone').value.trim(),
    address: document.getElementById('job-form-address').value.trim(),
    description: document.getElementById('job-form-desc').value.trim(),
    deadline: document.getElementById('job-form-deadline').value || null,
    customer_id: document.getElementById('job-form-customer-id')?.value || null
  };
  if (!body.customer_name) { toast('Kundnamn krävs','error'); return; }
  try {
    if (id) {
      await api('PUT', `/api/jobs/${id}`, body);
      toast('Jobb uppdaterat!','success');
      currentJob = await api('GET', `/api/jobs/${id}`);
      renderJobDetail();
    } else {
      const res = await api('POST', '/api/jobs', body);
      toast('Jobb skapat!','success');
      closeModal('modal-job-form');
      openJob(res.id);
      return;
    }
    closeModal('modal-job-form');
  } catch(e) { toast(e.message,'error'); }
}

async function toggleJobShare(id, currentShared) {
  const is_shared = !currentShared;
  await api('POST', `/api/jobs/${id}/share`, { is_shared });
  toast(is_shared ? 'Jobb delas nu med alla' : 'Jobb är nu privat', 'success');
  currentJob = await api('GET', `/api/jobs/${id}`);
  renderJobDetail();
}

async function archiveJob(id) {
  if (!confirm('Arkivera detta jobb?')) return;
  await api('POST', `/api/jobs/${id}/archive`);
  toast('Jobb arkiverat','success');
  closeJobDetail();
}

async function restoreJob(id) {
  await api('POST', `/api/jobs/${id}/restore`);
  toast('Jobb återöppnat!','success');
  currentJob = await api('GET', `/api/jobs/${id}`);
  renderJobDetail();
}

async function deleteJob(id) {
  if (!confirm('Ta bort jobbet permanent? All data raderas.')) return;
  await api('DELETE', `/api/jobs/${id}`);
  toast('Jobb borttaget','success');
  closeJobDetail();
}

// ── IMAGE FULLSCREEN ──────────────────────────────────────────────────────────
function openImageFullscreen(url) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer';
  overlay.innerHTML = `<img src="${imgAuth(url)}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:8px">`;
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

// ── PHOTO GALLERY VIEW ────────────────────────────────────────────────────────
function showPhotoGallery() {
  if (!currentJob) return;
  const photos = currentJob.entries.filter(e => e.type === 'photo' && e.image_url);
  if (photos.length === 0) { toast('Inga foton i detta jobb','warn'); return; }

  const overlay = document.createElement('div');
  overlay.id = 'photo-gallery-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:9000;display:flex;flex-direction:column;overflow:hidden';

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border);flex-shrink:0">
      <h2 style="font-size:18px;font-weight:700">📷 Foton (${photos.length})</h2>
      <button onclick="document.body.removeChild(document.getElementById('photo-gallery-overlay'))" 
        style="background:var(--card2);border:1px solid var(--border);color:var(--text);width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:12px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
        ${photos.map((p, idx) => `
          <div style="position:relative;cursor:pointer;border-radius:10px;overflow:hidden;aspect-ratio:1;background:var(--card2)" onclick="openGalleryPhoto(${idx})">
            <img src="${imgAuth(p.image_url)}" style="width:100%;height:100%;object-fit:cover" loading="lazy">
            ${p.content ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);padding:4px 8px;font-size:11px;color:#fff">${escHtml(p.content)}</div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  window._galleryPhotos = photos;
}

function openGalleryPhoto(idx) {
  const photos = window._galleryPhotos;
  if (!photos) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.97);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center';

  let currentIdx = idx;

  function render() {
    const p = photos[currentIdx];
    overlay.innerHTML = `
      <div style="position:absolute;top:16px;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:0 16px">
        <span style="color:#888;font-size:13px">${currentIdx+1} / ${photos.length}</span>
        <button onclick="this.closest('div').parentElement.remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer">✕</button>
      </div>
      <img src="${imgAuth(p.image_url)}" style="max-width:95vw;max-height:80vh;object-fit:contain;border-radius:8px">
      ${p.content ? `<div style="color:#ccc;font-size:13px;margin-top:12px;text-align:center;padding:0 20px">${escHtml(p.content)}</div>` : ''}
      <div style="color:#666;font-size:11px;margin-top:6px">${formatDate(p.created_at)} · ${escHtml(p.user_name||'')}</div>
      <div style="position:absolute;bottom:24px;display:flex;gap:16px">
        ${currentIdx > 0 ? `<button onclick="navigateGallery(-1)" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:10px 24px;border-radius:24px;font-size:16px;cursor:pointer">← Föregående</button>` : '<span></span>'}
        ${currentIdx < photos.length-1 ? `<button onclick="navigateGallery(1)" style="background:rgba(255,255,255,0.15);border:none;color:#fff;padding:10px 24px;border-radius:24px;font-size:16px;cursor:pointer">Nästa →</button>` : ''}
      </div>
    `;
  }

  window._navigateGallery = (dir) => {
    currentIdx = Math.max(0, Math.min(photos.length-1, currentIdx+dir));
    render();
  };

  // Swipe support
  let touchStartX = 0;
  overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
  overlay.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) window._navigateGallery(diff > 0 ? 1 : -1);
  });

  render();
  document.body.appendChild(overlay);
}

function navigateGallery(dir) { window._navigateGallery(dir); }

// ── NOTES VIEW ────────────────────────────────────────────────────────────────
function showNotesView() {
  if (!currentJob) return;
  const notes = currentJob.entries.filter(e => e.type === 'note');
  if (notes.length === 0) { toast('Inga anteckningar i detta jobb','warn'); return; }

  const overlay = document.createElement('div');
  overlay.id = 'notes-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:9000;display:flex;flex-direction:column;overflow:hidden';

  overlay.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid var(--border);flex-shrink:0">
      <h2 style="font-size:18px;font-weight:700">📝 Anteckningar (${notes.length})</h2>
      <button onclick="document.body.removeChild(document.getElementById('notes-overlay'))"
        style="background:var(--card2);border:1px solid var(--border);color:var(--text);width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    <div style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px">
      ${notes.map(n => `
        <div style="background:var(--card);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--radius);padding:14px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${escHtml(n.user_name||'')} · ${formatDate(n.created_at)}</div>
          <div style="font-size:15px;line-height:1.6;white-space:pre-wrap">${escHtml(n.content)}</div>
        </div>
      `).join('')}
    </div>
    <div style="padding:12px;border-top:1px solid var(--border)">
      <button class="btn btn-accent btn-full" onclick="document.body.removeChild(document.getElementById('notes-overlay'));showAddNoteModal()">+ Ny anteckning</button>
    </div>
  `;

  document.body.appendChild(overlay);
}
