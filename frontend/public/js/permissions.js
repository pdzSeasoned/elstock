// ─── PERMISSIONS & USER SETTINGS ─────────────────────────────────────────────
let permData = null;

async function loadPermissionsScreen() {
  if (user.role !== 'admin') {
    document.getElementById('permissions-content').innerHTML = '<div class="empty-state"><p>Endast admin kan hantera behörigheter</p></div>';
    return;
  }
  permData = await api('GET', '/api/user-settings/all');
  renderPermissionsScreen();
}

function renderPermissionsScreen() {
  const el = document.getElementById('permissions-content');
  const { users, warehouses } = permData;

  el.innerHTML = `
    <div class="settings-label">ANVÄNDARE & BEHÖRIGHETER</div>
    ${users.map(u => renderUserPermCard(u, warehouses)).join('')}

    <div class="settings-label" style="margin-top:20px">LAGER-TILLDELNING</div>
    <div class="card">
      ${warehouses.map(w => renderWarehouseAssignment(w, users)).join('')}
    </div>
  `;
}

function renderUserPermCard(u, warehouses) {
  const userWarehouses = warehouses.filter(w => w.owner_user_id === u.id);
  const roleColor = u.role === 'admin' ? 'var(--accent)' : 'var(--muted)';

  return `
  <div class="card" style="margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="width:40px;height:40px;border-radius:50%;background:${u.color||'#f5a623'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#000;flex-shrink:0">${(u.display_name||'?')[0].toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-weight:700">${escHtml(u.display_name)}</div>
        <div style="font-size:12px;color:${roleColor}">${u.role === 'admin' ? '👑 Admin' : '👤 Användare'} · ${u.username}</div>
      </div>
      <button class="btn btn-sm btn-ghost" onclick="showEditUserPermModal(${u.id})">✏️ Redigera</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
      <div style="background:var(--card2);border-radius:8px;padding:8px">
        <div style="color:var(--muted);margin-bottom:4px">Telegram</div>
        <div style="font-weight:600">${u.telegram_chat_id ? '✓ ' + (u.telegram_user||u.telegram_chat_id) : '✗ Ej konfigurerat'}</div>
      </div>
      <div style="background:var(--card2);border-radius:8px;padding:8px">
        <div style="color:var(--muted);margin-bottom:4px">Notiser lågt lager</div>
        <div style="font-weight:600;color:${u.notify_low_stock?'var(--success)':'var(--danger)'}">${u.notify_low_stock ? '✓ På' : '✗ Av'}</div>
      </div>
      <div style="background:var(--card2);border-radius:8px;padding:8px">
        <div style="color:var(--muted);margin-bottom:4px">Push-notiser</div>
        <div style="font-weight:600;color:${u.push_enabled?'var(--success)':'var(--danger)'}">${u.push_enabled ? '✓ På' : '✗ Av'}</div>
      </div>
      <div style="background:var(--card2);border-radius:8px;padding:8px">
        <div style="color:var(--muted);margin-bottom:4px">Egna lager</div>
        <div style="font-weight:600">${userWarehouses.length > 0 ? userWarehouses.map(w=>w.name).join(', ') : 'Inga tilldelade'}</div>
      </div>
    </div>
  </div>`;
}

function renderWarehouseAssignment(w, users) {
  const owner = users.find(u => u.id === w.owner_user_id);
  return `
  <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
    <div style="font-size:20px">${{car:'🚐',garage:'🏠',warehouse:'🏭',other:'📦'}[w.type]||'📦'}</div>
    <div style="flex:1">
      <div style="font-weight:600;font-size:14px">${escHtml(w.name)}</div>
      <div style="font-size:12px;color:var(--muted)">${w.is_shared ? 'Delat' : 'Privat'}</div>
    </div>
    <select onchange="updateWarehouseOwner(${w.id}, this.value, ${w.is_shared})" style="background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:4px 8px;font-size:12px">
      <option value="">Ingen ägare</option>
      ${users.map(u => `<option value="${u.id}" ${u.id===w.owner_user_id?'selected':''}>${escHtml(u.display_name)}</option>`).join('')}
    </select>
    <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
      <input type="checkbox" ${w.is_shared?'checked':''} onchange="updateWarehouseOwner(${w.id}, ${w.owner_user_id||'null'}, this.checked)">
      Delat
    </label>
  </div>`;
}

async function updateWarehouseOwner(wh_id, owner_id, is_shared) {
  await api('POST', '/api/user-settings/warehouse-assignment', {
    warehouse_id: wh_id,
    owner_user_id: owner_id || null,
    is_shared: is_shared
  });
  toast('Sparat!', 'success');
  permData = await api('GET', '/api/user-settings/all');
  renderPermissionsScreen();
}

// ── EDIT USER PERM MODAL ──────────────────────────────────────────────────────
function showEditUserPermModal(userId) {
  const u = permData.users.find(u => u.id === userId);
  if (!u) return;

  document.getElementById('perm-modal-title').textContent = `${u.display_name} — Behörigheter`;
  document.getElementById('perm-user-id').value = u.id;
  document.getElementById('perm-display-name').value = u.display_name || '';
  document.getElementById('perm-role').value = u.role || 'user';
  document.getElementById('perm-telegram-id').value = u.telegram_chat_id || '';
  document.getElementById('perm-telegram-user').value = u.telegram_user || '';
  document.getElementById('perm-notify-low').checked = u.notify_low_stock !== 0;
  document.getElementById('perm-push').checked = u.push_enabled !== 0;
  document.getElementById('perm-color').value = u.color || '#f5a623';
  document.getElementById('perm-password').value = '';

  openModal('modal-edit-permissions');
}

async function saveUserPermissions() {
  const id = document.getElementById('perm-user-id').value;
  const body = {
    display_name: document.getElementById('perm-display-name').value,
    role: document.getElementById('perm-role').value,
    telegram_chat_id: document.getElementById('perm-telegram-id').value || null,
    telegram_user: document.getElementById('perm-telegram-user').value || null,
    notify_low_stock: document.getElementById('perm-notify-low').checked,
    push_enabled: document.getElementById('perm-push').checked,
    color: document.getElementById('perm-color').value,
    password: document.getElementById('perm-password').value || null
  };
  try {
    await api('PUT', `/api/user-settings/user/${id}`, body);
    toast('Behörigheter sparade!', 'success');
    closeModal('modal-edit-permissions');
    permData = await api('GET', '/api/user-settings/all');
    renderPermissionsScreen();
  } catch(e) { toast(e.message, 'error'); }
}

// ── OWN PROFILE SETTINGS ──────────────────────────────────────────────────────
async function loadMyProfileSettings() {
  const profile = await api('GET', '/api/user-settings/profile');
  document.getElementById('my-telegram-id').value = profile.telegram_chat_id || '';
  document.getElementById('my-telegram-user').value = profile.telegram_user || '';
  document.getElementById('my-notify-low').checked = profile.notify_low_stock !== 0;
  document.getElementById('my-push-enabled').checked = profile.push_enabled !== 0;
  document.getElementById('my-color').value = profile.color || '#f5a623';
}

async function saveMyProfileSettings() {
  const body = {
    telegram_chat_id: document.getElementById('my-telegram-id').value || null,
    telegram_user: document.getElementById('my-telegram-user').value || null,
    notify_low_stock: document.getElementById('my-notify-low').checked,
    push_enabled: document.getElementById('my-push-enabled').checked,
    color: document.getElementById('my-color').value
  };
  try {
    await api('PUT', '/api/user-settings/profile', body);
    toast('Profil sparad!', 'success');
  } catch(e) { toast(e.message, 'error'); }
}
