// ─── BARCODE SCANNER ─────────────────────────────────────────────────────────
// Uses BarcodeDetector API where available, falls back to ZXing Browser from CDN

let scanStream = null;
let scanInterval = null;
let currentScanTarget = null;
let zxingReader = null;
let zxingLoaded = false;

function openScanModal(target) {
  currentScanTarget = target;
  document.getElementById('manual-barcode').value = '';
  document.getElementById('scanner-status').textContent = 'Startar kamera...';
  openModal('modal-scanner');
  startCamera();
}

async function startCamera() {
  try {
    // Stop any existing stream
    stopCamera();

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    scanStream = stream;
    const video = document.getElementById('scanner-video');
    video.srcObject = stream;
    await video.play();
    document.getElementById('scanner-status').textContent = 'Rikta kameran mot streckkoden';

    // Try BarcodeDetector first (Chrome, Edge, Safari 17+)
    if ('BarcodeDetector' in window) {
      try {
        const supported = await BarcodeDetector.getSupportedFormats().catch(() => []);
        const formats = supported.length > 0 ? supported : ['ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e','itf','data_matrix'];
        const detector = new BarcodeDetector({ formats });
        let lastCode = null;
        let lastTime = 0;
        scanInterval = setInterval(async () => {
          if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              const now = Date.now();
              // Debounce — same code within 2s = ignore
              if (code === lastCode && now - lastTime < 2000) return;
              lastCode = code; lastTime = now;
              document.getElementById('scanner-status').textContent = '✓ Hittade: ' + code;
              clearInterval(scanInterval); scanInterval = null;
              setTimeout(() => handleScannedCode(code), 300);
            }
          } catch(e) {}
        }, 200);
        return;
      } catch (bdErr) {
        console.warn('BarcodeDetector failed, will try ZXing fallback:', bdErr);
      }
    }

    // Fallback — load ZXing Browser dynamically and use it
    await loadZxingAndStart(video);

  } catch(e) {
    if (e.name === 'NotAllowedError') {
      document.getElementById('scanner-status').textContent = '❌ Kameraåtkomst nekad — ange E-nummer manuellt nedan';
    } else if (e.name === 'NotFoundError') {
      document.getElementById('scanner-status').textContent = '❌ Ingen kamera hittades — ange manuellt';
    } else {
      document.getElementById('scanner-status').textContent = '❌ ' + e.message;
    }
  }
}

async function loadZxingAndStart(video) {
  document.getElementById('scanner-status').textContent = 'Laddar skanner-bibliotek...';
  try {
    if (!zxingLoaded) {
      await loadScript('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/index.min.js');
      zxingLoaded = true;
    }

    const formats = [
      ZXingBrowser.BarcodeFormat.EAN_13,
      ZXingBrowser.BarcodeFormat.EAN_8,
      ZXingBrowser.BarcodeFormat.CODE_128,
      ZXingBrowser.BarcodeFormat.CODE_39,
      ZXingBrowser.BarcodeFormat.QR_CODE,
      ZXingBrowser.BarcodeFormat.UPC_A,
      ZXingBrowser.BarcodeFormat.UPC_E,
      ZXingBrowser.BarcodeFormat.ITF,
      ZXingBrowser.BarcodeFormat.DATA_MATRIX
    ];

    const hints = new Map();
    hints.set(ZXingBrowser.DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(ZXingBrowser.DecodeHintType.TRY_HARDER, true);

    zxingReader = new ZXingBrowser.BrowserMultiFormatReader(hints);

    document.getElementById('scanner-status').textContent = 'Rikta kameran mot streckkoden';

    let lastCode = null;
    let lastTime = 0;

    // Use ZXing's built-in continuous scanning
    zxingReader.decodeFromVideoElement(video, (result, error) => {
      if (result) {
        const code = result.getText();
        const now = Date.now();
        if (code === lastCode && now - lastTime < 2000) return;
        lastCode = code; lastTime = now;
        document.getElementById('scanner-status').textContent = '✓ Hittade: ' + code;
        setTimeout(() => handleScannedCode(code), 300);
      }
    });

  } catch (err) {
    console.error('ZXing fallback failed:', err);
    document.getElementById('scanner-status').textContent = 'Automatisk skanning ej tillgänglig — ange manuellt';
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function stopCamera() {
  if (scanStream) {
    scanStream.getTracks().forEach(t => t.stop());
    scanStream = null;
  }
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (zxingReader) {
    try { zxingReader.reset(); } catch(e) {}
    zxingReader = null;
  }
  const video = document.getElementById('scanner-video');
  if (video) { video.srcObject = null; }
}

function closeScanner() {
  stopCamera();
  closeModal('modal-scanner');
}

function submitManualBarcode() {
  const val = document.getElementById('manual-barcode').value.trim();
  if (!val) { toast('Ange ett E-nummer eller streckkod', 'error'); return; }
  closeScanner();
  handleScannedCode(val);
}

// Allow Enter key in manual input
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('manual-barcode');
  if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') submitManualBarcode(); });
});

async function handleScannedCode(code) {
  // Handle edit-barcode-scan target (product form)
  if (currentScanTarget === 'edit-barcode-scan') {
    document.getElementById('edit-barcode').value = code;
    return;
  }

  try {
    const product = await api('GET', `/api/products/barcode/${encodeURIComponent(code)}`);
    const inv = activeWarehouse ? inventory.find(i => i.product_id === product.id) : null;

    if (currentScanTarget === 'cart-scan') {
      openQtyModal({ product_id: product.id, e_number: product.e_number, name: product.name, unit: product.unit, available: inv?.quantity ?? 0 }, 'cart');
    } else if (currentScanTarget === 'restock-scan') {
      openQtyModal({ product_id: product.id, e_number: product.e_number, name: product.name, unit: product.unit }, 'restock');
    } else if (currentScanTarget === 'inventory-scan') {
      if (!inv) {
        if (confirm(`${product.name} finns inte i ${activeWarehouse?.name}. Lägg till?`)) {
          await api('POST', '/api/inventory/add-product', { warehouse_id: activeWarehouse.id, product_id: product.id, min_quantity: 2 });
          toast('Produkt tillagd i lagret', 'success');
          loadInventory();
        }
      } else {
        showInventoryDetail(product.id);
      }
    }
  } catch(e) {
    // Product not found
    toast(`Artikel "${code}" hittades inte`, 'warn');
    const create = confirm(`Artikel med kod "${code}" hittades inte.\nVill du skapa den?`);
    if (create) {
      showEditProductModal(null);
      setTimeout(() => {
        document.getElementById('edit-barcode').value = code;
        document.getElementById('edit-e-number').focus();
      }, 400);
    }
  }
}
