// frontend/src/services/api.js
import store from '../stores/appStore.js';

const API = '';

function showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.innerHTML = '⚠️ Offline — vissa funktioner kan vara begränsade';
  banner.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #f5a623; color: #0d0d14; text-align: center;
    padding: 8px 16px; font-size: 14px; font-weight: 600;
    transition: transform 0.3s ease;
  `;
  document.body.appendChild(banner);
}

function hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.remove();
}

export async function api(method, path, body, withAuth = true, retries = 2) {
  const url = `${API}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const opts = {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(withAuth && store.state.token ? { 'Authorization': `Bearer ${store.state.token}` } : {})
      }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    clearTimeout(timeoutId);

    if (res.status === 401) {
      localStorage.removeItem('elstock_token');
      localStorage.removeItem('elstock_user');
      store.set('token', null);
      store.set('user', null);
      window.location.reload();
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (retries > 0 && (error.name === 'TypeError' || error.name === 'AbortError')) {
      console.warn(`[API] Retry ${path} (${retries} kvar)...`);
      await new Promise(r => setTimeout(r, 1000));
      return api(method, path, body, withAuth, retries - 1);
    }

    if (!navigator.onLine || error.name === 'TypeError') {
      showOfflineBanner();
      store.set('isOffline', true);
      throw new Error('Ingen anslutning till servern. Kontrollera ditt nätverk.');
    }

    throw error;
  }
}
