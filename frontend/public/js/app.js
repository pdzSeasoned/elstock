// ElStock — Frontend App
const API = '';

// ─── OFFLINE-INDIKATOR ───────────────────────────────────────────────────────
let isOffline = false;

function showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.innerHTML = '⚠️ Offline — vissa funktioner kan vara begränsade';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #f5a623; color: #0d0d14; text-align: center;
    padding: 8px 16px; font-size: 14px; font-weight: 600;
    transition: transform 0.3s ease;
  `;
  document.body.appendChild(banner);
}

function hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.remove();
}

function updateOnlineStatus() {
  isOffline = !navigator.onLine;
  if (isOffline) showOfflineBanner();
  else hideOfflineBanner();
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ─── STATE ────────────────────────────────────────────────────────────────────
let token = localStorage.getItem('elstock_token');
let user = JSON.parse(localStorage.getItem('elstock_user') || 'null');
let activeWarehouse = JSON.parse(localStorage.getItem('elstock_warehouse') || 'null');
let warehouses = [];
let inventory = [];
let cart = [];
let restockCart = [];
let currentScanTarget = null;
let scanStream = null;
let scanInterval = null;
let productSearchTarget = null;
let editingWarehouseId = null;
let currentReceiptId = null;
let currentHistoryType = 'checkout';
let activeCategories = new Set();
let activeBrand = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateOnlineStatus();
  if (token && user) showApp();
  else showLogin();
});

async function showApp() {
  checkTokenExpiry();
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  document.getElementById('settings-username').textContent = `${user.display_name} (${user.username})`;
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user.role === 'admin' ? '' : 'none';
  });
  await loadWarehouses();
  showScreen('inventory');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  if (!username || !password) { errEl.textContent = 'Fyll i alla fält'; errEl.classList.remove('hidden'); return; }
  try {
    const res = await api('POST', '/api/auth/login', { username, password }, false);
    token = res.token; user = res.user;
    localStorage.setItem('elstock_token', token);
    localStorage.setItem('elstock_user', JSON.stringify(user));
    await showApp();
  } catch(e) {
    errEl.textContent = e.message || 'Inloggning misslyckades';
    errEl.classList.remove('hidden');
  }
}

function logout() {
  token = null; user = null; activeWarehouse = null;
  localStorage.removeItem('elstock_token');
  localStorage.removeItem('elstock_user');
  localStorage.removeItem('elstock_warehouse');
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
}

async function changePassword() {
  const current = document.getElementById('pw-current').value;
  const newpw = document.getElementById('pw-new').value;
  const errEl = document.getElementById('pw-error');
  errEl.classList.add('hidden');
  try {
    await api('POST', '/api/auth/change-password', { current_password: current, new_password: newpw });
    closeModal('modal-change-pw');
    toast('Lösenord ändrat!', 'success');
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.page-screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.screen === name));
  document.getElementById('warehouse-picker')?.classList.add('hidden');
  if (name === 'inventory') loadInventory();
  if (name === 'history') loadHistory(currentHistoryType);
  if (name === 'notifications') loadNotifications();
  if (name === 'warehouses') loadWarehousesList();
  if (name === 'catalog') { if (typeof loadCatalog !== 'undefined') loadCatalog(); }
  if (name === 'cart') renderCart();
  if (name === 'restock') renderRestockCart();
  if (name === 'settings') { loadSettingsScreen(); loadGeofenceSettings(); if (user?.role === 'admin') setTimeout(loadTechnicianMap, 300); }
  if (name === 'categories') { if (typeof loadCategoryAdmin !== 'undefined') loadCategoryAdmin(); populateCatParentSelect(); }
  if (name === 'permissions') { if (typeof loadPermissionsScreen !== 'undefined') loadPermissionsScreen(); }
  if (name === 'jobs') { if (typeof loadJobs !== 'undefined') loadJobs('active'); }
  if (name === 'customers') { if (typeof loadCustomers !== 'undefined') loadCustomers(); }
  if (name === 'calendar') { if (typeof loadCalendar !== 'undefined') { calSelectedDate = calSelectedDate || new Date().toISOString().substring(0,10); loadCalendar(); } }
  if (name === 'users') loadUsersScreen();
  if (name === 'trips') { loadTrips(); loadTripsUserFilter(); }
  if (name === 'equipment') { loadEquipmentList(); setTimeout(loadEquipmentMap, 300); if (user?.role === 'admin') loadEquipmentAdmin(); }
}

// ─── WAREHOUSES ───────────────────────────────────────────────────────────────
async function loadWarehouses() {
  warehouses = await api('GET', '/api/warehouses');
  renderWarehousePicker();
  if (!activeWarehouse && warehouses.length > 0) setActiveWarehouse(warehouses[0]);
  else if (activeWarehouse) {
    const updated = warehouses.find(w => w.id === activeWarehouse.id);
    if (updated) setActiveWarehouse(updated);
  }
}

function renderWarehousePicker() {
  const list = document.getElementById('warehouse-list');
  list.innerHTML = warehouses.map(w => `
    <div class="warehouse-card ${activeWarehouse?.id === w.id ? 'active' : ''}" onclick="setActiveWarehouse(${JSON.stringify(w).replace(/"/g, '&quot;')})">
      <div class="wh-icon">${whIcon(w.type)}</div>
      <div class="wh-info">
        <div class="wh-name">${escHtml(w.name)}</div>
        <div class="wh-meta">${w.product_count} artiklar${w.low_stock_count > 0 ? ` · ⚠️ ${w.low_stock_count} lågt` : ''}</div>
      </div>
    </div>
  `).join('');
}

function setActiveWarehouse(wh) {
  if (typeof wh === 'string') wh = JSON.parse(wh);
  activeWarehouse = wh;
  localStorage.setItem('elstock_warehouse', JSON.stringify(wh));
  document.getElementById('active-warehouse-name').textContent = wh.name;
  document.getElementById('warehouse-picker').classList.add('hidden');
  loadInventory();
}

function toggleWarehousePicker() {
  const picker = document.getElementById('warehouse-picker');
  picker.classList.toggle('hidden');
  renderWarehousePicker();
}

function whIcon(type) {
  return { car:'🚐', garage:'🏠', warehouse:'🏭', other:'📦' }[type] || '📦';
}

async function loadWarehousesList() {
  await loadWarehouses();
  const list = document.getElementById('warehouses-list');
  list.innerHTML = warehouses.map(w => `
    <div class="warehouse-card">
      <div class="wh-icon">${whIcon(w.type)}</div>
      <div class="wh-info">
        <div class="wh-name">${escHtml(w.name)}</div>
        <div class="wh-meta">${w.product_count} artiklar · ${w.low_stock_count} lågt lager</div>
      </div>
      <div class="wh-actions admin-only">
        <button class="btn-icon" onclick="editWarehouse(${w.id},'${escHtml(w.name)}','${w.type}','${escHtml(w.description||'')}")">✏️</button>
        <button class="btn-icon btn-danger" onclick="deleteWarehouse(${w.id})">🗑️</button>
      </div>
    </div>
  `).join('');
  document.querySelectorAll('.admin-only').forEach(el => { el.style.display = user.role==='admin' ? '' : 'none'; });
}

function showAddWarehouse() { editingWarehouseId=null; document.getElementById('wh-modal-title').textContent='Nytt lager'; document.getElementById('new-wh-name').value=''; document.getElementById('new-wh-type').value='car'; document.getElementById('new-wh-desc').value=''; document.getElementById('save-wh-btn').textContent='Skapa lager'; openModal('modal-add-warehouse'); }

function editWarehouse(id, name, type, desc) { editingWarehouseId=id; document.getElementById('wh-modal-title').textContent='Redigera lager'; document.getElementById('new-wh-name').value=name; document.getElementById('new-wh-type').value=type; document.getElementById('new-wh-desc').value=desc; document.getElementById('save-wh-btn').textContent='Spara ändringar'; openModal('modal-add-warehouse'); }

async function saveWarehouse() {
  const name = document.getElementById('new-wh-name').value.trim();
  if (!name) { toast('Ange ett namn','error'); return; }
  const body = { name, type: document.getElementById('new-wh-type').value, description: document.getElementById('new-wh-desc').value };
  if (editingWarehouseId) await api('PUT', `/api/warehouses/${editingWarehouseId}`, body);
  else await api('POST', '/api/warehouses', body);
  toast(editingWarehouseId ? 'Lager uppdaterat' : 'Lager skapat!', 'success');
  closeModal('modal-add-warehouse');
  await loadWarehousesList();
}

async function deleteWarehouse(id) {
  if (!confirm('Ta bort detta lager?')) return;
  await api('DELETE', `/api/warehouses/${id}`);
  toast('Lager borttaget','success');
  if (activeWarehouse?.id === id) activeWarehouse = null;
  await loadWarehousesList(); await loadWarehouses();
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
async function loadInventory() {
  if (!activeWarehouse) { document.getElementById('inventory-list').innerHTML = '<div class="empty"><div class="empty-icon">🏭</div><div>Välj ett lager ovan</div></div>'; return; }
  const data = await api('GET', `/api/warehouses/${activeWarehouse.id}`);
  inventory = data.inventory || [];
  renderInventory();
  renderCategoryFilters();
  updateLowStockBanner();
}

function renderInventory(filter='') {
  const list = document.getElementById('inventory-list');
  let items = inventory;
  if (filter) items = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()) || i.e_number.toLowerCase().includes(filter.toLowerCase()));
  if (activeCategories.size > 0) items = items.filter(i => activeCategories.has(i.category));
  if (activeBrand) items = items.filter(i => i.brand === activeBrand);
  if (items.length === 0) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div>Inga artiklar</div></div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const pct = item.min_quantity > 0 ? Math.min(100, (item.quantity / (item.min_quantity * 3)) * 100) : 100;
    const cls = item.quantity === 0 ? 'out-of-stock' : item.quantity <= item.min_quantity ? 'low-stock' : '';
    const qtyCls = item.quantity === 0 ? 'out' : item.quantity <= item.min_quantity ? 'low' : '';
    const barCls = item.quantity === 0 ? 'out' : item.quantity <= item.min_quantity ? 'low' : '';
    return `
      <div class="inventory-item ${cls}" onclick="inventoryItemClick(${item.product_id})">
        <div class="inv-image">${item.image_url ? `<img src="${imgAuth(item.image_url)}" loading="lazy" alt="">` : categoryIcon(item.category)}</div>
        <div class="inv-info">
          <div class="inv-name">${escHtml(item.name)}</div>
          <div class="inv-meta">E-nr: ${escHtml(item.e_number)}${item.category ? ` · ${escHtml(item.category)}` : ''} · Min: ${item.min_quantity} ${item.unit}</div>
          <div class="inv-bar"><div class="inv-bar-fill ${barCls}" style="width:${pct}%"></div></div>
        </div>
        <div class="inv-qty ${qtyCls}">${item.quantity}<span class="inv-unit">${item.unit}</span></div>
      </div>
    `;
  }).join('');
}

function inventoryItemClick(product_id) {
  const item = inventory.find(i => i.product_id === product_id);
  if (!item) return;
  document.getElementById('qty-modal-title').textContent = item.name;
  document.getElementById('qty-modal-info').innerHTML = `
    <strong>E-nr: ${item.e_number}</strong><br>
    Saldo: <strong>${item.quantity} ${item.unit}</strong> · Larm vid: ${item.min_quantity}
    ${item.description ? `<br><br><div style="font-size:13px;color:var(--text-muted)">${escHtml(item.description)}</div>` : ''}
  `;
  document.querySelector('.qty-controls').style.display = 'none';
  document.querySelector('#modal-quantity .modal-actions').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal-quantity')">Stäng</button>
    <button class="btn btn-secondary" onclick="pickInventoryQuantity(${item.product_id}, 'restock')">🔄 Fyll på</button>
    <button class="btn btn-primary" onclick="pickInventoryQuantity(${item.product_id}, 'cart')">➕ Lägg till i varukorg</button>
  `;
  document.querySelectorAll('#modal-quantity .admin-only').forEach(el => { el.style.display = user.role==='admin' ? '' : 'none'; });
  openModal('modal-quantity');
}

