// ─── CALENDAR MODULE ──────────────────────────────────────────────────────────
let calView = 'month'; // 'month' or 'week'
let calDate = new Date();
let calEvents = [];
let calSelectedDate = null;
let editingEventId = null;

const WEEKDAYS = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'];
const MONTHS = ['Januari','Februari','Mars','April','Maj','Juni','Juli','Augusti','September','Oktober','November','December'];
const EVENT_COLORS = ['#f5a623','#4ade80','#60a5fa','#f87171','#c084fc','#fb923c','#34d399','#f472b6'];

async function loadCalendar() {
  const { from, to } = getDateRange();
  calEvents = await api('GET', `/api/calendar/events?from=${from}&to=${to}`);
  renderCalendar();
}

function getDateRange() {
  if (calView === 'month') {
    const y = calDate.getFullYear(), m = calDate.getMonth();
    return { from: `${y}-${String(m+1).padStart(2,'0')}-01`, to: `${y}-${String(m+1).padStart(2,'0')}-31` };
  } else {
    const mon = getWeekMonday(calDate);
    const sun = new Date(mon); sun.setDate(sun.getDate()+6);
    return { from: dateStr(mon), to: dateStr(sun) };
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderCalendar() {
  renderCalHeader();
  if (calView === 'month') renderMonthView();
  else renderWeekView();
  renderSelectedDayEvents();
}

function renderCalHeader() {
  const titleEl = document.getElementById('cal-title');
  if (!titleEl) return;
  if (calView === 'month') {
    titleEl.textContent = `${MONTHS[calDate.getMonth()]} ${calDate.getFullYear()}`;
  } else {
    const mon = getWeekMonday(calDate);
    const sun = new Date(mon); sun.setDate(sun.getDate()+6);
    titleEl.textContent = `${mon.getDate()} ${MONTHS[mon.getMonth()].substring(0,3)} – ${sun.getDate()} ${MONTHS[sun.getMonth()].substring(0,3)}`;
  }
}

function renderMonthView() {
  const container = document.getElementById('cal-body');
  if (!container) return;

  const y = calDate.getFullYear(), m = calDate.getMonth();
  const firstDay = new Date(y, m, 1);
  const lastDay = new Date(y, m+1, 0);
  // Start from Monday
  let startDow = firstDay.getDay() - 1; if (startDow < 0) startDow = 6;
  const today = dateStr(new Date());

  let html = `<div class="cal-weekdays">${WEEKDAYS.map(d=>`<div class="cal-weekday">${d}</div>`).join('')}</div><div class="cal-days">`;

  // Prev month days
  for (let i = startDow-1; i >= 0; i--) {
    const d = new Date(y, m, -i);
    html += `<div class="cal-day other-month"><div class="cal-day-num">${d.getDate()}</div></div>`;
  }

  // Current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayEvents = calEvents.filter(e => e.start_datetime?.substring(0,10) === ds);
    const isToday = ds === today;
    const isSelected = ds === calSelectedDate;
    html += `<div class="cal-day${isToday?' today':''}${isSelected?' selected':''}" onclick="selectCalDay('${ds}')">
      <div class="cal-day-num">${day}</div>
      <div class="cal-day-dots">${dayEvents.slice(0,4).map(e=>`<div class="cal-dot" style="background:${e.color||'#f5a623'}"></div>`).join('')}</div>
    </div>`;
  }

  // Next month filler
  const total = startDow + lastDay.getDate();
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderWeekView() {
  const container = document.getElementById('cal-body');
  if (!container) return;

  const mon = getWeekMonday(calDate);
  const today = dateStr(new Date());
  let html = '<div class="cal-week">';

  for (let i = 0; i < 7; i++) {
    const d = new Date(mon); d.setDate(d.getDate()+i);
    const ds = dateStr(d);
    const dayEvents = calEvents.filter(e => e.start_datetime?.substring(0,10) === ds);
    const isToday = ds === today;
    html += `<div class="cal-week-day${isToday?' today':''}" onclick="selectCalDay('${ds}')">
      <div class="cal-week-label">
        <div class="cal-week-date">${d.getDate()}</div>
        <div class="cal-week-dayname">${WEEKDAYS[i]}</div>
      </div>
      <div class="cal-week-events">
        ${dayEvents.map(e => `
          <div class="cal-event-pill" style="background:${e.color||'#f5a623'}" onclick="event.stopPropagation();editCalEvent(${typeof e.id==='string'?`'${e.id}'`:e.id})">
            ${e.all_day ? '' : formatTime(e.start_datetime)} ${escHtml(e.title)}
          </div>
        `).join('')}
      </div>
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderSelectedDayEvents() {
  const el = document.getElementById('cal-day-events');
  if (!el) return;

  if (!calSelectedDate) {
    el.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">Tryck på ett datum för att se händelser</div>';
    return;
  }

  const dayEvents = calEvents.filter(e => e.start_datetime?.substring(0,10) === calSelectedDate);
  const dateObj = new Date(calSelectedDate+'T12:00:00');
  const dateLabel = `${dateObj.getDate()} ${MONTHS[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-weight:700;font-size:15px">${dateLabel}</div>
      <button class="btn btn-sm btn-accent" onclick="showNewEventModal('${calSelectedDate}')">+ Lägg till</button>
    </div>
    ${dayEvents.length === 0 ? '<div style="color:var(--muted);font-size:13px;text-align:center;padding:16px">Inga händelser</div>' :
      dayEvents.map(e => `
        <div class="cal-day-event-item" onclick="editCalEvent(${typeof e.id==='string'?`'${e.id}'`:e.id})">
          <div class="cal-event-color-bar" style="background:${e.color||'#f5a623'}"></div>
          <div class="cal-event-info">
            <div class="cal-event-title">${escHtml(e.title)}</div>
            <div class="cal-event-time">
              ${e.all_day ? 'Heldag' : `${formatTime(e.start_datetime)}${e.end_datetime?' – '+formatTime(e.end_datetime):''}`}
              ${e.is_job_deadline ? ' · <span style="color:var(--danger)">Deadline</span>' : ''}
              ${e.description ? `<br>${escHtml(e.description)}` : ''}
            </div>
          </div>
          ${!e.is_job_deadline ? `<button class="btn btn-xs btn-danger" onclick="event.stopPropagation();deleteCalEvent(${e.id})">🗑</button>` : ''}
        </div>
      `).join('')
    }
  `;
}

function selectCalDay(ds) {
  calSelectedDate = ds;
  renderCalendar();
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
function calPrev() {
  if (calView === 'month') calDate.setMonth(calDate.getMonth()-1);
  else calDate.setDate(calDate.getDate()-7);
  loadCalendar();
}

function calNext() {
  if (calView === 'month') calDate.setMonth(calDate.getMonth()+1);
  else calDate.setDate(calDate.getDate()+7);
  loadCalendar();
}

function calToday() {
  calDate = new Date();
  calSelectedDate = dateStr(new Date());
  loadCalendar();
}

function switchCalView(view) {
  calView = view;
  document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  loadCalendar();
}

// ── EVENT MODAL ───────────────────────────────────────────────────────────────
function showNewEventModal(dateStr) {
  editingEventId = null;
  document.getElementById('event-modal-title').textContent = 'Ny händelse';
  document.getElementById('event-form-title').value = '';
  document.getElementById('event-form-desc').value = '';
  document.getElementById('event-form-date').value = dateStr || calSelectedDate || new Date().toISOString().substring(0,10);
  document.getElementById('event-form-time').value = '08:00';
  document.getElementById('event-form-endtime').value = '09:00';
  document.getElementById('event-form-allday').checked = false;
  document.getElementById('event-form-reminder').value = '60';
  document.getElementById('event-form-color').value = '#f5a623';
  document.getElementById('event-form-job').value = '';
  document.getElementById('event-delete-btn').style.display = 'none';
  renderColorPicker();
  loadJobsForEventSelect();
  openModal('modal-calendar-event');
}

async function editCalEvent(id) {
  if (String(id).startsWith('job_')) {
    // Job deadline — open the job
    const jobId = String(id).replace('job_','');
    closeModal('modal-calendar-event');
    showScreen('jobs');
    setTimeout(() => openJob(parseInt(jobId)), 300);
    return;
  }
  const event = calEvents.find(e => e.id === id);
  if (!event) return;
  editingEventId = id;
  document.getElementById('event-modal-title').textContent = 'Redigera händelse';
  document.getElementById('event-form-title').value = event.title;
  document.getElementById('event-form-desc').value = event.description||'';
  document.getElementById('event-form-date').value = event.start_datetime.substring(0,10);
  document.getElementById('event-form-time').value = event.start_datetime.substring(11,16)||'08:00';
  document.getElementById('event-form-endtime').value = event.end_datetime?.substring(11,16)||'09:00';
  document.getElementById('event-form-allday').checked = !!event.all_day;
  document.getElementById('event-form-reminder').value = event.reminder_minutes||60;
  document.getElementById('event-form-color').value = event.color||'#f5a623';
  document.getElementById('event-delete-btn').style.display = 'block';
  renderColorPicker(event.color);
  await loadJobsForEventSelect(event.job_id);
  openModal('modal-calendar-event');
}

function renderColorPicker(selected) {
  const el = document.getElementById('event-color-picker');
  el.innerHTML = EVENT_COLORS.map(c => `
    <div onclick="selectEventColor('${c}')" style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${c===(selected||'#f5a623')?'#fff':'transparent'};box-sizing:border-box"></div>
  `).join('');
}

function selectEventColor(color) {
  document.getElementById('event-form-color').value = color;
  renderColorPicker(color);
}

async function loadJobsForEventSelect(selectedJobId) {
  const jobs = await api('GET', '/api/jobs?status=active').catch(() => []);
  const sel = document.getElementById('event-form-job');
  sel.innerHTML = '<option value="">— Inget jobb kopplat —</option>' +
    jobs.map(j => `<option value="${j.id}" ${j.id==selectedJobId?'selected':''}>${j.customer_name}${j.order_number?' ('+j.order_number+')':''}</option>`).join('');
}

async function saveCalEvent() {
  const title = document.getElementById('event-form-title').value.trim();
  const date = document.getElementById('event-form-date').value;
  if (!title || !date) { toast('Titel och datum krävs','error'); return; }

  const allDay = document.getElementById('event-form-allday').checked;
  const time = document.getElementById('event-form-time').value || '00:00';
  const endTime = document.getElementById('event-form-endtime').value || '';
  const start_datetime = allDay ? `${date}T00:00:00` : `${date}T${time}:00`;
  const end_datetime = allDay ? null : (endTime ? `${date}T${endTime}:00` : null);

  const body = {
    title,
    description: document.getElementById('event-form-desc').value.trim(),
    start_datetime, end_datetime, all_day: allDay ? 1 : 0,
    color: document.getElementById('event-form-color').value,
    reminder_minutes: parseInt(document.getElementById('event-form-reminder').value) || 60,
    job_id: document.getElementById('event-form-job').value || null
  };

  try {
    if (editingEventId) await api('PUT', `/api/calendar/events/${editingEventId}`, body);
    else await api('POST', '/api/calendar/events', body);
    toast(editingEventId ? 'Händelse uppdaterad!' : 'Händelse tillagd!', 'success');
    closeModal('modal-calendar-event');
    await loadCalendar();
    if (calSelectedDate) renderSelectedDayEvents();
  } catch(e) { toast(e.message,'error'); }
}

async function deleteCalEvent(id) {
  if (!confirm('Ta bort denna händelse?')) return;
  await api('DELETE', `/api/calendar/events/${id}`);
  toast('Borttagen','success');
  closeModal('modal-calendar-event');
  await loadCalendar();
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTime(datetime) {
  if (!datetime) return '';
  // Parse and display in local time
  try {
    const d = new Date(datetime);
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  } catch(e) {
    return datetime.substring(11,16);
  }
}

function getWeekMonday(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}
