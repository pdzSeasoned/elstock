// frontend/src/components/ScannerModal.js
export function ScannerModal() {
  return `
    <div id="modal-scanner" class="modal-overlay hidden">
      <div class="modal">
        <div class="modal-header"><h3>Skanna streckkod</h3><button class="modal-close" onclick="closeScanner()">✕</button></div>
        <div id="scanner-container"><video id="scanner-video" autoplay playsinline muted></video><div class="scanner-frame"></div></div>
        <div id="scanner-status" class="scanner-status">Rikta kameran mot streckkoden</div>
        <div class="modal-actions">
          <input type="text" id="manual-barcode" placeholder="Eller skriv E-nummer / streckkod manuellt" class="input-full">
          <button class="btn btn-primary btn-full" onclick="submitManualBarcode()">Sök</button>
          <button class="btn btn-ghost btn-full" onclick="closeScanner()">Avbryt</button>
        </div>
      </div>
    </div>
  `;
}