// Steg 2 (efter att man valt Fyll på / Lägg till i varukorg): visa
// antalsväljaren med en egen bekräfta-knapp. Bygger INTE på openQtyModal/
// confirmQty eftersom det delade flödet har en egen bugg på annat håll i
// appen (se openQtyModal nedan) — det här är ett helt fristående, enkelt
// spår så det inte ärver det problemet.
function pickInventoryQuantity(product_id, target) {
  const item = inventory.find(i => i.product_id === product_id);
  if (!item) return;
  inventoryQtyContext = { item, target };
  document.getElementById('qty-modal-info').innerHTML = `
    <strong>E-nr: ${item.e_number}</strong><br>
    ${target === 'restock' ? 'Antal att fylla på:' : 'Antal att lägga i varukorgen:'}
  `;
  document.getElementById('qty-input').value = 1;
  document.querySelector('.qty-controls').style.display = 'flex';
  const label = target === 'restock' ? '🔄 Fyll på' : '➕ Lägg till i varukorg';
  document.querySelector('#modal-quantity .modal-actions').innerHTML = `
    <button class="btn btn-secondary" onclick="closeModal('modal-quantity')">Avbryt</button>
    <button class="btn btn-primary" onclick="confirmInventoryQuantity()">${label}</button>
  `;
}

