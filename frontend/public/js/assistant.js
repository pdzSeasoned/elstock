// ─── ELSTOCK VOICE ASSISTANT ──────────────────────────────────────────────────
let assistantOpen = false;
let recognition = null;
let isListening = false;
let isSpeaking = false;
let assistantContext = null;
let audioUnlocked = false;

async function openAssistant() {
  if (assistantOpen) return;
  assistantOpen = true;

  const overlay = document.createElement('div');
  overlay.className = 'assistant-overlay';
  overlay.id = 'assistant-overlay';
  overlay.innerHTML = `
    <button class="assistant-close" onclick="closeAssistant()">✕</button>
    <div class="assistant-orb" id="assistant-orb" onclick="unlockAudio()">🎙️</div>
    <div class="assistant-status" id="assistant-status">Laddar...</div>
    <div class="assistant-transcript" id="assistant-transcript"></div>
    <div class="assistant-response" id="assistant-response"></div>
    <div class="assistant-actions" id="assistant-actions"></div>
    <div class="assistant-hint">📱 Tryck på cirkeln en gång för att aktivera ljud på iPhone</div>
  `;
  document.body.appendChild(overlay);

  try {
    assistantContext = await api('GET', '/api/assistant/context');
    setAssistantStatus('Tryck på cirkeln för att starta');
    if (!(/iPhone|iPad|iPod/i.test(navigator.userAgent))) {
      unlockAudio();
    }
  } catch(e) {
    setAssistantStatus('Kunde inte ladda data');
  }
}

function unlockAudio() {
  if (!audioUnlocked) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().then(() => { audioUnlocked = true; });
    const u = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(u);
  }
  if (!isListening && !isSpeaking) {
    startListening();
  }
}

function closeAssistant() {
  assistantOpen = false;
  audioUnlocked = false;
  stopListening();
  window.speechSynthesis?.cancel();
  document.getElementById('assistant-overlay')?.remove();
}

// ── SPEECH RECOGNITION ────────────────────────────────────────────────────────
function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    setAssistantStatus('Röstinmatning fungerar bara i Chrome/Safari');
    return;
  }

  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'sv-SE';

  let finalTranscript = '';

  recognition.onstart = () => {
    isListening = true;
    finalTranscript = '';
    setOrbState('listening');
    setAssistantStatus('Lyssnar...');
    document.getElementById('assistant-transcript').textContent = '';
  };

  recognition.onresult = (e) => {
    let interim = '';
    finalTranscript = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript;
      else interim += e.results[i][0].transcript;
    }
    document.getElementById('assistant-transcript').textContent = finalTranscript || interim;
  };

  recognition.onend = () => {
    isListening = false;
    if (finalTranscript.trim() && assistantOpen) {
      handleVoiceInput(finalTranscript.trim());
    } else if (assistantOpen && !isSpeaking) {
      setTimeout(() => { if (assistantOpen && !isSpeaking) startListening(); }, 800);
    }
  };

  recognition.onerror = (e) => {
    isListening = false;
    if (e.error === 'no-speech' || e.error === 'aborted') {
      if (assistantOpen && !isSpeaking) setTimeout(() => startListening(), 500);
    } else if (e.error === 'not-allowed') {
      setAssistantStatus('Mikrofonåtkomst nekad — kontrollera webbläsarinställningar');
    }
  };

  try { recognition.start(); } catch(e) {}
}

function stopListening() {
  isListening = false;
  try { recognition?.abort(); } catch(e) {}
  recognition = null;
}

// ── PROCESS INPUT ─────────────────────────────────────────────────────────────
async function handleVoiceInput(text) {
  if (!text.trim()) return;
  stopListening();
  setOrbState('thinking');
  setAssistantStatus('Tänker...');
  document.getElementById('assistant-response').textContent = '';
  document.getElementById('assistant-actions').innerHTML = '';

  try {
    const response = await callGroq(text);
    displayResponse(response);
  } catch(e) {
    const msg = 'Något gick fel, försök igen.';
    document.getElementById('assistant-response').textContent = msg;
    speak(msg);
  }
}

