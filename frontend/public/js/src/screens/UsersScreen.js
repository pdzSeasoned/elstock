// frontend/src/screens/UsersScreen.js
import { escHtml } from '../utils/helpers.js';
import { api } from '../services/api.js';
import store from '../stores/appStore.js';

export function UsersScreen() {
  return `
    <div id="screen-users" class="page-screen hidden">
      <div class="page-header">
        <h2>Användare</h2>
        <button class="btn btn-sm btn-accent" onclick="showAddUser()">+ Ny användare</button>
      </div>
      <div id="users-list"></div>
    </div>
  `;
}

export async function loadUsersScreen() {
  if (store.state.user.role !== 'admin') { toast('Endast admin', 'error'); return; }
  const users = await api('GET', '/api/auth/users');
  const list = document.getElementById('users-list');
  list.innerHTML = users.map(u => `
    <div class="user-item">
      <div class="user-info">
        <div class="user-name">${escHtml(u.display_name)}</div>
        <div class="user-meta">${u.username} · ${u.role==='admin'?'Admin':'Användare'}</div>
      </div>
      <div class="user-actions">
        ${u.id !== parseInt(store.state.user.id) ? `<button class="btn-icon" onclick="editUser(${u.id},'${escHtml(u.display_name)}','${u.username}','${u.role}')">✏️</button>` : ''}
        ${u.id !== parseInt(store.state.user.id) ? `<button class="btn-icon btn-danger" onclick="deleteUser(${u.id},'${escHtml(u.display_name)}')">🗑️</button>` : ''}
      </div>
    </div>
  `).join('');
}
