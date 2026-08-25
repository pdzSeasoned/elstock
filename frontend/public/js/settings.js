// ─── SETTINGS & USER MANAGEMENT ───────────────────────────────────────────────

async function loadSettingsScreen() {
  document.getElementById('settings-username').textContent = `${user.display_name} (${user.username})`;
  // Show admin sections only for admins
  const adminSections = document.querySelectorAll('.admin-only');
  adminSections.forEach(el => el.style.display = user.role === 'admin' ? '' : 'none');
  if (user.role === 'admin') loadUserList();
}

// ── USER LIST ──────────────────────────────────────────────────────────────────
async function loadUserList() {
  try {
    const users = await api('GET', '/api/auth/users');
    const el = document.getElementById('user-list');
    if (!el) return;
    el.innerHTML = users.map(u => `
      <div class="settings-user-row">
        <div>
          <div style="font-weight:600">${escHtml(u.display_name)}</div>
          <div style="font-size:12px;color:var(--muted)">${u.username} · <span style="color:${u.role==='admin'?'var(--accent)':'var(--muted)'}">${u.role==='admin'?'Admin':'Användare'}</span></div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-ghost" onclick="showEditUser(${u.id},'${escHtml(u.display_name)}','${u.username}','${u.role}')">✏️</button>
          ${u.id !== user.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id},'${escHtml(u.display_name)}')">🗑</button>` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {}
}

function showEditUser(id, display_name, username, role) {
  document.getElementById('edit-user-id').value = id;
  document.getElementById('edit-user-display').value = display_name;
  document.getElementById('edit-user-username').textContent = username;
  document.getElementById('edit-user-role').value = role;
  document.getElementById('edit-user-password').value = '';
  document.getElementById('edit-user-error').classList.add('hidden');
  openModal('modal-edit-user');
}

async function saveEditUser() {
  const id = document.getElementById('edit-user-id').value;
  const display_name = document.getElementById('edit-user-display').value.trim();
  const role = document.getElementById('edit-user-role').value;
  const password = document.getElementById('edit-user-password').value;
  const errEl = document.getElementById('edit-user-error');
  errEl.classList.add('hidden');
  if (!display_name) { errEl.textContent='Namn krävs'; errEl.classList.remove('hidden'); return; }
  try {
    await api('PUT', `/api/auth/users/${id}`, { display_name, role, password: password||undefined });
    toast('Användare uppdaterad', 'success');
    closeModal('modal-edit-user');
    loadUserList();
  } catch(e) { errEl.textContent=e.message; errEl.classList.remove('hidden'); }
}

async function deleteUser(id, name) {
  if (!confirm(`Ta bort användaren "${name}"?`)) return;
  try {
    await api('DELETE', `/api/auth/users/${id}`);
    toast('Användare borttagen', 'success');
    loadUserList();
  } catch(e) { toast(e.message, 'error'); }
}

// ── NOTIFICATION CONFIG ────────────────────────────────────────────────────────
async function loadNotifConfig() {
  try {
    const cfg = await api('GET', '/api/notifications/config');
    document.getElementById('notif-email-enabled').checked = cfg.email_enabled === true || cfg.email_enabled === 'true';
    document.getElementById('notif-smtp-host').value = cfg.smtp_host||'';
    document.getElementById('notif-smtp-port').value = cfg.smtp_port||'587';
    document.getElementById('notif-smtp-user').value = cfg.smtp_user||'';
    document.getElementById('notif-smtp-pass').value = cfg.smtp_pass||'';
    document.getElementById('notif-smtp-from').value = cfg.smtp_from||'';
    document.getElementById('notif-email-to').value = cfg.email_to||'';
    document.getElementById('notif-telegram-enabled').checked = cfg.telegram_enabled === true || cfg.telegram_enabled === 'true';
    document.getElementById('notif-telegram-token').value = cfg.telegram_token||'';
    document.getElementById('notif-telegram-chat').value = cfg.telegram_chat_id||'';
  } catch(e) {}
}

async function saveNotifConfig() {
  const cfg = {
    email_enabled: document.getElementById('notif-email-enabled').checked,
    smtp_host: document.getElementById('notif-smtp-host').value,
    smtp_port: document.getElementById('notif-smtp-port').value,
    smtp_user: document.getElementById('notif-smtp-user').value,
    smtp_pass: document.getElementById('notif-smtp-pass').value,
    smtp_from: document.getElementById('notif-smtp-from').value,
    email_to: document.getElementById('notif-email-to').value,
    telegram_enabled: document.getElementById('notif-telegram-enabled').checked,
    telegram_token: document.getElementById('notif-telegram-token').value,
    telegram_chat_id: document.getElementById('notif-telegram-chat').value,
  };
  try {
    await api('POST', '/api/notifications/config', cfg);
    toast('Notifikatonsinställningar sparade!', 'success');
  } catch(e) { toast(e.message, 'error'); }
}

async function testEmail() {
  try { await api('POST', '/api/notifications/test-email'); toast('Test-e-post skickat!', 'success'); }
  catch(e) { toast(e.message, 'error'); }
}

async function testTelegram() {
  try { await api('POST', '/api/notifications/test-telegram'); toast('Telegram-meddelande skickat!', 'success'); }
  catch(e) { toast(e.message, 'error'); }
}

// ── TEKNIKERKARTA ─────────────────────────────────────────────────────────────
let techMap = null;
let techMarkers = [];

async function loadTechnicianMap() {
  if (user.role !== 'admin') return;

  const mapEl = document.getElementById('technician-map');
  if (!mapEl) return;

  // Initiera karta om den inte finns
  if (!techMap) {
    techMap = L.map('technician-map').setView([57.0, 14.0], 8);
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    });
    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });
    osmLayer.addTo(techMap);
    L.control.layers({ '🗺️ Karta': osmLayer, '🛰️ Satellit': satLayer }).addTo(techMap);

    // Lägg till förrådsmarkör
    const geoSettings = await api('GET', '/api/geofence/settings').catch(()=>null);
    if (geoSettings?.lat && geoSettings?.lng) {
      L.circle([geoSettings.lat, geoSettings.lng], {
        color: '#f5a623', fillColor: '#f5a623', fillOpacity: 0.2, radius: geoSettings.radius || 200
      }).addTo(techMap).bindPopup(`🏭 ${geoSettings.name || 'Centralförrådet'}`);
      L.marker([geoSettings.lat, geoSettings.lng]).addTo(techMap)
        .bindPopup(`🏭 ${geoSettings.name || 'Centralförrådet'}`);
    }
  }

  // Rensa gamla markörer
  techMarkers.forEach(m => techMap.removeLayer(m));
  techMarkers = [];

  // Hämta teknikerpositioner
  try {
    const locations = await api('GET', '/api/geofence/locations');
    const bounds = [];

    for (const loc of locations) {
      const updatedAt = new Date(loc.updated_at);
      const minutesAgo = Math.round((Date.now() - updatedAt) / 60000);
      const isRecent = minutesAgo < 60;
      const color = isRecent ? '#4ade80' : '#888';

      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(techMap)
        .bindPopup(`👤 <b>${loc.display_name}</b><br>Uppdaterad: ${minutesAgo < 1 ? 'just nu' : minutesAgo + ' min sedan'}`);

      techMarkers.push(marker);
      bounds.push([loc.lat, loc.lng]);
    }

    if (bounds.length > 0) techMap.fitBounds(bounds, { padding: [40, 40] });
    setTimeout(() => techMap.invalidateSize(), 500);
  } catch(e) {
    console.error('Karta fel:', e);
  }
}
