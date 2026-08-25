// components/AppShell.js
import Store from '../stores/appStore.js';
import { whIcon } from '../services/api.js';

export function AppShell() {
  const user = Store.get('user');
  const wh = Store.get('activeWarehouse');
  const theme = Store.get('theme');

  return `
    <div id="app-shell">
      <div class="top-bar" id="top-bar">
        <div class="top-bar-left">
          <button class="icon-btn" id="menu-btn" title="Meny"><i class="fas fa-bars"></i></button>
          <div class="logo">⚡ ElStock</div>
        </div>
        <div class="top-bar-center" id="top-bar-center"></div>
        <div class="top-bar-right">
          <button class="icon-btn" id="theme-toggle" title="Växla tema"><i class="fas fa-${theme === 'dark' ? 'sun' : 'moon'}"></i></button>
          <button class="icon-btn" id="notif-btn" title="Notiser"><i class="fas fa-bell"></i><span class="badge" id="notif-badge" style="display:none"></span></button>
          <button class="icon-btn" id="profile-btn" title="Profil"><i class="fas fa-user-circle"></i></button>
        </div>
      </div>

      <div class="warehouse-bar" id="warehouse-bar">
        <div class="warehouse-picker">
          <select id="warehouse-select" class="warehouse-select">
            <option value="">Välj lager...</option>
          </select>
          <span id="warehouse-icon" class="warehouse-icon">${wh ? whIcon(wh.type) : '🏭'}</span>
        </div>
        <div class="warehouse-actions">
          <button class="icon-btn" id="add-warehouse-btn" title="Nytt lager"><i class="fas fa-plus"></i></button>
          <button class="icon-btn" id="edit-warehouse-btn" title="Redigera lager"><i class="fas fa-edit"></i></button>
        </div>
      </div>

      <div class="main-content" id="main-content"></div>

      <div class="bottom-nav" id="bottom-nav">
        <button class="nav-item ${Store.get('screen') === 'inventory' ? 'active' : ''}" data-screen="inventory"><i class="fas fa-boxes"></i><span>Lager</span></button>
        <button class="nav-item ${Store.get('screen') === 'catalog' ? 'active' : ''}" data-screen="catalog"><i class="fas fa-th-large"></i><span>Katalog</span></button>
        <button class="nav-item ${Store.get('screen') === 'cart' ? 'active' : ''}" data-screen="cart"><i class="fas fa-shopping-cart"></i><span>Kundvagn</span></button>
        <button class="nav-item ${Store.get('screen') === 'restock' ? 'active' : ''}" data-screen="restock"><i class="fas fa-dolly"></i><span>Påfyll</span></button>
        <button class="nav-item ${Store.get('screen') === 'history' ? 'active' : ''}\" data-screen="history"><i class="fas fa-history"></i><span>Historik</span></button>
      </div>

      <div class="side-menu" id="side-menu">
        <div class="side-menu-header">
          <div class="logo">⚡ ElStock</div>
          <button class="icon-btn" id="close-menu"><i class="fas fa-times"></i></button>
        </div>
        <div class="side-menu-user">
          <i class="fas fa-user-circle fa-2x"></i>
          <div class="user-info">
            <div class="user-name">${user ? user.name : 'Gäst'}</div>
            <div class="user-role">${user ? user.role : ''}</div>
          </div>
        </div>
        <div class="side-menu-items">
          <button class="menu-item" data-screen="inventory"><i class="fas fa-boxes"></i> Lager</button>
          <button class="menu-item" data-screen="catalog"><i class="fas fa-th-large"></i> Katalog</button>
          <button class="menu-item" data-screen="cart"><i class="fas fa-shopping-cart"></i> Kundvagn</button>
          <button class="menu-item" data-screen="restock"><i class="fas fa-dolly"></i> Påfyll</button>
          <button class="menu-item" data-screen="history"><i class="fas fa-history"></i> Historik</button>
          <button class="menu-item" data-screen="notifications"><i class="fas fa-bell"></i> Notiser</button>
          <button class="menu-item" data-screen="warehouses"><i class="fas fa-warehouse"></i> Lagerplatser</button>
          ${user && user.role === 'admin' ? `
          <div class="menu-divider">Administration</div>
          <button class="menu-item" data-screen="users"><i class="fas fa-users"></i> Användare</button>
          <button class="menu-item" data-screen="calendar"><i class="fas fa-calendar-alt"></i> Schema</button>
          <button class="menu-item" data-screen="customers"><i class="fas fa-address-book"></i> Kunder</button>
          <button class="menu-item" data-screen="jobs"><i class="fas fa-tasks"></i> Jobb</button>
          <button class="menu-item" data-screen="permissions"><i class="fas fa-user-shield"></i> Behörigheter</button>
          <button class="menu-item" data-screen="categories"><i class="fas fa-tags"></i> Kategorier</button>
          <button class="menu-item" data-screen="equipment"><i class="fas fa-truck"></i> Utrustning</button>
          <button class="menu-item" data-screen="trips"><i class="fas fa-route"></i> Transporter</button>
          ` : ''}
          <div class="menu-divider">Inställningar</div>
          <button class="menu-item" data-screen="settings"><i class="fas fa-cog"></i> Inställningar</button>
          <button class="menu-item" id="logout-btn"><i class="fas fa-sign-out-alt"></i> Logga ut</button>
        </div>
      </div>
      <div class="side-menu-overlay" id="side-menu-overlay"></div>
    </div>
  `;
}
