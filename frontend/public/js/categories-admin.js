// ─── CATEGORY & BRAND ADMIN ───────────────────────────────────────────────────
let adminCategories = [];
let adminBrands = [];
let editingCategoryId = null;
let editingCategoryFilters = [];

async function loadCategoryAdmin() {
  [adminCategories, adminBrands] = await Promise.all([
    api('GET', '/api/categories'),
    api('GET', '/api/categories/brands')
  ]);
  renderCategoryAdminList();
  renderBrandAdminList();
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
function renderCategoryAdminList() {
  const el = document.getElementById('category-admin-list');
  if (!el) return;

  // Separate top-level and sub categories
  const topLevel = adminCategories.filter(c => !c.parent_id);
  const subCats = adminCategories.filter(c => c.parent_id);

  if (topLevel.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>Inga kategorier</p></div>';
    return;
  }

  el.innerHTML = topLevel.map(cat => {
    const subs = subCats.filter(s => s.parent_id === cat.id);
    return `
    <div class="cat-admin-item">
      <div class="cat-admin-row">
        <span class="cat-admin-icon">${cat.icon}</span>
        <div class="cat-admin-info">
          <div class="cat-admin-name">${escHtml(cat.name)}</div>
          <div class="cat-admin-meta">${subs.length} underkategorier · ${cat.filters?.filter(f=>f.id!=='brand').length||0} filter</div>
        </div>
        <div class="cat-admin-actions">
          <button class="btn btn-xs btn-ghost" onclick="editCategory(${cat.id})">✏️</button>
          <button class="btn btn-xs btn-ghost" onclick="addSubCategory(${cat.id}, '${escHtml(cat.name)}')">+ Sub</button>
          <button class="btn btn-xs btn-danger" onclick="deleteCategory(${cat.id}, '${escHtml(cat.name)}')">🗑</button>
        </div>
      </div>
      ${subs.length > 0 ? `
        <div class="cat-admin-subs">
          ${subs.map(s => `
            <div class="cat-admin-sub-row">
              <span>${s.icon}</span>
              <span style="flex:1;font-size:13px">${escHtml(s.name)}</span>
              <button class="btn btn-xs btn-ghost" onclick="editCategory(${s.id})">✏️</button>
              <button class="btn btn-xs btn-danger" onclick="deleteCategory(${s.id}, '${escHtml(s.name)}')">🗑</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`;
  }).join('');
}

function showAddCategory(parentId, parentName) {
  editingCategoryId = null;
  editingCategoryFilters = [];
  document.getElementById('cat-modal-title').textContent = parentName ? `Ny underkategori i ${parentName}` : 'Ny kategori';
  document.getElementById('cat-edit-name').value = '';
  document.getElementById('cat-edit-icon').value = '📦';
  document.getElementById('cat-edit-parent').value = parentId || '';
  document.getElementById('cat-filter-list').innerHTML = '';
  document.getElementById('cat-modal-error').classList.add('hidden');
  openModal('modal-edit-category');
}

function addSubCategory(parentId, parentName) {
  showAddCategory(parentId, parentName);
}

async function editCategory(id) {
  editingCategoryId = id;
  const cat = adminCategories.find(c => c.id === id);
  if (!cat) return;

  document.getElementById('cat-modal-title').textContent = 'Redigera kategori';
  document.getElementById('cat-edit-name').value = cat.name;
  document.getElementById('cat-edit-icon').value = cat.icon;
  document.getElementById('cat-edit-parent').value = cat.parent_id || '';
  document.getElementById('cat-modal-error').classList.add('hidden');

  // Load filters
  const filters = await api('GET', `/api/categories/${id}/filters`);
  editingCategoryFilters = filters;
  renderFilterEditor();
  openModal('modal-edit-category');
}

async function saveCategory() {
  const errEl = document.getElementById('cat-modal-error');
  errEl.classList.add('hidden');
  const name = document.getElementById('cat-edit-name').value.trim();
  const icon = document.getElementById('cat-edit-icon').value.trim() || '📦';
  const parent_id = document.getElementById('cat-edit-parent').value || null;

  if (!name) { errEl.textContent = 'Namn krävs'; errEl.classList.remove('hidden'); return; }

  try {
    let catId = editingCategoryId;
    if (editingCategoryId) {
      await api('PUT', `/api/categories/${editingCategoryId}`, { name, icon, parent_id });
    } else {
      const res = await api('POST', '/api/categories', { name, icon, parent_id });
      catId = res.id;
    }
    // Save filters
    await api('PUT', `/api/categories/${catId}/filters`, { filters: editingCategoryFilters });
    toast(editingCategoryId ? 'Kategori uppdaterad!' : 'Kategori skapad!', 'success');
    closeModal('modal-edit-category');
    await loadCategoryAdmin();
    if (typeof loadCatalog !== 'undefined') loadCatalog();
  } catch(e) {
    errEl.textContent = e.message; errEl.classList.remove('hidden');
  }
}

async function deleteCategory(id, name) {
  if (!confirm(`Ta bort kategorin "${name}"?\n\nProdukter i kategorin blir okategoriserade.`)) return;
  await api('DELETE', `/api/categories/${id}`);
  toast('Kategori borttagen', 'success');
  await loadCategoryAdmin();
  if (typeof loadCatalog !== 'undefined') loadCatalog();
}

// ── FILTER EDITOR ─────────────────────────────────────────────────────────────
function renderFilterEditor() {
  const el = document.getElementById('cat-filter-list');
  if (!el) return;

  if (editingCategoryFilters.length === 0) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:8px">Inga filter — lägg till nedan</div>';
    return;
  }

  el.innerHTML = editingCategoryFilters.map((f, idx) => `
    <div class="filter-editor-item">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <input type="text" value="${escHtml(f.label)}" placeholder="Filternamn" 
          oninput="updateFilterLabel(${idx}, this.value)"
          style="flex:1;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 10px;font-size:13px">
        <button class="btn btn-xs btn-danger" onclick="removeFilter(${idx})">🗑</button>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Värden (ett per rad):</div>
      <textarea rows="3" placeholder="Värde 1&#10;Värde 2&#10;Värde 3"
        oninput="updateFilterValues(${idx}, this.value)"
        style="width:100%;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 10px;font-size:12px;font-family:monospace;resize:vertical"
      >${(f.values||[]).join('\n')}</textarea>
    </div>
  `).join('');
}

function updateFilterLabel(idx, val) {
  editingCategoryFilters[idx].label = val;
  editingCategoryFilters[idx].filter_id = val.toLowerCase()
    .replace(/å/g,'a').replace(/ä/g,'a').replace(/ö/g,'o')
    .replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
}

function updateFilterValues(idx, val) {
  editingCategoryFilters[idx].values = val.split('\n').map(v=>v.trim()).filter(Boolean);
}

function addFilter() {
  editingCategoryFilters.push({ filter_id: `filter_${Date.now()}`, label: '', values: [] });
  renderFilterEditor();
}

function removeFilter(idx) {
  editingCategoryFilters.splice(idx, 1);
  renderFilterEditor();
}

// ── BRANDS ────────────────────────────────────────────────────────────────────
function renderBrandAdminList() {
  const el = document.getElementById('brand-admin-list');
  if (!el) return;

  if (adminBrands.length === 0) {
    el.innerHTML = '<div style="font-size:13px;color:var(--muted);text-align:center;padding:8px">Inga märken</div>';
    return;
  }

  el.innerHTML = adminBrands.map(b => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="flex:1;font-size:14px">${escHtml(b.name)}</span>
      <button class="btn btn-xs btn-ghost" onclick="editBrand(${b.id}, '${escHtml(b.name)}')">✏️</button>
      <button class="btn btn-xs btn-danger" onclick="deleteBrand(${b.id}, '${escHtml(b.name)}')">🗑</button>
    </div>
  `).join('');
}

function showAddBrand() {
  const name = prompt('Nytt märkesnamn:');
  if (!name?.trim()) return;
  api('POST', '/api/categories/brands', { name: name.trim() })
    .then(() => { toast('Märke tillagt!', 'success'); loadCategoryAdmin(); })
    .catch(e => toast(e.message, 'error'));
}

function editBrand(id, currentName) {
  const name = prompt('Redigera märkesnamn:', currentName);
  if (!name?.trim() || name === currentName) return;
  api('PUT', `/api/categories/brands/${id}`, { name: name.trim() })
    .then(() => { toast('Märke uppdaterat!', 'success'); loadCategoryAdmin(); })
    .catch(e => toast(e.message, 'error'));
}

async function deleteBrand(id, name) {
  if (!confirm(`Ta bort märket "${name}"?`)) return;
  await api('DELETE', `/api/categories/brands/${id}`);
  toast('Märke borttaget', 'success');
  loadCategoryAdmin();
}

function populateCatParentSelect() {
  const sel = document.getElementById('cat-edit-parent');
  if (!sel) return;
  const tops = adminCategories.filter(c => !c.parent_id);
  sel.innerHTML = '<option value="">— Toppnivå —</option>' +
    tops.map(c => `<option value="${c.id}">${c.icon} ${escHtml(c.name)}</option>`).join('');
}
