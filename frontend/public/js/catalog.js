// ─── CATALOG MODULE ───────────────────────────────────────────────────────────
let allCategories = [];
let allProducts = [];
let activeCatalogCategory = null;  // full category object
let catalogFilters = {};           // { filter_id: value }
let catalogBrandFilter = null;
let pendingImageData = null;
let currentDetailProductId = null;

// Load categories and products
async function loadCatalog() {
  [allCategories, allProducts] = await Promise.all([
    api('GET', '/api/categories'),
    api('GET', '/api/products')
  ]);
  showCatalogCategories();
}

// ── CATEGORY OVERVIEW ─────────────────────────────────────────────────────────
function showCatalogCategories() {
  activeCatalogCategory = null;
  catalogFilters = {};
  catalogBrandFilter = null;
  document.getElementById('catalog-view-categories').style.display = '';
  document.getElementById('catalog-view-products').style.display = 'none';
  document.getElementById('catalog-global-results').style.display = 'none';
  document.getElementById('catalog-search-global').value = '';
  renderCategoryGrid();
}

function renderCategoryGrid() {
  const grid = document.getElementById('catalog-category-grid');
  // Count products per category
  const counts = {};
  allProducts.forEach(p => { if (p.category_id) counts[p.category_id] = (counts[p.category_id]||0)+1; });

  grid.innerHTML = allCategories.map(cat => `
    <div class="category-tile" onclick="openCategory(${cat.id})">
      <div class="cat-icon">${cat.icon}</div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-count">${counts[cat.id]||0} artiklar</div>
    </div>
  `).join('');
}

// ── CATEGORY PRODUCT VIEW ─────────────────────────────────────────────────────
function openCategory(cat_id) {
  activeCatalogCategory = allCategories.find(c => c.id === cat_id || c.slug === cat_id);
  if (!activeCatalogCategory) return;
  catalogFilters = {};
  catalogBrandFilter = null;

  document.getElementById('catalog-view-categories').style.display = 'none';
  document.getElementById('catalog-view-products').style.display = '';
  document.getElementById('catalog-category-title').textContent = activeCatalogCategory.icon + ' ' + activeCatalogCategory.name;

  renderBrandFilterBar();
  renderAttrFilterBar();
  renderCategoryProductGrid();
}

