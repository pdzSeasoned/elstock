// frontend/src/utils/helpers.js
export function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function categoryIcon(cat) {
  const icons = { 'Kabel': '🔌', 'Armaturer': '💡', 'Brytare': '🔲', 'Säkringar': '⚡', 'Rör': '🔩', 'Verktyg': '🔧', 'Kablar': '🔴' };
  return icons[cat] || '📦';
}

export function whIcon(type) {
  return { car: '🚐', garage: '🏠', warehouse: '🏭', other: '📦' }[type] || '📦';
}

export function urlBase64ToUint8Array(b) {
  const p = '='.repeat((4 - b.length % 4) % 4);
  const s = (b + p).replace(/-/g, '+').replace(/_/g, '/');
  const r = window.atob(s);
  return Uint8Array.from([...r].map(c => c.charCodeAt(0)));
}

export function arrayBufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