async function confirmInventoryQuantity() {
  const qty = parseFloat(document.getElementById('qty-input').value);
  if (isNaN(qty) || qty <= 0) { toast('Ange ett antal','error'); return; }
  const { item, target } = inventoryQtyContext;
  if (target === 'restock') {
    // Fyller på direkt i det aktiva lagret — ingen bekräftelsekö. Fliken
    // "Fyll på" är till för sånt som INTE normalt ligger i bilen/lagret,
    // så den här snabbknappen ska inte gå via samma kö.
    try {
      await api('POST', '/api/inventory/restock', {
        warehouse_id: activeWarehouse.id,
        items: [{ product_id: item.product_id, quantity: qty }]
      });
      toast(`${item.name} påfylld (+${qty} ${item.unit})`, 'success');
      loadInventory();
    } catch(e) {
      toast(e.message, 'error');
    }
  } else {
    const product = { product_id: item.product_id, name: item.name, e_number: item.e_number, unit: item.unit };
    addToCart(product, qty);
  }
  closeModal('modal-quantity');
}

function filterInventory(val) { renderInventory(val); }

function renderCategoryFilters() {
  // Hämta unika kategorier från databasen
  const dbCats = [...new Set(inventory.map(i => i.category).filter(Boolean))];

  // Hämta unika varumärken
  const brands = [...new Set(inventory.map(i => i.brand).filter(Boolean))].sort();

  const el = document.getElementById('category-filters');

  // Bygg HTML: Varumärken-dropdown + kategori-knappar
  let html = '';

  // ── VARUMÄRKEN DROPDOWN ──
  html += `<select id="brand-filter" class="brand-select" onchange="setBrand(this.value)" style="background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:20px;padding:6px 14px;font-size:13px;font-family:var(--font);margin-right:8px;cursor:pointer;outline:none;">`;
  html += `<option value="" ${!activeBrand ? 'selected' : ''}>Varumärken</option>`;
  for (const b of brands) {
    html += `<option value="${escHtml(b)}" ${activeBrand === b ? 'selected' : ''}>${escHtml(b)}</option>`;
  }
  html += `</select>`;

  // ── KATEGORI-KNAPPAR ──
  html += `<button class="cat-filter ${activeCategories.size === 0 && !activeBrand ? 'active' : ''}" onclick="setCategory(null)">Alla</button>`;

  for (const cat of dbCats) {
    const isActive = activeCategories.has(cat);
    html += `<button class="cat-filter ${isActive ? 'active' : ''}" onclick="setCategory('${escHtml(cat)}')">${escHtml(cat)}</button>`;
  }

  el.innerHTML = html;
}
function setCategory(cat) {
  if (cat === null) {
    activeCategories.clear();
  } else {
    if (activeCategories.has(cat)) {
      activeCategories.delete(cat);
    } else {
      activeCategories.add(cat);
    }
  }
  renderCategoryFilters();
  renderInventory(document.getElementById('inventory-search')?.value||'');
}

function setBrand(brand) {
  activeBrand = brand || null;
  renderCategoryFilters();
  renderInventory(document.getElementById('inventory-search')?.value||'');
}

function updateLowStockBanner() {
  const low = inventory.filter(i => i.quantity <= i.min_quantity);
  const banner = document.getElementById('low-stock-banner');
  const badge = document.getElementById('notif-badge');
  if (low.length > 0) {
    banner.classList.remove('hidden');
    document.getElementById('low-stock-count').textContent = low.length;
    badge.textContent = low.length; badge.classList.remove('hidden');
  } else { banner.classList.add('hidden'); badge.classList.add('hidden'); }
}

function editInventoryThreshold(product_id) {
  closeModal('modal-quantity');
  const item = inventory.find(i => i.product_id === product_id);
  const val = prompt(`Ny larmgräns för ${item.name} (nuvarande: ${item.min_quantity}):`);
  if (val !== null && !isNaN(parseFloat(val))) {
    api('POST','/api/inventory/threshold',{warehouse_id:activeWarehouse.id,product_id,min_quantity:parseFloat(val)})
    .then(()=>{ toast('Larmgräns uppdaterad','success'); loadInventory(); });
  }
}

function editInventoryQty(product_id) {
  closeModal('modal-quantity');
  const item = inventory.find(i => i.product_id === product_id);
  const val = prompt(`Nytt saldo för ${item.name} (nuvarande: ${item.quantity}):`);
  if (val !== null && !isNaN(parseFloat(val))) {
    api('POST','/api/inventory/set',{warehouse_id:activeWarehouse.id,product_id,quantity:parseFloat(val),min_quantity:item.min_quantity})
    .then(()=>{ toast('Saldo uppdaterat','success'); loadInventory(); });
  }
}

async function removeFromWarehouse(product_id) {
  if (!confirm('Ta bort artikel från detta lager?')) return;
  closeModal('modal-quantity');
  await api('DELETE',`/api/inventory/${activeWarehouse.id}/${product_id}`);
  toast('Artikel borttagen','success'); loadInventory();
}

async function showAddProductToWarehouse() {
  if (!activeWarehouse) { toast('Välj ett lager först','error'); return; }
  openProductSearch('add-to-warehouse');
}

// ─── PRODUCT SEARCH ───────────────────────────────────────────────────────────
let searchTimeout;
function openProductSearch(target) {
  productSearchTarget = target;
  document.getElementById('product-search-input').value = '';
  document.getElementById('product-search-results').innerHTML = '';
  openModal('modal-product-search');
  setTimeout(() => document.getElementById('product-search-input').focus(), 300);
}

function searchProducts(val) {
  clearTimeout(searchTimeout);
  if (val.length < 1) { document.getElementById('product-search-results').innerHTML=''; return; }
  searchTimeout = setTimeout(async () => {
    const results = await api('GET', `/api/products?q=${encodeURIComponent(val)}`);
    const el = document.getElementById('product-search-results');
    if (results.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><div>Ingen artikel hittades</div></div>';
      return;
    }
    el.innerHTML = results.map(p => {
      const inv = activeWarehouse ? inventory.find(i => i.product_id === p.id) : null;
      const stockText = inv ? `Saldo: ${inv.quantity} ${p.unit}` : 'Ej i detta lager';
      return `
        <div class="search-result" onclick="handleProductSelect(${p.id},'${escHtml(p.e_number)}','${escHtml(p.name)}','${p.unit}',${inv?.quantity||0})">
          <div class="search-result-name">${escHtml(p.name)}</div>
          <div class="search-result-meta">E-nr: ${p.e_number} · ${stockText}</div>
        </div>
      `;
    }).join('');
  }, 250);
}

