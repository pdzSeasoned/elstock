// frontend/src/screens/NotificationsScreen.js
import { escHtml } from '../utils/helpers.js';
import { api } from '../services/api.js';

export function NotificationsScreen() {
  return `
    <div id="screen-notifications" class="page-screen hidden">
      <div class="page-header"><h2>Larm &amp; notiser</h2></div>
      <div id="notifications-list"></div>
    </div>
  `;
}

export async function loadNotifications() {
  const low = await api('GET', '/api/inventory/low-stock');
  const el = document.getElementById('notifications-list');
  if (low.length === 0) { el.innerHTML = '<div class="empty"><div class="empty-icon">✅</div><div>Allt ser bra ut!</div></div>'; return; }
  const grouped = {};
  for (const item of low) { if (!grouped[item.warehouse_name]) grouped[item.warehouse_name] = []; grouped[item.warehouse_name].push(item); }
  el.innerHTML = Object.entries(grouped).map(([wh, items]) => `
    <div class="notif-group">
      <div class="notif-group-title">${wh}</div>
      ${items.map(i => `
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
