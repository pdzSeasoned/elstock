// ─── FÄRDLOGG ─────────────────────────────────────────────────────────────────
let activeTrip = null;
let tripsMap = null;
let tripsMapRoute = null;

// ── LADDA FÄRDLOGG ────────────────────────────────────────────────────────────
async function loadTrips() {
  await checkActiveTrip();
  renderActiveTripBanner();

  try {
    const trips = await api('GET', '/api/trips');
    renderTripsList(trips);
  } catch(e) {
    console.error('Trips load error:', e);
  }
}

async function checkActiveTrip() {
  try {
    activeTrip = await api('GET', '/api/trips/active');
  } catch(e) {
    activeTrip = null;
  }
}

function renderActiveTripBanner() {
  const el = document.getElementById('active-trip-banner');
  if (!el) return;

  if (activeTrip) {
    const started = formatDate(activeTrip.started_at);
    const km = activeTrip.distance_km || 0;
    el.innerHTML = `
      <div style="background:var(--accent-dim);border:1px solid var(--accent);border-radius:var(--radius);padding:14px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-weight:700;color:var(--accent)">🚗 Aktiv resa pågår</div>
          <div style="font-size:12px;color:var(--muted)">${started}</div>
        </div>
        <div style="font-size:13px;margin-bottom:10px">
          ${activeTrip.job_customer ? `Jobb: <b>${escHtml(activeTrip.job_customer)}</b><br>` : ''}
          Sträcka hittills: <b>${km} km</b>
        </div>
        <button class="btn btn-danger btn-full" onclick="stopTrip(${activeTrip.id})">🛑 Stoppa resa</button>
      </div>
    `;
  } else {
    el.innerHTML = '';
  }
}

function renderTripsList(trips) {
  const el = document.getElementById('trips-list');
  if (!el) return;

  if (trips.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🚗</div><p>Inga resor loggade ännu</p></div>';
    return;
  }

  // Gruppera per dag
  const grouped = {};
  for (const trip of trips) {
    const date = trip.started_at?.substring(0,10) || 'Okänt datum';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(trip);
  }

  el.innerHTML = Object.entries(grouped).map(([date, dayTrips]) => {
    const totalKm = dayTrips.reduce((sum, t) => sum + (t.distance_km || 0), 0);
    return `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div class="settings-label" style="margin:0">${formatTripDate(date)}</div>
          <div style="font-size:12px;color:var(--muted)">${Math.round(totalKm*10)/10} km totalt</div>
        </div>
        ${dayTrips.map(trip => renderTripCard(trip)).join('')}
      </div>
    `;
  }).join('');
}