async function callGroq(userInput) {
  const ctx = assistantContext;
  const now = new Date();
  const todayStr = now.toLocaleDateString('sv-SE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const timeStr = now.toLocaleTimeString('sv-SE', { hour:'2-digit', minute:'2-digit' });

  const lowStockList = ctx.lowStock.slice(0,8).map(i =>
    `- ${i.name} (E:${i.e_number}): ${i.quantity} ${i.unit} kvar i ${i.warehouse} (min ${i.min_quantity})`
  ).join('\n');

  const inventoryList = ctx.inventory.slice(0,20).map(i =>
    `${i.warehouse}|${i.name}|E:${i.e_number}|${i.quantity}${i.unit}`
  ).join('\n');

  const jobsList = ctx.activeJobs.slice(0,5).map(j =>
    `ID:${j.id} ${j.customer_name}${j.order_number?' AO:'+j.order_number:''} ${j.address||''} ${j.deadline?'Deadline:'+j.deadline:''}`
  ).join('\n');

  const todayEventsList = ctx.todayEvents?.map(e =>
    `${e.start_datetime.substring(11,16)} ${e.title}`
  ).join('\n') || 'Inga händelser idag';

  const weekEventsList = ctx.weekEvents?.map(e =>
    `${e.start_datetime.substring(0,10)} ${e.start_datetime.substring(11,16)} ${e.title}`
  ).join('\n') || 'Inga kommande händelser';

  const systemPrompt = `Du ar ElStock-assistenten for en elektriker. Svara ALLTID pa svenska om anvandaren pratar svenska, engelska om de pratar engelska.
Idag ar: ${todayStr}, klockan ar ${timeStr}.

LAGER (${ctx.inventory.length} artiklar totalt):
${inventoryList}

LAGT LAGER (${ctx.lowStock.length} st behover fyllas pa):
${lowStockList || 'Inget lagt lager'}

AKTIVA JOBB:
${jobsList || 'Inga aktiva jobb'}

DAGENS KALENDER:
${todayEventsList}

KOMMANDE 7 DAGAR:
${weekEventsList}

REGLER:
- Svara med MAX 2 korta meningar - du talar hogljutt
- Inga asterisker, markdown eller listor
- Du KAN skapa kalenderhander, lagga till i varukorg och skapa anteckningar
- Nar du vill utfora en atgard, lagg till ACTION: pa sista raden

TILLGANGLIGA ACTIONS:
ACTION:{"type":"create_calendar_event","title":"...","start_datetime":"2026-04-18T08:00:00","end_datetime":"2026-04-18T09:00:00","all_day":false,"reminder_minutes":60}
ACTION:{"type":"add_to_cart","e_number":"...","name":"...","quantity":1}
ACTION:{"type":"navigate","screen":"inventory"}
ACTION:{"type":"navigate","screen":"jobs"}
ACTION:{"type":"navigate","screen":"calendar"}
ACTION:{"type":"show_low_stock"}`;

  const response = await api('POST', '/api/assistant/chat', {
    message: userInput,
    system: systemPrompt
  });

  return response.text || 'Forstod inte.';
}

// ── DISPLAY & ACTIONS ─────────────────────────────────────────────────────────
function displayResponse(fullText) {
  const actionMatches = [...fullText.matchAll(/ACTION:(\{[^}]+\})/g)];
  const cleanText = fullText.replace(/ACTION:\{[^}]+\}/g, '').replace(/\*+/g,'').trim();

  document.getElementById('assistant-response').textContent = cleanText;
  document.getElementById('assistant-transcript').textContent = '';

  const actionsEl = document.getElementById('assistant-actions');
  actionsEl.innerHTML = '';

  for (const match of actionMatches) {
    try {
      executeAction(JSON.parse(match[1]), actionsEl);
    } catch(e) {}
  }

  speak(cleanText);
}

