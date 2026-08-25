// frontend/src/utils/dom.js
import store from '../stores/appStore.js';

export function toast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

export function showScreen(name) {
  document.querySelectorAll('.page-screen').forEach(s => s.classList.add('hidden'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.screen === name));
  document.getElementById('warehouse-picker')?.classList.add('hidden');

  if (name === 'inventory') { if (typeof loadInventory === 'function') loadInventory(); }
  if (name === 'history') { if (typeof loadHistory === 'function') loadHistory(store.state.currentHistoryType); }
  if (name === 'notifications') { if (typeof loadNotifications === 'function') loadNotifications(); }
  if (name === 'warehouses') { if (typeof loadWarehousesList === 'function') loadWarehousesList(); }
  if (name === 'catalog') { if (typeof loadCatalog !== 'undefined') loadCatalog(); }
  if (name === 'cart') { if (typeof renderCart === 'function') renderCart(); }
  if (name === 'restock') { if (typeof renderRestockCart === 'function') renderRestockCart(); }
  if (name === 'settings') {
    if (typeof loadSettingsScreen === 'function') loadSettingsScreen();
    if (typeof loadGeofenceSettings === 'function') loadGeofenceSettings();
    if (store.state.user?.role === 'admin') setTimeout(() => { if (typeof loadTechnicianMap === 'function') loadTechnicianMap(); }, 300);
  }
  if (name === 'categories') { if (typeof loadCategoryAdmin !== 'undefined') loadCategoryAdmin(); if (typeof populateCatParentSelect !== 'undefined') populateCatParentSelect(); }
  if (name === 'permissions') { if (typeof loadPermissionsScreen !== 'undefined') loadPermissionsScreen(); }
  if (name === 'jobs') { if (typeof loadJobs !== 'undefined') loadJobs('active'); }
  if (name === 'customers') { if (typeof loadCustomers !== 'undefined') loadCustomers(); }
  if (name === 'calendar') {
    if (typeof loadCalendar !== 'undefined') {
      store.set('calSelectedDate', store.state.calSelectedDate || new Date().toISOString().substring(0, 10));
      loadCalendar();
    }
  }
  if (name === 'users') { if (typeof loadUsersScreen === 'function') loadUsersScreen(); }
  if (name === 'trips') { if (typeof loadTrips === 'function') loadTrips(); if (typeof loadTripsUserFilter === 'function') loadTripsUserFilter(); }
  if (name === 'equipment') {
    if (typeof loadEquipmentList === 'function') loadEquipmentList();
    setTimeout(() => { if (typeof loadEquipmentMap === 'function') loadEquipmentMap(); }, 300);
    if (store.state.user?.role === 'admin') { if (typeof loadEquipmentAdmin === 'function') loadEquipmentAdmin(); }
  }
}
