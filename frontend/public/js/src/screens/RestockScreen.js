// frontend/src/screens/RestockScreen.js
import store from '../stores/appStore.js';
import { escHtml } from '../utils/helpers.js';

export function RestockScreen() {
  return `
    <div id="screen-restock" class="page-screen hidden">
      <div class="page-header">
        <h2>Fyll på lager</h2>
        <div class="header-actions"><button class="btn btn-sm btn-ghost" onclick="openScanModal('restock-scan')">📷 Skanna</button></div>
      </div>
      <p class="screen-subtitle">Registrera påfyllning från centralförrådet</p>
      <div id="restock-list" class="item-list"></div>
      <div id="restock-empty" class="empty-state">
        <div class="empty-icon">📦</div>
        <p>Inga artiklar tillagda</p>
        <button class="btn btn-accent" onclick="openProductSearch('restock')">+ Lägg till artikel</button>
      </div>
      <div id="restock-footer" class="cart-footer hidden">
        <button class="btn btn-primary btn-full" onclick="confirmRestock()">Bekräfta påfyllning</button>
      </div>
    </div>
  `;
}

export function renderRestockCart() {
  const list = document.getElementById('restock-list');
  const empty = document.getElementById('restock-empty');
  const footer = document.getElementById('restock-footer');
  if (!list || !empty || !footer) return;
  if (store.state.restockCart.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); footer.classList.add('hidden'); return; }
  empty.classList.add('hidden'); footer.classList.remove('hidden');
  list.innerHTML = store.state.restockCart.map((item, idx) => `
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