async function handleProductSelect(id, e_number, name, unit, available) {
  closeModal('modal-product-search');
  if (productSearchTarget === 'cart') openQtyModal({product_id:id,e_number,name,unit,available},'cart');
  else if (productSearchTarget === 'restock') openQtyModal({product_id:id,e_number,name,unit},'restock');
  else if (productSearchTarget === 'add-to-warehouse') {
    const minVal = prompt(`Larmgräns för "${name}" i ${activeWarehouse.name}:`, '2');
    if (minVal === null) return;
    await api('POST','/api/inventory/add-product',{warehouse_id:activeWarehouse.id,product_id:id,min_quantity:parseFloat(minVal)||2});
    toast(`${name} tillagd i lagret`,'success'); loadInventory();
  }
}

// ─── QTY MODAL ────────────────────────────────────────────────────────────────
let qtyContext = null;
let inventoryQtyContext = null;
function openQtyModal(product, target) {
  qtyContext = { product, target };
  document.getElementById('qty-modal-title').textContent = product.name;
  document.getElementById('qty-modal-info').textContent = `E-nr: ${product.e_number}${product.available !== undefined ? ` · Tillgängligt: ${product.available} ${product.unit}` : ''}`;
  document.getElementById('qty-input').value = 1;
  document.querySelector('.qty-controls').style.display = 'flex';
  document.querySelector('#modal-quantity .modal-actions').innerHTML = `<button class="btn btn-primary btn-full" onclick="confirmQty()">Lägg till</button>`;
  openModal('modal-quantity');
}

function adjustQty(delta) {
  const inp = document.getElementById('qty-input');
  inp.value = Math.max(0.1, parseFloat(inp.value||1) + delta);
}

function confirmQty() {
  const qty = parseFloat(document.getElementById('qty-input').value);
  if (isNaN(qty) || qty <= 0) { toast('Ange ett antal','error'); return; }
  const { product, target } = qtyContext;
  if (target === 'cart') addToCart(product, qty);
  else if (target === 'restock') addToRestockCart(product, qty);
  closeModal('modal-quantity');
}

// ─── CART ─────────────────────────────────────────────────────────────────────
function addToCart(product, quantity) {
  const existing = cart.find(c => c.product_id === product.product_id);
  if (existing) existing.quantity += quantity;
  else cart.push({ ...product, quantity });
  toast(`${product.name} tillagd`,'success');
  updateCartBadge(); renderCart();
}

function renderCart() {
  const list = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const footer = document.getElementById('cart-footer');
  if (cart.length === 0) { list.innerHTML=''; empty.classList.remove('hidden'); footer.classList.add('hidden'); return; }
  empty.classList.add('hidden'); footer.classList.remove('hidden');
  list.innerHTML = cart.map((item,idx) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-meta">E-nr: ${item.e_number}</div>
      </div>
      <div class="cart-item-qty">
        <button class="btn-icon" onclick="changeCartQty(${idx},-1)">−</button>
        <span>${item.quantity}</span>
        <button class="btn-icon" onclick="changeCartQty(${idx},1)">+</button>
      </div>
      <button class="btn-icon btn-danger" onclick="removeFromCart(${idx})">🗑️</button>
    </div>
  `).join('');
  document.getElementById('cart-item-count').textContent = `${cart.length} artiklar`;
}

function changeCartQty(idx, delta) { cart[idx].quantity = Math.max(0.1, cart[idx].quantity+delta); renderCart(); updateCartBadge(); }
function removeFromCart(idx) { cart.splice(idx,1); renderCart(); updateCartBadge(); }
function clearCart() { if (confirm('Rensa varukorgen?')) { cart=[]; renderCart(); updateCartBadge(); } }
function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (cart.length>0) { badge.textContent=cart.length; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

// ─── CHECKOUT ─────────────────────────────────────────────────────────────────
async function showCheckout() {
  if (!activeWarehouse) { toast('Välj ett lager','error'); return; }
  let activeJobs = [];
  try { activeJobs = await api('GET', '/api/jobs?status=active'); } catch(e) {}
  const jobPickerEl = document.getElementById('checkout-job-picker');
  if (activeJobs.length > 0) {
    jobPickerEl.innerHTML = `
      <div style="margin-bottom:12px"><strong>VÄLJ AKTIVT JOBB (valfritt)</strong></div>
      <div class="job-select-option" onclick="selectCheckoutJob(null,'','','')" style="border:2px solid var(--accent);padding:10px;border-radius:8px;margin-bottom:8px;cursor:pointer">
        <div style="font-weight:600">✏️ Fyll i manuellt</div>
      </div>
      ${activeJobs.map(j => `
        <div class="job-select-option" id="job-opt-${j.id}" onclick="selectCheckoutJob(${j.id},'${escHtml(j.customer_name)}','${escHtml(j.address||'')}', '${escHtml(j.order_number||'')}' )" style="border:2px solid var(--border);padding:10px;border-radius:8px;margin-bottom:8px;cursor:pointer">
          <div style="font-weight:600">${escHtml(j.customer_name)}</div>
          <div style="font-size:13px;color:var(--text-muted)">${j.order_number ? 'AO: '+j.order_number+' · ' : ''}${escHtml(j.address||'')}</div>
        </div>
      `).join('')}
    `;
    jobPickerEl.style.display = '';
  } else {
    jobPickerEl.style.display = 'none';
  }
  document.getElementById('checkout-items-summary').innerHTML = cart.map(i => `
    <div class="checkout-item">
      <div class="checkout-item-name">${i.e_number} ${escHtml(i.name)}</div>
      <div class="checkout-item-qty">${i.quantity} ${i.unit}</div>
    </div>
  `).join('');
  openModal('modal-checkout');
}

let checkoutSelectedJob = null;

function selectCheckoutJob(id, customer, address, order) {
  checkoutSelectedJob = id;
  document.querySelectorAll('.job-select-option').forEach(el => { el.style.borderColor = 'var(--border)'; });
  if (id) {
    document.getElementById(`job-opt-${id}`)?.style.setProperty('border-color','var(--accent)');
    document.getElementById('checkout-customer').value = customer || '';
    document.getElementById('checkout-address').value = address || '';
    document.getElementById('checkout-workorder').value = order || '';
    document.getElementById('checkout-manual-fields').style.display = 'none';
  } else {
    document.querySelector('.job-select-option')?.style.setProperty('border-color','var(--accent)');
    checkoutSelectedJob = null;
    document.getElementById('checkout-manual-fields').style.display = '';
    document.getElementById('checkout-customer').value = '';
    document.getElementById('checkout-address').value = '';
    document.getElementById('checkout-workorder').value = '';
  }
}

async function submitCheckout() {
  if (!activeWarehouse) { toast('Välj ett lager','error'); return; }
  try {
    const res = await api('POST','/api/transactions/checkout',{
      warehouse_id: activeWarehouse.id,
      customer_name: document.getElementById('checkout-customer').value,
      customer_address: document.getElementById('checkout-address').value,
      work_order: document.getElementById('checkout-workorder').value,
      notes: document.getElementById('checkout-notes').value,
      items: cart.map(c => ({ product_id:c.product_id, quantity:c.quantity }))
    });
    if (checkoutSelectedJob) {
      for (const item of cart) {
        await api('POST', `/api/jobs/${checkoutSelectedJob}/materials`, {
          product_id: item.product_id,
          e_number: item.e_number,
          product_name: item.name,
          quantity: item.quantity,
          unit: item.unit
        }).catch(()=>{});
      }
      toast('Material tillagt på jobbet!','success');
    }
    closeModal('modal-checkout');
    checkoutSelectedJob = null;
    cart=[]; updateCartBadge(); renderCart();
    showReceipt(res.receipt);
    loadInventory();
    if (res.low_stock_warnings?.length>0) setTimeout(()=>toast(`⚠️ ${res.low_stock_warnings.length} artikel(ar) håller på att ta slut!`,'warn'),1000);
  } catch(e) { toast(e.message,'error'); }
}

function showReceipt(receipt) {
  currentReceiptId = receipt.id;
  document.getElementById('receipt-content').innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:28px;font-weight:700;color:var(--accent)">ELSTOCK</div>
      <div style="font-size:14px;color:var(--text-muted);margin-top:4px">${receipt.warehouse}</div>
    </div>
    <div style="border-top:1px dashed var(--border);margin:12px 0"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
      <div><strong>Datum</strong><br>${formatDate(receipt.date)}</div>
      <div><strong>Tekniker</strong><br>${receipt.user}</div>
      ${receipt.customer_name?`<div><strong>Kund</strong><br>${escHtml(receipt.customer_name)}</div>`:''}
      ${receipt.customer_address?`<div><strong>Adress</strong><br>${escHtml(receipt.customer_address)}</div>`:''}
      ${receipt.work_order?`<div><strong>AO-nr</strong><br>${escHtml(receipt.work_order)}</div>`:''}
    </div>
    <div style="border-top:1px dashed var(--border);margin:12px 0"></div>
    <div style="font-weight:600;margin-bottom:8px">UTTAGNA ARTIKLAR</div>
    ${receipt.items.map(i=>`
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light)">
        <div>${i.e_number} ${escHtml(i.name)}</div>
        <div style="font-weight:600">${i.quantity} ${i.unit}</div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">E-nummer: ${i.e_number}</div>
    `).join('')}
    <div style="border-top:1px dashed var(--border);margin:12px 0"></div>
    <div style="text-align:center;font-size:12px;color:var(--text-muted)">Kvitto #${receipt.id} · ElStock</div>
  `;
  openModal('modal-receipt');
}