function renderTripCard(trip) {
  const start = trip.started_at?.substring(11,16) || '';
  const end = trip.ended_at?.substring(11,16) || '';
  const km = trip.distance_km || 0;
  const isActive = trip.status === 'active';

  return `
    <div class="card" style="margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:24px">${isActive ? '🟢' : '🚗'}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px">
            ${isActive ? 'Pågår...' : `${start} → ${end}`}
            ${user.role === 'admin' && trip.display_name ? `<span style="font-size:11px;color:var(--muted);margin-left:6px">👤 ${escHtml(trip.display_name)}</span>` : ''}
          </div>
          ${trip.job_customer ? `<div style="font-size:12px;color:var(--accent)">📋 ${escHtml(trip.job_customer)}</div>` : ''}
          ${trip.notes ? `<div style="font-size:12px;color:var(--muted)">${escHtml(trip.notes)}</div>` : ''}
          <div style="font-size:12px;color:var(--muted);margin-top:2px">
            <b>${km} km</b>
            ${trip.start_lat ? ` · <span onclick="showTripMap(${trip.id})" style="color:var(--accent);cursor:pointer">🗺️ Visa rutt</span>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${isActive ? `<button class="btn btn-sm btn-danger" onclick="stopTrip(${trip.id})">🛑</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteTrip(${trip.id})">🗑</button>
        </div>
      </div>
    </div>
  `;
}

function formatTripDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('sv-SE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// ── STARTA / STOPPA ───────────────────────────────────────────────────────────
async function startTrip() {
  if (activeTrip) {
    toast('Du har redan en aktiv resa', 'warn');
    return;
  }

  // Hämta aktiva jobb för val
  let jobs = [];
  try { jobs = await api('GET', '/api/jobs?status=active'); } catch(e) {}

  // Bygg jobbväljare
  let jobOptions = '<option value="">Inget jobb</option>';
  jobs.forEach(j => {
    jobOptions += `<option value="${j.id}">${escHtml(j.customer_name)}${j.order_number ? ' — '+j.order_number : ''}</option>`;
  });

  document.getElementById('qty-modal-title').textContent = '🚗 Starta resa';
  document.getElementById('qty-modal-info').innerHTML = `
    <div class="field" style="margin-bottom:10px">
      <label>Kopplat jobb (valfritt)</label>
      <select id="trip-job-select" style="width:100%;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:10px;font-size:15px">
        ${jobOptions}
      </select>
    </div>
    <div class="field">
      <label>Anteckning (valfritt)</label>
      <input type="text" id="trip-notes-input" placeholder="t.ex. Kundbesök, service..." style="width:100%;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:10px;font-size:15px">
    </div>
  `;
  document.querySelector('.qty-controls').style.display = 'none';
  document.querySelector('#modal-quantity .modal-actions').innerHTML = `
    <button class="btn btn-primary btn-full" onclick="confirmStartTrip()">🚗 Starta resa</button>
    <button class="btn btn-ghost btn-full" onclick="closeModal('modal-quantity')">Avbryt</button>
  `;
  openModal('modal-quantity');
}

async function confirmStartTrip() {
  const job_id = document.getElementById('trip-job-select')?.value || null;
  const notes = document.getElementById('trip-notes-input')?.value || '';
  closeModal('modal-quantity');

  // Hämta position
  let lat = null, lng = null;
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch(e) {}

  try {
    const res = await api('POST', '/api/trips/start', { lat, lng, job_id: job_id || null, notes });
    toast('Resa startad!', 'success');
    activeTrip = { id: res.trip_id, started_at: new Date().toISOString(), distance_km: 0 };
    renderActiveTripBanner();
    loadTrips();
  } catch(e) { toast(e.message, 'error'); }
}

async function stopTrip(id) {
  if (!confirm('Stoppa resan?')) return;

  let lat = null, lng = null;
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
    });
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
  } catch(e) {}

  try {
    const res = await api('POST', `/api/trips/${id}/stop`, { lat, lng });
    toast(`Resa avslutad — ${res.distance_km} km`, 'success');
    activeTrip = null;
    renderActiveTripBanner();
    loadTrips();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteTrip(id) {
  if (!confirm('Ta bort denna resa?')) return;
  try {
    await api('DELETE', `/api/trips/${id}`);
    toast('Resa borttagen', 'success');
    loadTrips();
  } catch(e) { toast(e.message, 'error'); }
}

// ── KARTA ─────────────────────────────────────────────────────────────────────
async function showTripMap(tripId) {
  try {
    const points = await api('GET', `/api/trips/${tripId}/points`);
    if (points.length < 2) { toast('För få punkter för att visa rutt', 'warn'); return; }

    document.getElementById('qty-modal-title').textContent = '🗺️ Resrutt';
    document.getElementById('qty-modal-info').innerHTML = `<div id="trip-map-container" style="height:350px;border-radius:var(--radius-sm);margin-top:8px"></div>`;
    document.querySelector('.qty-controls').style.display = 'none';
    document.querySelector('#modal-quantity .modal-actions').innerHTML = `
      <button class="btn btn-ghost btn-full" onclick="closeModal('modal-quantity')">Stäng</button>
    `;
    openModal('modal-quantity');

    setTimeout(() => {
      const map = L.map('trip-map-container').setView([points[0].lat, points[0].lng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

      const latlngs = points.map(p => [p.lat, p.lng]);
      L.polyline(latlngs, { color: '#f5a623', weight: 4 }).addTo(map);

      // Start och slut-markörer
      L.marker(latlngs[0]).addTo(map).bindPopup('🟢 Start');
      L.marker(latlngs[latlngs.length-1]).addTo(map).bindPopup('🔴 Slut');

      map.fitBounds(latlngs);
      map.invalidateSize();
    }, 300);
  } catch(e) { toast(e.message, 'error'); }
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
async function exportTripsCSV() {
  const from = document.getElementById('trips-from')?.value || '';
  const to = document.getElementById('trips-to')?.value || '';
  const userId = document.getElementById('trips-user-filter')?.value || '';

  let url = '/api/trips/export/csv?';
  if (from) url += `from=${from}&`;
  if (to) url += `to=${to}&`;
  if (userId) url += `user_id=${userId}&`;

  const a = document.createElement('a');
  a.href = url;
  a.click();
}

async function loadTripsUserFilter() {
  if (user.role !== 'admin') return;
  try {
    const users = await api('GET', '/api/equipment/users/list');
    const el = document.getElementById('trips-user-filter');
    if (!el) return;
    el.innerHTML = '<option value="">Alla tekniker</option>' +
      users.map(u => `<option value="${u.id}">${escHtml(u.display_name)}</option>`).join('');
  } catch(e) {}
}
