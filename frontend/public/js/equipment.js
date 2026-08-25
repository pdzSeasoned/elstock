// ─── UTRUSTNINGSSPÅRNING ──────────────────────────────────────────────────────
let equipmentList = [];
let equipmentMarkers = [];

// ── ADMIN: HANTERA UTRUSTNING ─────────────────────────────────────────────────
async function loadEquipmentAdmin() {
  if (user.role !== 'admin') return;
  try {
    equipmentList = await api('GET', '/api/equipment');
    const users = await api('GET', '/api/equipment/users/list');
    renderEquipmentAdmin(equipmentList, users);
  } catch(e) {
    console.error('Equipment load error:', e);
  }
}

function renderEquipmentAdmin(items, users) {
  const el = document.getElementById('equipment-admin-list');
  if (!el) return;

  if (items.length === 0) {
    el.innerHTML = '<div class="empty-state"><p>Ingen utrustning tillagd ännu</p></div>';
    return;
  }

  el.innerHTML = items.map(item => {
    const assignedTo = item.display_name || 'Ej tilldelad';
    const minutesAgo = item.location_updated
      ? Math.round((Date.now() - new Date(item.location_updated)) / 60000)
      : null;
    const locationStr = minutesAgo !== null
      ? (minutesAgo < 1 ? 'just nu' : `${minutesAgo} min sedan`)
      : 'Ingen position';

    return `
    <div class="card" style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:24px">${item.icon || '🔧'}</div>
        <div style="flex:1">
          <div style="font-weight:700">${escHtml(item.name)}</div>
          ${item.description ? `<div style="font-size:12px;color:var(--muted)">${escHtml(item.description)}</div>` : ''}
          <div style="font-size:12px;margin-top:4px">
            👤 <b>${escHtml(assignedTo)}</b>
            ${item.lat ? ` · 📍 ${locationStr}` : ' · 📍 Ingen position'}
          </div>
        </div>
        <div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-ghost" onclick="showEquipmentHistory(${item.id},'${escHtml(item.name)}')">📋</button>  
        <button class="btn btn-sm btn-ghost" onclick="showAssignEquipment(${item.id},'${escHtml(item.name)}')">👤</button>
          <button class="btn btn-sm btn-ghost" onclick="showEditEquipment(${item.id},'${escHtml(item.name)}','${escHtml(item.description||'')}','${item.icon||'🔧'}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEquipment(${item.id})">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

async function showAddEquipment() {
  const name = prompt('Namn på utrustning (t.ex. "Stor dragfjäder"):');
  if (!name) return;
  const icon = prompt('Ikon (emoji, t.ex. 🔧 🪛 🔩 📦):', '🔧') || '🔧';
  const description = prompt('Beskrivning (valfri):') || '';
  try {
    await api('POST', '/api/equipment', { name, icon, description });
    toast('Utrustning tillagd!', 'success');
    loadEquipmentAdmin();
    loadEquipmentMap();
  } catch(e) { toast(e.message, 'error'); }
}

async function showEditEquipment(id, name, description, icon) {
  const newName = prompt('Namn:', name);
  if (!newName) return;
  const newIcon = prompt('Ikon:', icon) || icon;
  const newDesc = prompt('Beskrivning:', description) || '';
  try {
    await api('PUT', `/api/equipment/${id}`, { name: newName, icon: newIcon, description: newDesc });
    toast('Uppdaterad!', 'success');
    loadEquipmentAdmin();
    loadEquipmentMap();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteEquipment(id) {
  if (!confirm('Ta bort denna utrustning?')) return;
  try {
    await api('DELETE', `/api/equipment/${id}`);
    toast('Borttagen', 'success');
    loadEquipmentAdmin();
    loadEquipmentMap();
  } catch(e) { toast(e.message, 'error'); }
}

async function showAssignEquipment(id, name) {
  try {
    const users = await api('GET', '/api/equipment/users/list');
    const options = ['Centrallagret', ...users.map(u => u.display_name)];
    const choice = prompt(`Tilldela "${name}" till:\n${options.map((o,i) => `${i}: ${o}`).join('\n')}\n\nAnge nummer:`);
    if (choice === null) return;
    const idx = parseInt(choice);
    if (isNaN(idx) || idx < 0 || idx > users.length) { toast('Ogiltigt val', 'error'); return; }
    const user_id = idx === 0 ? null : users[idx-1].id;
    await api('POST', `/api/equipment/${id}/assign`, { user_id, at_warehouse: idx === 0 });
    toast(idx === 0 ? 'Utrustning på Centrallagret' : `Tilldelad till ${users[idx-1].display_name}`, 'success');
    loadEquipmentAdmin();
    loadEquipmentMap();
  } catch(e) { toast(e.message, 'error'); }
}

// ── KARTA: UTRUSTNING ─────────────────────────────────────────────────────────
async function loadEquipmentMap() {
  // Kontrollera tidsbegränsning för icke-admins
  if (user.role !== 'admin') {
    const hour = new Date().getHours();
    if (hour < 6 || hour >= 17) {
      const el = document.getElementById('equipment-map-container');
      if (el) el.innerHTML = '<div class="empty-state"><p>🕐 Kartan visas 06:00–17:00</p></div>';
      return;
    }
  }

  const mapEl = document.getElementById('equipment-map');
  if (!mapEl || typeof L === 'undefined') return;

  // Initiera karta om den inte finns
  const mapEl2 = document.getElementById("equipment-map");
  if (window.equipMap && window._equipMapEl !== mapEl2) { window.equipMap.remove(); window.equipMap = null; }
  window._equipMapEl = mapEl2;
  if (!window.equipMap) {
    window.equipMap = L.map('equipment-map').setView([57.0, 14.0], 8);
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    });
    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });
    osmLayer.addTo(window.equipMap);
    L.control.layers({ '🗺️ Karta': osmLayer, '🛰️ Satellit': satLayer }).addTo(window.equipMap);
  }

  // Rensa gamla markörer
  equipmentMarkers.forEach(m => window.equipMap.removeLayer(m));
  equipmentMarkers = [];

  try {
    const items = await api('GET', '/api/equipment');
    const bounds = [];

    for (const item of items) {
      if (!item.lat || !item.lng) continue;

      const minutesAgo = item.location_updated
        ? Math.round((Date.now() - new Date(item.location_updated)) / 60000)
        : null;
      const timeStr = minutesAgo !== null
        ? (minutesAgo < 1 ? 'just nu' : `${minutesAgo} min sedan`)
        : 'okänd tid';

      const icon = L.divIcon({
        className: '',
        html: `<div style="background:var(--accent,#f5a623);color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white">${item.icon || '🔧'}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([item.lat, item.lng], { icon })
        .addTo(window.equipMap)
        .bindPopup(`
          <b>${item.icon || '🔧'} ${item.name}</b><br>
          👤 ${item.display_name || 'Ej tilldelad'}<br>
          📍 Uppdaterad: ${timeStr}
          ${item.description ? `<br><i>${item.description}</i>` : ''}
        `);

      equipmentMarkers.push(marker);
      bounds.push([item.lat, item.lng]);
    }

    if (bounds.length > 0) {
      window.equipMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
    setTimeout(() => window.equipMap.invalidateSize(), 300);
  } catch(e) {
    console.error('Equipment map error:', e);
  }
}

// ── ALLA ANVÄNDARE: SE OCH TA/LÄMNA UTRUSTNING ───────────────────────────────
async function loadEquipmentList() {
  try {
    const items = await api('GET', '/api/equipment');
    const el = document.getElementById('equipment-user-list');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>Ingen utrustning registrerad</p></div>';
      return;
    }

    el.innerHTML = items.map(item => {
      const isMyEquipment = item.user_id === user.id && !item.at_warehouse;
      const atWarehouse = item.at_warehouse === 1;
      const assignedTo = atWarehouse ? '🏭 Centrallagret' : (item.display_name ? `👤 ${item.display_name}` : '❓ Okänd');

      return `
      <div class="card" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:28px">${item.icon || '🔧'}</div>
          <div style="flex:1">
            <div style="font-weight:700">${escHtml(item.name)}</div>
            ${item.description ? `<div style="font-size:12px;color:var(--muted)">${escHtml(item.description)}</div>` : ''}
            <div style="font-size:12px;margin-top:4px">${assignedTo}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            ${atWarehouse ? `<button class="btn btn-sm btn-accent" onclick="takeEquipment(${item.id},'${escHtml(item.name)}')">📦 Ta</button>` : ''}
            ${isMyEquipment ? `<button class="btn btn-sm btn-ghost" onclick="returnEquipment(${item.id},'${escHtml(item.name)}')">↩️ Lämna</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('Equipment list error:', e);
  }
}

async function takeEquipment(id, name) {
  if (!confirm(`Ta "${name}"?`)) return;
  try {
    await api('POST', `/api/equipment/${id}/take`);
    toast(`Du har tagit ${name}`, 'success');
    loadEquipmentList();
    loadEquipmentMap();
    if (user.role === 'admin') loadEquipmentAdmin();
  } catch(e) { toast(e.message, 'error'); }
}

async function returnEquipment(id, name) {
  if (!confirm(`Lämna tillbaka "${name}" till centrallagret?`)) return;
  try {
    await api('POST', `/api/equipment/${id}/return`);
    toast(`${name} lämnad till centrallagret`, 'success');
    loadEquipmentList();
    loadEquipmentMap();
    if (user.role === 'admin') loadEquipmentAdmin();
  } catch(e) { toast(e.message, 'error'); }
}

async function showEquipmentHistory(id, name) {
  try {
    const history = await api('GET', `/api/equipment/${id}/history`);
    const actions = { taken: '📦 Tog', returned: '↩️ Lämnade', assigned: '👤 Tilldelades', returned_to_warehouse: '🏭 Åter till lager' };
    const rows = history.length === 0
      ? '<p style="color:var(--muted);text-align:center">Ingen historik ännu</p>'
      : history.map(h => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <div>
            <span>${actions[h.action] || h.action}</span>
            <span style="font-weight:700;margin-left:6px">${escHtml(h.display_name || 'Okänd')}</span>
          </div>
          <div style="font-size:12px;color:var(--muted)">${formatDate(h.created_at)}</div>
        </div>`).join('');

    document.getElementById('qty-modal-title').textContent = `📋 ${name}`;
    document.getElementById('qty-modal-info').innerHTML = rows;
    document.querySelector('.qty-controls').style.display = 'none';
    document.querySelector('#modal-quantity .modal-actions').innerHTML =
      `<button class="btn btn-ghost btn-full" onclick="closeModal('modal-quantity')">Stäng</button>`;
    openModal('modal-quantity');
  } catch(e) { toast(e.message, 'error'); }
}