function printReceipt() {
  const content = document.getElementById('receipt-content').innerText;
  if (navigator.share) navigator.share({ title:'ElStock Kvitto', text:content }).catch(()=>{});
  else window.print();
}

async function downloadReceiptPDF() {
  if (!currentReceiptId) { toast('Inget kvitto valt', 'error'); return; }
  try {
    const res = await fetch(`/api/transactions/${currentReceiptId}/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Kunde inte generera PDF');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kvitto-${currentReceiptId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch(e) { toast(e.message, 'error'); }
}

// ─── RESTOCK ──────────────────────────────────────────────────────────────────
function addToRestockCart(product, quantity) {
  const existing = restockCart.find(c => c.product_id === product.product_id);
  if (existing) existing.quantity += quantity;
  else restockCart.push({ ...product, quantity });
  toast(`${product.name} tillagd`,'success'); renderRestockCart();
}

function renderRestockCart() {
  const list = document.getElementById('restock-list');
  const empty = document.getElementById('restock-empty');
  const footer = document.getElementById('restock-footer');
  if (restockCart.length===0) { list.innerHTML=''; empty.classList.remove('hidden'); footer.classList.add('hidden'); return; }
  empty.classList.add('hidden'); footer.classList.remove('hidden');
  list.innerHTML = restockCart.map((item,idx) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-meta">E-nr: ${item.e_number}</div>
      </div>
      <div class="cart-item-qty">
        <button class="btn-icon" onclick="changeRestockQty(${idx},-1)">−</button>
        <span>${item.quantity}</span>
        <button class="btn-icon" onclick="changeRestockQty(${idx},1)">+</button>
      </div>
      <button class="btn-icon btn-danger" onclick="removeFromRestock(${idx})">🗑️</button>
    </div>
  `).join('');
}

function changeRestockQty(idx,delta) { restockCart[idx].quantity=Math.max(1,restockCart[idx].quantity+delta); renderRestockCart(); }
function removeFromRestock(idx) { restockCart.splice(idx,1); renderRestockCart(); }

async function confirmRestock() {
  if (!activeWarehouse) { toast('Välj ett lager','error'); return; }
  try {
    const res = await api('POST','/api/inventory/restock',{warehouse_id:activeWarehouse.id,items:restockCart.map(c=>({product_id:c.product_id,quantity:c.quantity}))});
    toast(`Påfyllning bekräftad! #${res.transaction_id}`,'success');
    restockCart=[]; renderRestockCart(); loadInventory();
  } catch(e) { toast(e.message,'error'); }
}

// ─── HISTORY ──────────────────────────────────────────────────────────────────
async function loadHistory(type, tabEl) {
  currentHistoryType = type;
  if (tabEl) { document.querySelectorAll('#history-filter-tabs .tab').forEach(t=>t.classList.remove('active')); tabEl.classList.add('active'); }
  const wh = activeWarehouse ? `&warehouse_id=${activeWarehouse.id}` : '';
  const txs = await api('GET',`/api/transactions/history?type=${type}${wh}&limit=50`);
  const list = document.getElementById('history-list');
  if (txs.length===0) { list.innerHTML='<div class="empty"><div class="empty-icon">📋</div><div>Inga poster ännu</div></div>'; return; }
  list.innerHTML = txs.map(tx => `
    <div class="history-item" onclick="viewReceipt(${tx.id})">
      <div class="history-header">
        <span class="history-id">#${tx.id} ${type==='restock'?'📦 Påfyllning':'🔧 Uttag'}</span>
        <span class="history-date">${formatDate(tx.created_at)}</span>
      </div>
      ${tx.customer_name?`<div class="history-customer">${escHtml(tx.customer_name)}</div>`:''}
      ${tx.work_order?`<div class="history-meta">AO: ${escHtml(tx.work_order)}</div>`:''}
      <div class="history-items">
        ${tx.items.map(i=>`${i.e_number} ${i.product_name}`).join(', ')}
      </div>
      <div class="history-footer">👤 ${tx.user_name}
        ${user.role==='admin'?`<button class="btn-icon btn-danger" style="margin-left:auto" onclick="event.stopPropagation();deleteTransaction(${tx.id},'${type}')">🗑️</button>`:''}
      </div>
    </div>
  `).join('');
}

async function viewReceipt(id) {
  const tx = await api('GET',`/api/transactions/${id}`);
  showReceipt({ id:tx.id, date:tx.created_at, warehouse:tx.warehouse_name, user:tx.user_name, customer_name:tx.customer_name, customer_address:tx.customer_address, work_order:tx.work_order, items:tx.items });
}

async function deleteTransaction(id, type) {
  const msg = type==='checkout' ? 'Ta bort detta kvitto?\n\n⚠️ Lagersaldot återställs automatiskt!' : 'Ta bort denna påfyllning?';
  if (!confirm(msg)) return;
  try {
    const res = await api('DELETE',`/api/transactions/${id}`);
    toast(res.stock_restored ? 'Kvitto borttaget · Lager återställt' : 'Post borttagen','success');
    loadHistory(currentHistoryType);
    if (res.stock_restored) loadInventory();
  } catch(e) { toast(e.message,'error'); }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
async function loadNotifications() {
  const low = await api('GET','/api/inventory/low-stock');
  const el = document.getElementById('notifications-list');
  if (low.length===0) { el.innerHTML='<div class="empty"><div class="empty-icon">✅</div><div>Allt ser bra ut!</div></div>'; return; }
  const grouped = {};
  for (const item of low) { if (!grouped[item.warehouse_name]) grouped[item.warehouse_name]=[]; grouped[item.warehouse_name].push(item); }
  el.innerHTML = Object.entries(grouped).map(([wh,items])=>`
    <div class="notif-group">
      <div class="notif-group-title">${wh}</div>
      ${items.map(i=>`
        <div class="notif-item">
          <div class="notif-icon">${i.quantity===0?'🔴':'🟡'}</div>
          <div class="notif-info">
            <div class="notif-name">${escHtml(i.name)}</div>
            <div class="notif-meta">E-nr: ${i.e_number} · Min: ${i.min_quantity} ${i.unit}</div>
          </div>
          <div class="notif-qty">${i.quantity} ${i.unit}</div>
        </div>
      `).join('')}</div>
  `).join('');
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
async function loadSettingsScreen() {
  document.getElementById('settings-username').textContent = `${user.display_name} (${user.username})`;
  try {
    if (user.role === 'admin') {
      const ns = await api('GET','/api/notifications/settings');
      document.getElementById('notif-status-email').textContent = ns.email_enabled ? `✓ ${ns.email_to}` : 'Ej konfigurerat';
      document.getElementById('notif-status-telegram').textContent = ns.telegram_enabled ? `✓ Chat ID: ${ns.telegram_chat_id}` : 'Ej konfigurerat';
      document.getElementById('notif-status-push').textContent = ns.push_enabled ? '✓ Konfigurerat' : 'Ej konfigurerat (VAPID saknas)';
    }
  } catch(e) {}
}

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────
async function loadUsersScreen() {
  if (user.role !== 'admin') { toast('Endast admin','error'); return; }
  const users = await api('GET','/api/auth/users');
  const list = document.getElementById('users-list');
  list.innerHTML = users.map(u => `
    <div class="user-item">
      <div class="user-info">
        <div class="user-name">${escHtml(u.display_name)}</div>
        <div class="user-meta">${u.username} · ${u.role==='admin'?'Admin':'Användare'}</div>
      </div>
      <div class="user-actions">
        ${u.id !== parseInt(user.id) ? `<button class="btn-icon" onclick="editUser(${u.id},'${escHtml(u.display_name)}','${u.username}','${u.role}')">✏️</button>` : ''}
        ${u.id !== parseInt(user.id) ? `<button class="btn-icon btn-danger" onclick="deleteUser(${u.id},'${escHtml(u.display_name)}')">🗑️</button>` : ''}
      </div>
    </div>
  `).join('');
}

function showAddUser() {
  document.getElementById('user-modal-title').textContent = 'Ny användare';
  document.getElementById('edit-user-id').value = '';
  document.getElementById('edit-user-display').value = '';
  document.getElementById('edit-user-username').value = '';
  document.getElementById('edit-user-username').disabled = false;
  document.getElementById('edit-user-role').value = 'user';
  document.getElementById('edit-user-password').value = '';
  document.getElementById('edit-user-password').placeholder = 'Lösenord (min 6 tecken)';
  document.getElementById('edit-user-adminkey').value = '';
  document.getElementById('adminkey-row').style.display = '';
  document.getElementById('user-modal-error').classList.add('hidden');
  openModal('modal-edit-user');
}

function editUser(id, display_name, username, role) {
  document.getElementById('user-modal-title').textContent = 'Redigera användare';
  document.getElementById('edit-user-id').value = id;
  document.getElementById('edit-user-display').value = display_name;
  document.getElementById('edit-user-username').value = username;
  document.getElementById('edit-user-username').disabled = true;
  document.getElementById('edit-user-role').value = role;
  document.getElementById('edit-user-password').value = '';
  document.getElementById('edit-user-password').placeholder = 'Nytt lösenord (lämna tomt = behåll)';
  document.getElementById('adminkey-row').style.display = 'none';
  document.getElementById('user-modal-error').classList.add('hidden');
  openModal('modal-edit-user');
}

async function saveUser() {
  const errEl = document.getElementById('user-modal-error');
  errEl.classList.add('hidden');
  const id = document.getElementById('edit-user-id').value;
  const display_name = document.getElementById('edit-user-display').value.trim();
  const username = document.getElementById('edit-user-username').value.trim();
  const role = document.getElementById('edit-user-role').value;
  const password = document.getElementById('edit-user-password').value;
  const admin_key = document.getElementById('edit-user-adminkey').value;
  try {
    if (id) {
      const body = { display_name, role };
      if (password) body.password = password;
      await api('PUT',`/api/auth/users/${id}`, body);
      toast('Användare uppdaterad','success');
    } else {
      await api('POST','/api/auth/register',{ username, password, display_name, role, admin_key }, false);
      toast('Användare skapad!','success');
    }
    closeModal('modal-edit-user');
    loadUsersScreen();
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

async function deleteUser(id, name) {
  if (!confirm(`Ta bort användaren "${name}"?`)) return;
  try {
    await api('DELETE',`/api/auth/users/${id}`);
    toast('Användare borttagen','success');
    loadUsersScreen();
  } catch(e) { toast(e.message,'error'); }
}

// ─── SCANNER ──────────────────────────────────────────────────────────────────
function openScanModal(target) {
  currentScanTarget = target;
  document.getElementById('manual-barcode').value = '';
  document.getElementById('scanner-status').textContent = 'Startar kamera...';
  openModal('modal-scanner');
  startCamera();
}

async function startCamera() {
  try {
    const video = document.getElementById('scanner-video');
    document.getElementById('scanner-status').textContent = 'Startar kamera...';
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    });
    scanStream = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    await video.play();
    document.getElementById('scanner-status').textContent = 'Rikta kameran mot streckkoden';

    if (typeof ZXing !== 'undefined') {
      const hints = new Map();
      const formats = [
        ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39,
        ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.ITF,
        ZXing.BarcodeFormat.DATA_MATRIX,
      ];
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      const codeReader = new ZXing.BrowserMultiFormatReader(hints);
      window._zxingReader = codeReader;
      await codeReader.decodeFromVideoElement(video, (result, err) => {
        if (result) {
          document.getElementById('scanner-status').textContent = `✓ ${result.getText()}`;
          setTimeout(() => handleScannedCode(result.getText()), 300);
        }
      });
      return;
    }

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e','itf'] });
      scanInterval = setInterval(async () => {
        if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            clearInterval(scanInterval); scanInterval = null;
            document.getElementById('scanner-status').textContent = `✓ ${barcodes[0].rawValue}`;
            setTimeout(() => handleScannedCode(barcodes[0].rawValue), 300);
          }
        } catch(e) {}
      }, 300);
    } else {
      document.getElementById('scanner-status').textContent = 'Ange streckkod manuellt nedan';
    }
  } catch(e) {
    document.getElementById('scanner-status').textContent = 'Kameraåtkomst nekad — ange manuellt nedan';
    console.warn('Camera error:', e);
  }
}

