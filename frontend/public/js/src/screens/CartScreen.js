// frontend/src/screens/CartScreen.js
import store from '../stores/appStore.js';
import { escHtml } from '../utils/helpers.js';

export function CartScreen() {
  return `
    <div id="screen-cart" class="page-screen hidden">
      <div class="page-header">
        <h2>Varukorg</h2>
        <div class="header-actions">
          <button class="btn btn-sm btn-ghost" onclick="openScanModal('cart-scan')">📷 Skanna</button>
          <button class="btn btn-sm btn-ghost" onclick="clearCart()">Rensa</button>
        </div>
      </div>
      <div id="cart-list" class="item-list"></div>
      <div id="cart-empty" class="empty-state">
        <div class="empty-icon">🛒</div>
        <p>Varukorgen är tom</p>
        <p class="muted">Skanna eller sök efter artiklar</p>
        <button class="btn btn-accent" onclick="openProductSearch('cart')">Sök artikel</button>
      </div>
      <div id="cart-footer" class="cart-footer hidden">
        <div class="cart-summary"><span id="cart-item-count">0 artiklar</span></div>
        <button class="btn btn-primary btn-full" onclick="showCheckout()">Slutför uttag →</button>
      </div>
    </div>
  `;
}

export function renderCart() {
  const list = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  const footer = document.getElementById('cart-footer');
  if (!list || !empty || !footer) return;
  if (store.state.cart.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); footer.classList.add('hidden'); return; }
  empty.classList.add('hidden'); footer.classList.remove('hidden');
  list.innerHTML = store.state.cart.map((item, idx) => `
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
  document.getElementById('cart-item-count').textContent = `${store.state.cart.length} artiklar`;
}
