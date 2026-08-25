// frontend/src/screens/InventoryScreen.js
import store from '../stores/appStore.js';
import { api } from '../services/api.js';
import { escHtml, categoryIcon } from '../utils/helpers.js';

export function InventoryScreen() {
  return `
    <div id="screen-inventory" class="page-screen">
      <div class="page-header">
        <h2>Lagersaldo</h2>
        <div class="header-actions">
          <button class="btn btn-sm btn-ghost" onclick="openScanModal('inventory-scan')">📷 Skanna</button>
          <button class="btn btn-sm btn-accent admin-only" onclick="showAddProductToWarehouse()">+ Lägg till</button>
        </div>
      </div>
      <div class="search-bar"><input type="search" id="inventory-search" placeholder="Sök artikel eller E-nummer..." oninput="filterInventory(this.value)"></div>
      <div class="filter-row" id="category-filters"></div>
      <div id="inventory-list" class="item-list"></div>
      <div id="low-stock-banner" class="low-stock-banner hidden">
        <span>⚠️ <span id="low-stock-count">0</span> artiklar håller på att ta slut</span>
        <button onclick="showScreen('notifications')" class="btn btn-xs btn-warn">Visa</button>
      </div>
    </div>
  `;
}

export async function loadInventory() {
  if (!store.state.activeWarehouse) {
    const el = document.getElementById('inventory-list');
    if (el) el.innerHTML = '<div class="empty"><div class="empty-icon">🏭</div><div>Välj ett lager ovan</div></div>';
    return;
  }
  const data = await api('GET', `/api/warehouses/${store.state.activeWarehouse.id}`);
  store.set('inventory', data.inventory || []);
  renderInventory();
  renderCategoryFilters();
  updateLowStockBanner();
}

export function renderInventory(filter = '') {
  const list = document.getElementById('inventory-list');
  if (!list) return;
  let items = store.state.inventory;
  if (filter) items = items.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()) || i.e_number.toLowerCase().includes(filter.toLowerCase()));
  if (store.state.activeCategories.size > 0) items = items.filter(i => store.state.activeCategories.has(i.category));
  if (store.state.activeBrand) items = items.filter(i => i.brand === store.state.activeBrand);
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
        <div class="inv-image">${item.image_url ? `<img src="${item.image_url}" loading="lazy" alt="">` : categoryIcon(item.category)}</div>
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

export function renderCategoryFilters() {
  const dbCats = [...new Set(store.state.inventory.map(i => i.category).filter(Boolean))];
  const brands = [...new Set(store.state.inventory.map(i => i.brand).filter(Boolean))].sort();
  const el = document.getElementById('category-filters');
  if (!el) return;
  let html = '';
  html += `<select id="brand-filter" class="brand-select" onchange="setBrand(this.value)" style="background:var(--card);border:1px solid var(--border);color:var(--text);border-radius:20px;padding:6px 14px;font-size:13px;font-family:var(--font);margin-right:8px;cursor:pointer;outline:none;">`;
  html += `<option value="" ${!store.state.activeBrand ? 'selected' : ''}>Varumärken</option>`;
  for (const b of brands) {
    html += `<option value="${escHtml(b)}" ${store.state.activeBrand === b ? 'selected' : ''}>${escHtml(b)}</option>`;
  }
  html += `</select>`;
  html += `<button class="cat-filter ${store.state.activeCategories.size === 0 && !store.state.activeBrand ? 'active' : ''}" onclick="setCategory(null)">Alla</button>`;
  for (const cat of dbCats) {
    const isActive = store.state.activeCategories.has(cat);
    html += `<button class="cat-filter ${isActive ? 'active' : ''}" onclick="setCategory('${escHtml(cat)}')">${escHtml(cat)}</button>`;
  }
  el.innerHTML = html;
}

export function updateLowStockBanner() {
  const low = store.state.inventory.filter(i => i.quantity <= i.min_quantity);
  const banner = document.getElementById('low-stock-banner');
  const badge = document.getElementById('notif-badge');
  if (low.length > 0) {
    banner.classList.remove('hidden');
    document.getElementById('low-stock-count').textContent = low.length;
    badge.textContent = low.length; badge.classList.remove('hidden');
  } else { banner.classList.add('hidden'); badge.classList.add('hidden'); }
}
