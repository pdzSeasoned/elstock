// components/Screens.js
import Store from '../stores/appStore.js';
import { escHtml, whIcon, categoryIcon } from '../services/api.js';

export const Screens = {
  login() {
    return `
      <div class="login-screen" id="login-screen">
        <div class="login-container">
          <div class="logo">⚡ ElStock</div>
          <form id="login-form">
            <input type="text" id="login-username" placeholder="Användarnamn" required>
            <input type="password" id="login-password" placeholder="Lösenord" required>
            <button type="submit" class="btn btn-primary btn-block">Logga in</button>
          </form>
          <div id="login-error" class="error-message"></div>
        </div>
      </div>
    `;
  },

  inventory() {
    const wh = Store.get('activeWarehouse');
    const cats = Store.get('allCategories');
    const activeCats = Store.get('activeCategories');
    const brand = Store.get('activeBrand');
    const lowStock = Store.get('lowStock');

    return `
      <div class="page-screen" id="screen-inventory">
        <div class="search-bar">
          <input type="text" id="inv-search" placeholder="Sök produkt..." class="search-input">
          <button class="icon-btn" id="inv-scan-btn"><i class="fas fa-barcode"></i></button>
          <button class="icon-btn" id="inv-filter-btn"><i class="fas fa-filter"></i></button>
        </div>
        <div class="category-bar" id="category-bar">
          ${cats.map(c => `<button class="category-chip ${activeCats.has(c.name) ? 'active' : ''}" data-cat="${escHtml(c.name)}">${categoryIcon(c.name)} ${escHtml(c.name)}</button>`).join('')}
        </div>
        ${brand ? `<div class="active-filter">Varumärke: ${escHtml(brand)} <button id="clear-brand">✕</button></div>` : ''}
        <div class="inventory-grid" id="inventory-grid"></div>
        ${lowStock.length ? `<div class="low-stock-banner" id="low-stock-banner">⚠️ ${lowStock.length} produkter med lågt lagersaldo</div>` : ''}
      </div>
    `;
  },

  catalog() {
    const cats = Store.get('allCategories');
    const active = Store.get('activeCatalogCategory');
    return `
      <div class="page-screen" id="screen-catalog">
        <div class="search-bar">
          <input type="text" id="cat-search" placeholder="Sök i katalog..." class="search-input">
        </div>
        <div class="catalog-categories" id="catalog-categories">
          ${cats.map(c => `<button class="catalog-cat-btn ${active === c.name ? 'active' : ''}" data-cat="${escHtml(c.name)}">${categoryIcon(c.name)} ${escHtml(c.name)}</button>`).join('')}
        </div>
        <div class="catalog-grid" id="catalog-grid"></div>
      </div>
    `;
  },

  cart() {
    const cart = Store.get('cart');
    const wh = Store.get('activeWarehouse');
    const total = cart.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
    return `
      <div class="page-screen" id="screen-cart">
        <h2>Kundvagn</h2>
        <div class="cart-list" id="cart-list">
          ${cart.length ? cart.map((item, i) => `
            <div class="cart-item" data-idx="${i}">
              <div class="cart-item-info">
                <div class="cart-item-name">${escHtml(item.name)}</div>
                <div class="cart-item-meta">${escHtml(item.category)} ${item.brand ? '• ' + escHtml(item.brand) : ''}</div>
              </div>
              <div class="cart-item-controls">
                <button class="qty-btn" data-delta="-1">−</button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn" data-delta="1">+</button>
                <button class="icon-btn remove-btn"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `).join('') : '<div class="empty-state">Kundvagnen är tom</div>'}
        </div>
        ${cart.length ? `
        <div class="cart-footer">
          <div class="cart-total">Totalt: <strong>${total.toFixed(2)} kr</strong></div>
          <button class="btn btn-primary btn-block" id="checkout-btn">Gå till kassan</button>
        </div>
        ` : ''}
      </div>
    `;
  },

  restock() {
    const cart = Store.get('restockCart');
    return `
      <div class="page-screen" id="screen-restock">
        <h2>Påfyllning</h2>
        <div class="search-bar">
          <input type="text" id="restock-search" placeholder="Sök produkt att fylla på..." class="search-input">
          <button class="icon-btn" id="restock-scan-btn"><i class="fas fa-barcode"></i></button>
        </div>
        <div class="restock-list" id="restock-list">
          ${cart.length ? cart.map((item, i) => `
            <div class="restock-item" data-idx="${i}">
              <div class="restock-info">
                <div class="restock-name">${escHtml(item.name)}</div>
                <div class="restock-meta">${escHtml(item.category)}</div>
              </div>
              <div class="restock-controls">
                <button class="qty-btn" data-delta="-1">−</button>
                <span class="qty-value">${item.quantity}</span>
                <button class="qty-btn" data-delta="1">+</button>
                <button class="icon-btn remove-btn"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          `).join('') : '<div class="empty-state">Inga produkter att fylla på</div>'}
        </div>
        ${cart.length ? `<button class="btn btn-primary btn-block" id="confirm-restock-btn">Bekräfta påfyllning</button>` : ''}
      </div>
    `;
  },

  history() {
    const type = Store.get('currentHistoryType');
    return `
      <div class="page-screen" id="screen-history">
        <div class="segmented-control">
          <button class="segment ${type === 'checkout' ? 'active' : ''}" data-type="checkout">Uttag</button>
          <button class="segment ${type === 'restock' ? 'active' : ''}" data-type="restock">Påfyll</button>
          <button class="segment ${type === 'adjustment' ? 'active' : ''}" data-type="adjustment">Justering</button>
        </div>
        <div class="history-list" id="history-list"></div>
      </div>
    `;
  },

  notifications() {
    return `
      <div class="page-screen" id="screen-notifications">
        <h2>Notiser</h2>
        <div class="notif-list" id="notif-list"></div>
      </div>
    `;
  },

  warehouses() {
    const whs = Store.get('warehouses');
    return `
      <div class="page-screen" id="screen-warehouses">
        <h2>Lagerplatser</h2>
        <div class="warehouse-list" id="warehouse-list">
          ${whs.map(w => `
            <div class="warehouse-card" data-id="${w.id}">
              <div class="wh-icon">${whIcon(w.type)}</div>
              <div class="wh-info">
                <div class="wh-name">${escHtml(w.name)}</div>
                <div class="wh-meta">${escHtml(w.address || '')}</div>
              </div>
              <button class="icon-btn edit-wh-btn"><i class="fas fa-edit"></i></button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  users() {
    return `
      <div class="page-screen" id="screen-users">
        <h2>Användare</h2>
        <div class="user-list" id="user-list"></div>
      </div>
    `;
  },

  calendar() {
    return `
      <div class="page-screen" id="screen-calendar">
        <div class="cal-header">
          <button class="icon-btn" id="cal-prev"><i class="fas fa-chevron-left"></i></button>
          <div class="cal-title" id="cal-title"></div>
          <button class="icon-btn" id="cal-next"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
      </div>
    `;
  },

  customers() {
    return `
      <div class="page-screen" id="screen-customers">
        <h2>Kunder</h2>
        <div class="search-bar">
          <input type="text" id="cust-search" placeholder="Sök kund..." class="search-input">
          <button class="icon-btn" id="add-customer-btn"><i class="fas fa-plus"></i></button>
        </div>
        <div class="customer-list" id="customer-list"></div>
      </div>
    `;
  },

  jobs() {
    return `
      <div class="page-screen" id="screen-jobs">
        <h2>Jobb</h2>
        <div class="jobs-tabs">
          <button class="tab-btn active" data-mode="active">Aktiva</button>
          <button class="tab-btn" data-mode="completed">Avslutade</button>
        </div>
        <div class="job-list" id="job-list"></div>
        <button class="fab" id="add-job-btn"><i class="fas fa-plus"></i></button>
      </div>
    `;
  },

  permissions() {
    return `
      <div class="page-screen" id="screen-permissions">
        <h2>Behörigheter</h2>
        <div class="perm-list" id="perm-list"></div>
      </div>
    `;
  },

  categories() {
    return `
      <div class="page-screen" id="screen-categories">
        <h2>Kategorier</h2>
        <div class="admin-cat-list" id="admin-cat-list"></div>
      </div>
    `;
  },

  equipment() {
    return `
      <div class="page-screen" id="screen-equipment">
        <h2>Utrustning</h2>
        <div class="eq-list" id="eq-list"></div>
      </div>
    `;
  },

  trips() {
    return `
      <div class="page-screen" id="screen-trips">
        <h2>Transporter</h2>
        <div id="trip-map" style="height:300px;border-radius:12px;margin-bottom:1rem;"></div>
        <div class="trip-list" id="trip-list"></div>
      </div>
    `;
  },

  settings() {
    const user = Store.get('user');
    return `
      <div class="page-screen" id="screen-settings">
        <h2>Inställningar</h2>
        <div class="settings-group">
          <h3>Tema</h3>
          <div class="theme-options">
            <button class="theme-btn ${Store.get('theme') === 'dark' ? 'active' : ''}" data-theme="dark">Mörkt</button>
            <button class="theme-btn ${Store.get('theme') === 'light' ? 'active' : ''}" data-theme="light">Ljust</button>
            <button class="theme-btn ${Store.get('theme') === 'blue' ? 'active' : ''}" data-theme="blue">Blått</button>
          </div>
        </div>
        <div class="settings-group">
          <h3>Konto</h3>
          <div class="settings-item"><span>${escHtml(user?.name || '')}</span><span>${escHtml(user?.role || '')}</span></div>
          <button class="btn btn-secondary btn-block" id="change-password-btn">Byt lösenord</button>
        </div>
      </div>
    `;
  }
};