async function executeAction(action, actionsEl) {
  switch(action.type) {
    case 'create_calendar_event':
      const calRes = await api('POST', '/api/assistant/action', { action: 'create_calendar_event', params: action }).catch(()=>null);
      if (calRes?.success) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-accent';
        btn.textContent = `✓ "${action.title}" tillagd i kalendern`;
        btn.disabled = true;
        actionsEl.appendChild(btn);
        if (typeof loadCalendar !== 'undefined') loadCalendar();
      }
      break;

    case 'add_to_cart':
      const inv = assistantContext?.inventory?.find(i =>
        i.e_number === action.e_number || i.name?.toLowerCase().includes((action.name||'').toLowerCase())
      );
      if (inv) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-accent';
        btn.textContent = `+ ${action.quantity||1} × ${inv.name} i varukorg`;
        btn.onclick = async () => {
          const p = await api('GET', `/api/products/barcode/${inv.e_number}`).catch(()=>null);
          if (p) { addToCart({ product_id:p.id, e_number:p.e_number, name:p.name, unit:p.unit, available:inv.quantity }, action.quantity||1); updateCartBadge(); }
          btn.textContent = '✓ Tillagd!'; btn.disabled = true;
        };
        actionsEl.appendChild(btn);
      }
      break;

    case 'navigate':
      const navBtn = document.createElement('button');
      const names = { inventory:'Lager', jobs:'Jobb', cart:'Varukorg', customers:'Kunder', calendar:'Kalender' };
      navBtn.className = 'btn btn-ghost';
      navBtn.textContent = `→ Gå till ${names[action.screen]||action.screen}`;
      navBtn.onclick = () => { closeAssistant(); showScreen(action.screen); };
      actionsEl.appendChild(navBtn);
      break;

    case 'show_low_stock':
      const lsBtn = document.createElement('button');
      lsBtn.className = 'btn btn-warn';
      lsBtn.textContent = `⚠️ ${assistantContext.lowStock.length} artiklar lågt lager`;
      lsBtn.onclick = () => { closeAssistant(); showScreen('notifications'); };
      actionsEl.appendChild(lsBtn);
      break;
  }
}

// ── SPEECH SYNTHESIS ──────────────────────────────────────────────────────────
function getBestVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Prioritized voice names (best quality first)
  const preferred = [
    v => v.name === 'Alva',                                          // iOS svenska (bäst)
    v => v.name.includes('Alva'),                                    // iOS svenska variant
    v => v.name.includes('Google') && v.lang === 'sv-SE',           // Chrome svenska
    v => v.name.includes('Microsoft') && v.lang === 'sv-SE',        // Edge svenska
    v => v.lang === 'sv-SE',                                         // valfri sv-SE
    v => v.lang.startsWith('sv'),                                    // valfri svenska
    v => v.lang.startsWith('en') && v.name.includes('Google'),      // Google engelska fallback
    v => v.default,                                                  // systemets standard
  ];

  for (const test of preferred) {
    const match = voices.find(test);
    if (match) return match;
  }
  return voices[0];
}

function speak(text) {
  if (!window.speechSynthesis || !text.trim()) {
    finishSpeaking();
    return;
  }
  window.speechSynthesis.cancel();
  isSpeaking = true;
  setOrbState('speaking');
  setAssistantStatus('Pratar...');

  const utterance = new SpeechSynthesisUtterance(text);

  const doSpeak = () => {
    const voice = getBestVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;   // lite långsammare = naturligare
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;
    window.speechSynthesis.speak(utterance);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    // Röster inte laddade ännu (vanligt på iOS)
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      doSpeak();
    };
  } else {
    doSpeak();
  }

  // Säkerhetstimeout ifall onend aldrig triggar (iOS-bugg)
  setTimeout(() => { if (isSpeaking) finishSpeaking(); }, Math.max(3000, text.length * 80));
}

function finishSpeaking() {
  isSpeaking = false;
  if (assistantOpen) {
    setOrbState('listening');
    setAssistantStatus('Lyssnar...');
    setTimeout(() => { if (assistantOpen && !isListening) startListening(); }, 500);
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function setOrbState(state) {
  const orb = document.getElementById('assistant-orb');
  if (!orb) return;
  orb.className = 'assistant-orb ' + state;
  orb.textContent = state==='thinking' ? '⚡' : state==='speaking' ? '🔊' : '🎙️';
}
function setAssistantStatus(text) {
  const el = document.getElementById('assistant-status');
  if (el) el.textContent = text;
}