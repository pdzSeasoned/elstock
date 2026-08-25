// frontend/src/screens/HistoryScreen.js
import { formatDate, escHtml } from '../utils/helpers.js';
import { api } from '../services/api.js';
import store from '../stores/appStore.js';

export function HistoryScreen() {
  return `
    <div id="screen-history" class="page-screen hidden">
      <div class="page-header"><h2>Kvitton &amp; historik</h2></div>
      <div class="filter-tabs" id="history-filter-tabs">
        <button class="tab active" onclick="loadHistory('checkout',this)">Uttag</button>
        <button class="tab" onclick="loadHistory('restock',this)">Påfyllning</button>
      </div>
      <div id="history-list" class="item-list"></div>
    </div>
  `;
}

export async function loadHistory(type, tabEl) {
  store.set('currentHistoryType', type);
  if (tabEl) { document.querySelectorAll('#history-filter-tabs .tab').forEach(t => t.classList.remove('active')); tabEl.classList.add('active'); }
  const wh = store.state.activeWarehouse ? `&warehouse_id=${store.state.activeWarehouse.id}` : '';
  const txs = await api('GET', `/api/transactions/history?type=${type}${wh}&limit=50`);
  const list = document.getElementById('history-list');
  if (txs.length === 0) { list.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div>Inga poster ännu</div></div>'; return; }
  list.innerHTML = txs.map(tx => `
    <div class="history-item" onclick="viewReceipt(${tx.id})">
      <div class="history-header">
        <span class="history-id">#${tx.id} ${type==='restock'?'📦 Påfyllning':'🔧 Uttag'}</span>
        <span class="history-date">${formatDate(tx.created_at)}</span>
      </div>
      ${tx.customer_name ? `<div class="history-customer">${escHtml(tx.customer_name)}</div>` : ''}
      ${tx.work_order ? `<div class="history-meta">AO: ${escHtml(tx.work_order)}</div>` : ''}
      <div class="history-items">${tx.items.map(i => `${i.e_number} ${i.product_name}`).join(', ')}</div>
      <div class="history-footer">👤 ${tx.user_name}
        ${store.state.user.role==='admin' ? `<button class="btn-icon btn-danger" style="margin-left:auto" onclick="event.stopPropagation();deleteTransaction(${tx.id},'${type}')">🗑️</button>` : ''}
      </div>
    </div>
  `).join('');
}