function closeScanner() {
  if (window._zxingReader) { window._zxingReader.reset(); window._zxingReader = null; }
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
  const video = document.getElementById('scanner-video');
  if (video) { video.srcObject = null; video.pause(); }
  closeModal('modal-scanner');
}

function submitManualBarcode() {
  const val = document.getElementById('manual-barcode').value.trim();
  if (val) handleScannedCode(val);
}

async function handleScannedCode(code) {
  if (currentScanTarget === 'edit-barcode-scan') {
    closeScanner();
    document.getElementById('edit-barcode').value = code;
    return;
  }
  closeScanner();
  try {
    const product = await api('GET',`/api/products/barcode/${encodeURIComponent(code)}`);
    const inv = activeWarehouse ? inventory.find(i => i.product_id === product.id) : null;
    if (currentScanTarget === 'cart-scan') {
      openQtyModal({product_id:product.id,e_number:product.e_number,name:product.name,unit:product.unit,available:inv?.quantity||0},'cart');
    } else if (currentScanTarget === 'restock-scan') {
      openQtyModal({product_id:product.id,e_number:product.e_number,name:product.name,unit:product.unit},'restock');
    } else if (currentScanTarget === 'inventory-scan') {
      if (!inv) {
        if (confirm(`${product.name} finns inte i detta lager. Lägg till?`)) {
          await api('POST','/api/inventory/add-product',{warehouse_id:activeWarehouse.id,product_id:product.id,min_quantity:2});
          toast('Produkt tillagd i lagret','success'); loadInventory();
        }
      } else {
        inventoryItemClick(product.id);
      }
    }
  } catch(e) {
    const create = confirm(`Artikel med kod "${code}" hittades inte.\nVill du skapa den?`);
    if (create) {
      if (typeof showEditProductModal !== 'undefined') showEditProductModal(null);
      setTimeout(()=>{ const bc=document.getElementById('edit-barcode'); if(bc) bc.value=code; },300);
    }
  }
}

