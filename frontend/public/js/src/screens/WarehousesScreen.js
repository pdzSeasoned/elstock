// frontend/src/screens/WarehousesScreen.js
import { escHtml, whIcon } from '../utils/helpers.js';
import { api } from '../services/api.js';
import store from '../stores/appStore.js';

export function WarehousesScreen() {
  return `
    <div id="screen-warehouses" class="page-screen hidden">
      <div class="page-header">
        <h2>Mina lager</h2>
        <button class="btn btn-sm btn-accent admin-only" onclick="showAddWarehouse()">+ Nytt lager</button>
      </div>
      <div id="warehouses-list" class="item-list"></div>
    </div>
  `;
}

export async function loadWarehousesList() {
  const data = await api('GET', '/api/warehouses');
  store.set('warehouses', data);
  const list = document.getElementById('warehouses-list');
  list.innerHTML = store.state.warehouses.map(w => `
    <div class="warehouse-card">
      <div class="wh-icon">${whIcon(w.type)}</div>
      <div class="wh-info">
        <div class="wh-name">${escHtml(w.name)}</div>
        <div class="wh-meta">${w.product_count} artiklar · ${w.low_stock_count} lågt lager</div>
      </div>
      <div class="wh-actions admin-only">
        <button class="btn-icon" onclick="editWarehouse(${w.id},'${escHtml(w.name)}','${w.type}','${escHtml(w.description||'')}'">✏️</button>
        <button class="btn-icon btn-danger" onclick="deleteWarehouse(${w.id})">🗑️</button>
      </div>
    </div>
  `).join('');
  document.querySelectorAll('.admin-only').forEach(el => { el.style.display = store.state.user.role==='admin' ? '' : 'none'; });
}