function renderBrandFilterBar() {
  const el = document.getElementById('catalog-brand-filters');
  // Get brands used in this category
  const catProducts = allProducts.filter(p => p.category_id === activeCatalogCategory.id);
  const brands = [...new Set(catProducts.map(p => p.brand).filter(Boolean))].sort();
  if (brands.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = `<div class="filter-chip-val ${!catalogBrandFilter ? 'active' : ''}" onclick="setCatalogBrand(null)">Alla märken</div>` +
    brands.map(b => `<div class="filter-chip-val ${catalogBrandFilter===b?'active':''}" onclick="setCatalogBrand('${escHtml(b)}')">${b}</div>`).join('');
}

function renderAttrFilterBar() {
  const el = document.getElementById('catalog-attr-filters');
  const filters = (activeCatalogCategory.filters || []).filter(f => f.id !== 'brand');
  if (filters.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = filters.map(f => `
    <div class="filter-group">
      <div class="filter-group-label">${f.label}</div>
      <div class="filter-chips">
        <div class="filter-chip-val ${!catalogFilters[f.id] ? 'active' : ''}" onclick="setCatalogFilter('${f.id}', null)">Alla</div>
        ${f.values.map(v => `<div class="filter-chip-val ${catalogFilters[f.id]===v?'active':''}" onclick="setCatalogFilter('${f.id}','${escHtml(v)}')">${v}</div>`).join('')}
      </div>
    </div>
  `).join('');
}

function setCatalogBrand(brand) {
  catalogBrandFilter = brand;
  renderBrandFilterBar();
  renderCategoryProductGrid();
}

function setCatalogFilter(filter_id, value) {
  if (value === null) delete catalogFilters[filter_id];
  else catalogFilters[filter_id] = value;
  renderAttrFilterBar();
  renderCategoryProductGrid();
}

function renderCategoryProductGrid() {
  const grid = document.getElementById('catalog-product-grid');
  let items = allProducts.filter(p => p.category_id === activeCatalogCategory.id || p.category_id === String(activeCatalogCategory.id));

  if (catalogBrandFilter) items = items.filter(p => p.brand === catalogBrandFilter);

  // Apply attribute filters
  for (const [fid, fval] of Object.entries(catalogFilters)) {
    items = items.filter(p => {
      try {
        const attrs = typeof p.attributes === 'string' ? JSON.parse(p.attributes||'{}') : (p.attributes||{});
        return attrs[fid] === fval;
      } catch(e) { return false; }
    });
  }

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">${activeCatalogCategory.icon}</div>
      <p>Inga produkter matchar filtret</p>
      <button class="btn btn-accent" onclick="showEditProductModal(null)">+ Lägg till produkt</button>
    </div>`;
    return;
  }

  grid.innerHTML = items.map(p => {
    const attrs = (() => { try { return typeof p.attributes === 'string' ? JSON.parse(p.attributes||'{}') : (p.attributes||{}); } catch(e) { return {}; } })();
    const attrTags = Object.values(attrs).filter(Boolean).slice(0,3).map(v => `<span class="brand-badge">${v}</span>`).join(' ');
    return `
    <div class="catalog-card" onclick="showProductDetail(${p.id})">
      <div class="${p.image_url ? 'card-img' : 'card-img no-img'}">
        ${p.image_url ? `<img src="${imgAuth(p.image_url)}" alt="${escHtml(p.name)}" loading="lazy">` : activeCatalogCategory.icon}
      </div>
      <div class="card-body">
        <div class="card-name">${escHtml(p.name)}</div>
        <div class="card-e">E-nr: ${p.e_number}</div>
        ${p.brand ? `<div class="brand-badge">${p.brand}</div>` : ''}
        ${attrTags ? `<div style="margin-top:3px">${attrTags}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="card-action-btn edit" onclick="event.stopPropagation();showEditProductModal(${p.id})">✏️</button>
        <button class="card-action-btn delete" onclick="event.stopPropagation();confirmDeleteProduct(${p.id},'${escHtml(p.name)}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

// ── GLOBAL SEARCH ─────────────────────────────────────────────────────────────
let _searchT;
function globalProductSearch(val) {
  clearTimeout(_searchT);
  const resultsEl = document.getElementById('catalog-global-results');
  const catGrid = document.getElementById('catalog-category-grid');
  if (!val) {
    resultsEl.style.display = 'none';
    catGrid.style.display = '';
    return;
  }
  resultsEl.style.display = '';
  catGrid.style.display = 'none';
  _searchT = setTimeout(() => {
    const q = val.toLowerCase();
    const items = allProducts.filter(p => p.name.toLowerCase().includes(q) || p.e_number.toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q));
    const grid = document.getElementById('catalog-global-grid');
    if (items.length === 0) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Inga produkter hittades</p></div>'; return; }
    grid.innerHTML = items.map(p => {
      const cat = allCategories.find(c => c.id == p.category_id);
      return `<div class="catalog-card" onclick="showProductDetail(${p.id})">
        <div class="${p.image_url ? 'card-img' : 'card-img no-img'}">
          ${p.image_url ? `<img src="${imgAuth(p.image_url)}" loading="lazy">` : (cat?.icon||'📦')}
        </div>
        <div class="card-body">
          <div class="card-name">${escHtml(p.name)}</div>
          <div class="card-e">E-nr: ${p.e_number}</div>
          ${p.brand ? `<div class="brand-badge">${p.brand}</div>` : ''}
          ${cat ? `<div style="font-size:10px;color:var(--muted)">${cat.name}</div>` : ''}
        </div>
        <div class="card-actions">
          <button class="card-action-btn edit" onclick="event.stopPropagation();showEditProductModal(${p.id})">✏️</button>
          <button class="card-action-btn delete" onclick="event.stopPropagation();confirmDeleteProduct(${p.id},'${escHtml(p.name)}')">🗑</button>
        </div>
      </div>`;
    }).join('');
  }, 200);
}

// ── PRODUCT DETAIL ────────────────────────────────────────────────────────────
async function showProductDetail(product_id) {
  currentDetailProductId = product_id;
  const product = await api('GET', `/api/products/${product_id}`);
  const cat = allCategories.find(c => c.id == product.category_id);
  const attrs = typeof product.attributes === 'string' ? JSON.parse(product.attributes||'{}') : (product.attributes||{});

  document.getElementById('detail-product-name').textContent = product.name;

  const attrRows = Object.entries(attrs).filter(([k,v])=>v).map(([k,v]) => {
    const filterDef = cat?.filters?.find(f => f.id === k);
    return `<div class="product-stock-row"><span class="wh-label">${filterDef?.label||k}</span><span style="font-weight:600">${v}</span></div>`;
  }).join('');

  const stockRows = (product.stock||[]).map(s => {
    const cls = s.quantity===0?'out':s.quantity<=s.min_quantity?'low':'';
    return `<div class="product-stock-row">
      <span>${whIcon(s.warehouse_type)} <span class="wh-label">${escHtml(s.warehouse_name)}</span></span>
      <span class="wh-qty ${cls}">${s.quantity} <span style="font-size:12px;font-weight:400">${product.unit}</span></span>
    </div>`;
  }).join('');

  document.getElementById('product-detail-content').innerHTML = `
    ${product.image_url ? `<img src="${imgAuth(product.image_url)}" class="product-detail-img" alt="${escHtml(product.name)}">` : `<div class="product-detail-img no-img">${cat?.icon||'📦'}</div>`}
    <div>
      <div style="font-size:18px;font-weight:700;color:var(--accent)">E-nr: ${product.e_number}</div>
      ${product.brand ? `<div style="font-size:13px;margin-top:2px">${product.brand}</div>` : ''}
      ${cat ? `<div style="font-size:12px;color:var(--muted)">${cat.name}</div>` : ''}
      ${product.description ? `<div style="font-size:13px;color:var(--muted);margin-top:4px">${escHtml(product.description)}</div>` : ''}
    </div>
    ${attrRows ? `<div class="product-stock-list">${attrRows}</div>` : ''}
    ${product.stock?.length>0 ? `<div><div style="font-size:11px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;font-weight:600">Lagersaldo</div><div class="product-stock-list">${stockRows}</div></div>` : '<div style="color:var(--muted);font-size:13px">Ej tillagd i något lager</div>'}
  `;

  const cartBtn = document.getElementById('detail-add-to-cart-btn');
  const inv = activeWarehouse ? (product.stock||[]).find(s => s.warehouse_id===activeWarehouse.id) : null;
  if (inv) {
    cartBtn.textContent = `Lägg i varukorg (${inv.quantity} ${product.unit})`;
    cartBtn.onclick = () => { closeModal('modal-product-detail'); openQtyModal({product_id:product.id,e_number:product.e_number,name:product.name,unit:product.unit,available:inv.quantity},'cart'); };
    cartBtn.disabled = false;
  } else {
    cartBtn.textContent = activeWarehouse ? 'Ej i valt lager' : 'Välj ett lager';
    cartBtn.disabled = true;
  }
  openModal('modal-product-detail');
}

function editCurrentDetailProduct() {
  closeModal('modal-product-detail');
  showEditProductModal(currentDetailProductId);
}

// ── PRODUCT EDIT / CREATE ─────────────────────────────────────────────────────
async function showEditProductModal(product_id) {
  pendingImageData = null;
  document.getElementById('edit-product-id').value = product_id||'';
  document.getElementById('edit-product-title').textContent = product_id ? 'Redigera produkt' : 'Ny produkt';
  document.getElementById('delete-product-btn').style.display = product_id ? 'block' : 'none';

  // Populate category dropdown
  const catSel = document.getElementById('edit-category-id');
  catSel.innerHTML = '<option value="">-- Välj kategori --</option>' +
    allCategories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

  // Populate brand dropdown from database
  const brandSel = document.getElementById('edit-brand');
  try {
    const brandsData = await api('GET', '/api/categories/brands');
    brandSel.innerHTML = '<option value="">-- Välj märke --</option>' +
      brandsData.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
  } catch(e) {
    brandSel.innerHTML = '<option value="">-- Välj märke --</option>';
  }

  if (product_id) {
    const p = await api('GET', `/api/products/${product_id}`);
    const attrs = typeof p.attributes==='string' ? JSON.parse(p.attributes||'{}') : (p.attributes||{});
    document.getElementById('edit-e-number').value = p.e_number;
    document.getElementById('edit-product-name').value = p.name;
    document.getElementById('edit-category-id').value = p.category_id||'';
    document.getElementById('edit-brand').value = p.brand||'';
    document.getElementById('edit-unit').value = p.unit||'st';
    document.getElementById('edit-barcode').value = p.barcode||'';
    document.getElementById('edit-description').value = p.description||'';
    setImagePreview(p.image_url);
    if (p.category_id) renderAttrFields(p.category_id, attrs);
    else document.getElementById('edit-attr-fields').innerHTML = '';
  } else {
    document.getElementById('edit-e-number').value = '';
    document.getElementById('edit-product-name').value = '';
    document.getElementById('edit-category-id').value = activeCatalogCategory?.id||'';
    document.getElementById('edit-brand').value = '';
    document.getElementById('edit-unit').value = 'st';
    document.getElementById('edit-barcode').value = '';
    document.getElementById('edit-description').value = '';
    setImagePreview(null);
    if (activeCatalogCategory) renderAttrFields(activeCatalogCategory.id, {});
    else document.getElementById('edit-attr-fields').innerHTML = '';
  }
  openModal('modal-edit-product');
}

function onCategoryChange(cat_id) {
  renderAttrFields(parseInt(cat_id)||cat_id, {});
}

function renderAttrFields(cat_id, currentAttrs) {
  const cat = allCategories.find(c => c.id == cat_id);
  const el = document.getElementById('edit-attr-fields');
  if (!cat || !cat.filters) { el.innerHTML = ''; return; }
  const filters = cat.filters.filter(f => f.id !== 'brand'); // brand handled separately
  el.innerHTML = filters.map(f => `
    <div class="attr-field">
      <label>${f.label}</label>
      <select id="attr-${f.id}">
        <option value="">-- Välj --</option>
        ${f.values.map(v => `<option value="${v}" ${currentAttrs[f.id]===v?'selected':''}>${v}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function setImagePreview(url) {
  const area = document.getElementById('image-upload-area');
  const img = document.getElementById('edit-product-img-preview');
  if (url) { img.src=url; img.style.display='block'; area.classList.add('has-image'); }
  else { img.src=''; img.style.display='none'; area.classList.remove('has-image'); }
}
function triggerImageUpload() { document.getElementById('image-file-input').click(); }
function changeProductImage() { document.getElementById('image-file-input').click(); }
function removeProductImage() { pendingImageData=null; document.getElementById('edit-product-img-preview').dataset.toDelete='true'; setImagePreview(null); }
function handleImageFile(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 5*1024*1024) { toast('Bilden är för stor (max 5MB)','error'); return; }
  const reader = new FileReader();
  reader.onload = e => { pendingImageData={data:e.target.result,mime:file.type}; setImagePreview(e.target.result); };
  reader.readAsDataURL(file);
  input.value='';
}

async function saveEditProduct() {
  const product_id = document.getElementById('edit-product-id').value;
  const e_number = document.getElementById('edit-e-number').value.trim();
  const name = document.getElementById('edit-product-name').value.trim();
  const cat_id = document.getElementById('edit-category-id').value;
  if (!e_number||!name) { toast('E-nummer och namn krävs','error'); return; }

  // Collect attributes from dynamic fields
  const cat = allCategories.find(c => c.id == cat_id);
  const attributes = {};
  if (cat) {
    for (const f of (cat.filters||[]).filter(f=>f.id!=='brand')) {
      const el = document.getElementById(`attr-${f.id}`);
      if (el && el.value) attributes[f.id] = el.value;
    }
  }

  let image_url = null;
  const imgEl = document.getElementById('edit-product-img-preview');
  const toDelete = imgEl.dataset.toDelete==='true';
  if (pendingImageData) {
    try {
      const res = await api('POST','/api/uploads/product-image',{image_data:pendingImageData.data,mime_type:pendingImageData.mime});
      image_url = res.url;
    } catch(e) { toast('Bilden kunde inte laddas upp','error'); return; }
  } else if (product_id && !toDelete) {
    const existing = allProducts.find(p=>p.id==product_id);
    image_url = existing?.image_url||null;
  }
  if (imgEl) imgEl.dataset.toDelete='';

  const catObj = allCategories.find(c=>c.id===cat_id);
  const body = {
    e_number, name,
    category_id: cat_id||null,
    category: catObj?.name||null,
    brand: document.getElementById('edit-brand').value||null,
    unit: document.getElementById('edit-unit').value,
    barcode: document.getElementById('edit-barcode').value.trim()||null,
    description: document.getElementById('edit-description').value.trim(),
    image_url, attributes
  };

  try {
    if (product_id) {
      await api('PUT',`/api/products/${product_id}`,body);
      toast('Produkt sparad!','success');
    } else {
      const created = await api('POST','/api/products',body);
      toast('Produkt skapad!','success');
      if (activeWarehouse) {
        const add = confirm(`Lägg till "${name}" i ${activeWarehouse.name}?`);
        if (add) { await api('POST','/api/inventory/add-product',{warehouse_id:activeWarehouse.id,product_id:created.id,min_quantity:2}); loadInventory(); }
      }
    }
    closeModal('modal-edit-product');
    pendingImageData=null;
    await loadCatalog();
    loadInventory();
    // If we were in a category view, re-open it
    if (activeCatalogCategory) openCategory(activeCatalogCategory.id);
  } catch(e) { toast(e.message,'error'); }
}

async function deleteProduct() {
  const product_id = document.getElementById('edit-product-id').value;
  const name = document.getElementById('edit-product-name').value;
  if (!confirm(`Ta bort "${name}"?\nProdukten tas bort från alla lager. Historik bevaras.`)) return;
  try {
    await api('DELETE',`/api/products/${product_id}`);
    toast('Produkt borttagen','success');
    closeModal('modal-edit-product');
    await loadCatalog();
    loadInventory();
    if (activeCatalogCategory) openCategory(activeCatalogCategory.id);
  } catch(e) { toast(e.message,'error'); }
}

async function confirmDeleteProduct(product_id, name) {
  if (!confirm(`Ta bort "${name}"?`)) return;
  try {
    await api('DELETE',`/api/products/${product_id}`);
    toast('Produkt borttagen','success');
    await loadCatalog();
    if (activeCatalogCategory) openCategory(activeCatalogCategory.id);
    else renderCategoryGrid();
  } catch(e) { toast(e.message,'error'); }
}

// Patch scanner to handle barcode scan in edit modal
const _baseHandleScannedCode = typeof handleScannedCode !== 'undefined' ? handleScannedCode : null;
window.handleScannedCode = async function(code) {
  if (currentScanTarget === 'edit-barcode-scan') {
    closeScanner();
    document.getElementById('edit-barcode').value = code;
    return;
  }
  if (_baseHandleScannedCode) return _baseHandleScannedCode(code);
};