// ─── PUSH NOTIFICATIONS ─────────────────────────────────────────────────────
let pushSubscription = null;
async function togglePushNotifications() {
  if (!('serviceWorker' in navigator)||!('PushManager' in window)) { toast('Push stöds ej på denna enhet','error'); return; }
  if (pushSubscription) {
    await api('DELETE','/api/notifications/subscribe',{endpoint:pushSubscription.endpoint});
    pushSubscription=null; document.getElementById('push-toggle-btn').textContent='Aktivera'; toast('Notiser avaktiverade'); return;
  }
  try {
    const {key} = await api('GET','/api/notifications/vapid-public-key');
    if (!key) { toast('VAPID-nycklar saknas — konfigurera i .env','warn'); return; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});
    await api('POST','/api/notifications/subscribe',{endpoint:sub.endpoint,keys:{p256dh:arrayBufferToBase64(sub.getKey('p256dh')),auth:arrayBufferToBase64(sub.getKey('auth'))}});
    pushSubscription=sub; document.getElementById('push-toggle-btn').textContent='Avaktivera'; toast('Notiser aktiverade!','success');
  } catch(e) { toast('Kunde inte aktivera notiser','error'); }
}

async function sendTestPush() {
  try { await api('POST','/api/notifications/test'); toast('Testnotis skickat!','success'); }
  catch(e) { toast(e.message,'error'); }
}

function urlBase64ToUint8Array(b) { const p='='.repeat((4-b.length%4)%4); const s=(b+p).replace(/-/g,'+').replace(/_/g,'/'); const r=window.atob(s); return Uint8Array.from([...r].map(c=>c.charCodeAt(0))); }
function arrayBufferToBase64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }

// ─── MODALS ───────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target===m) { if (m.id==='modal-scanner') closeScanner(); else closeModal(m.id); } });
  });
});
function showChangePassword() { openModal('modal-change-pw'); }
function showCreateUser() { if (typeof showAddUser !== 'undefined') showAddUser(); }

// ─── WAREHOUSES SCREEN ────────────────────────────────────────────────────────
function showAddWarehouseModal() { showAddWarehouse(); }

// ─── BILD-URL:ER SOM KRÄVER INLOGGNING ────────────────────────────────────────
// /uploads/* kräver numera en giltig token. <img>-taggar kan inte skicka
// Authorization-headers, så token skickas med som query-parameter istället.
function imgAuth(url) {
  if (!url) return url;
  return url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
}

// ─── API-FUNKTION MED RETRY OCH TIMEOUT ───────────────────────────────────────
async function api(method, path, body, withAuth=true, retries = 2) {
  const url = `${API}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const opts = {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(withAuth && token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    clearTimeout(timeoutId);

    if (res.status === 401) {
      localStorage.removeItem('elstock_token');
      localStorage.removeItem('elstock_user');
      token = null; user = null;
      window.location.reload();
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (retries > 0 && (error.name === 'TypeError' || error.name === 'AbortError')) {
      console.warn(`[API] Retry ${path} (${retries} kvar)...`);
      await new Promise(r => setTimeout(r, 1000));
      return api(method, path, body, withAuth, retries - 1);
    }

    if (!navigator.onLine || error.name === 'TypeError') {
      showOfflineBanner();
      throw new Error('Ingen anslutning till servern. Kontrollera ditt nätverk.');
    }

    throw error;
  }
}

function toast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent=msg; el.className=`toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.add('hidden'), 3000);
}

function escHtml(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function formatDate(str) { if(!str) return ''; const d=new Date(str); return d.toLocaleString('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function categoryIcon(cat) { const icons={'Kabel':'🔌','Armaturer':'💡','Brytare':'🔲','Säkringar':'⚡','Rör':'🔩','Verktyg':'🔧','Kablar':'🔴'}; return icons[cat]||'📦'; }

// ─── GEOFENCE ─────────────────────────────────────────────────────────────────
let geofenceSettings = null;
let geofenceWatchId = null;

async function loadGeofenceSettings() {
  try {
    geofenceSettings = await api('GET', '/api/geofence/settings');
    renderGeofenceSettings();
  } catch(e) {}
}

function renderGeofenceSettings() {
  const el = document.getElementById('geofence-settings-content');
  if (!el || !geofenceSettings) return;
  const { lat, lng, radius, enabled, name, owntracks_url } = geofenceSettings;
  el.innerHTML = `
    <div class="form-group">
      <label><input type="checkbox" id="geo-enabled" ${enabled ? 'checked' : ''}> Aktiverat</label>
    </div>
    <div class="form-group">
      <label>Förrådsnamn</label>
      <input type="text" id="geo-name" value="${escHtml(name||'Centralförrådet')}">
    </div>
    <div class="form-group">
      <label>Latitud</label>
      <input type="number" step="any" id="geo-lat" value="${lat||''}">
    </div>
    <div class="form-group">
      <label>Longitud</label>
      <input type="number" step="any" id="geo-lng" value="${lng||''}">
    </div>
    <div class="form-group">
      <label>Radie (meter)</label>
      <input type="number" id="geo-radius" value="${radius||200}">
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="getMyLocation()">📍 Hämta min position</button>
      <button class="btn btn-primary" onclick="saveGeofence()">Spara</button>
      <button class="btn btn-secondary" onclick="testGeofenceNow()">📨 Testa nu</button>
    </div>
    <div id="geo-status" style="font-size:13px;color:var(--text-muted);margin-top:8px"></div>
    <div style="margin-top:16px;padding:12px;background:var(--bg-card);border-radius:8px">
      <div style="font-weight:600;margin-bottom:8px">📱 Locative / OwnTracks setup</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:8px">Webhook URL:</div>
      <div style="display:flex;gap:8px">
        <input type="text" readonly value="${owntracks_url||'https://elstock.predatorz.net/api/geofence/owntracks'}" style="flex:1;font-size:12px">
        <button class="btn btn-small" onclick="copyOwntracksUrl('${owntracks_url||'https://elstock.predatorz.net/api/geofence/owntracks'}')">Kopiera</button>
      </div>
    </div>
  `;
}

function copyOwntracksUrl(url) {
  navigator.clipboard.writeText(url).then(() => toast('URL kopierad!','success')).catch(() => { prompt('Kopiera denna URL:', url); });
}

async function saveGeofence() {
  const body = {
    enabled: document.getElementById('geo-enabled')?.checked ?? true,
    name: document.getElementById('geo-name')?.value || 'Centralförrådet',
    lat: parseFloat(document.getElementById('geo-lat')?.value),
    lng: parseFloat(document.getElementById('geo-lng')?.value),
    radius: parseInt(document.getElementById('geo-radius')?.value) || 200
  };
  if (isNaN(body.lat) || isNaN(body.lng)) { toast('Ange giltiga koordinater','error'); return; }
  await api('POST', '/api/geofence/settings', body);
  geofenceSettings = body;
  toast('Geofence sparat!','success');
  startGeofenceWatch();
}

function getMyLocation() {
  const statusEl = document.getElementById('geo-status');
  if (statusEl) statusEl.textContent = 'Hämtar position...';
  navigator.geolocation.getCurrentPosition(pos => {
    document.getElementById('geo-lat').value = pos.coords.latitude.toFixed(6);
    document.getElementById('geo-lng').value = pos.coords.longitude.toFixed(6);
    if (statusEl) statusEl.textContent = `Position hämtad! Noggrannhet: ±${Math.round(pos.coords.accuracy)}m`;
    toast('Position hämtad!','success');
  }, err => {
    toast('Kunde inte hämta position: ' + err.message,'error');
  }, { enableHighAccuracy: true, timeout: 10000 });
}

async function testGeofenceNow() {
  try {
    const res = await api('POST', '/api/geofence/arrived', {});
    toast(`Telegram skickat! ${res.items} artiklar att fylla på`,'success');
  } catch(e) { toast(e.message,'error'); }
}

async function startGeofenceWatch() {
  if (!geofenceSettings?.enabled || !geofenceSettings?.lat) return;
  if (!('geolocation' in navigator)) return;
  const db = await openClientDB();
  await clientDbSet(db, 'auth_token', { value: token });
  await clientDbSet(db, 'geofence_settings', geofenceSettings);
  if ('serviceWorker' in navigator && 'periodicSync' in (await navigator.serviceWorker.ready)) {
    try {
      const sw = await navigator.serviceWorker.ready;
      await sw.periodicSync.register('elstock-geofence', { minInterval: 15 * 60 * 1000 });
    } catch(e) { startGeofenceInterval(); }
  } else {
    startGeofenceInterval();
  }
  if (geofenceWatchId) navigator.geolocation.clearWatch(geofenceWatchId);
  geofenceWatchId = navigator.geolocation.watchPosition(async pos => {
    const db = await openClientDB();
    await clientDbSet(db, 'last_position', { lat: pos.coords.latitude, lng: pos.coords.longitude, time: Date.now() });
    const sw = await navigator.serviceWorker.ready;
    sw.active?.postMessage({ type: 'CHECK_GEOFENCE' });
  }, null, { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 });
}

function startGeofenceInterval() {
  setInterval(async () => {
    const sw = await navigator.serviceWorker.ready;
    sw.active?.postMessage({ type: 'CHECK_GEOFENCE' });
  }, 15 * 60 * 1000);
}

function openClientDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('elstock', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('store', { keyPath: 'key' });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = reject;
  });
}

function clientDbSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('store', 'readwrite');
    const req = tx.objectStore('store').put({ key, value });
    req.onsuccess = resolve;
    req.onerror = reject;
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  if (token && user) {
    setTimeout(async () => {
      try {
        geofenceSettings = await api('GET', '/api/geofence/settings');
        if (geofenceSettings?.enabled) startGeofenceWatch();
      } catch(e) {}
    }, 3000);
  }
});

// ─── TOKEN FÖRNYELSE ──────────────────────────────────────────────────────────
async function checkTokenExpiry() {
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresIn = payload.exp * 1000 - Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (expiresIn < sevenDays) {
      const res = await api('POST', '/api/auth/refresh');
      if (res.token) {
        token = res.token;
        localStorage.setItem('elstock_token', token);
        console.log('Token förnyad');
      }
    }
  } catch(e) { console.log('Token check failed:', e); }
}

setInterval(checkTokenExpiry, 60 * 60 * 1000);
