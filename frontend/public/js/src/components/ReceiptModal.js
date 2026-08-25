// frontend/src/components/ReceiptModal.js
export function ReceiptModal() {
  return `
    <div id="modal-receipt" class="modal-overlay hidden">
      <div class="modal modal-tall">
        <div class="modal-header"><h3>Kvitto</h3><button class="modal-close" onclick="closeModal('modal-receipt')">✕</button></div>
        <div id="receipt-content" class="receipt"></div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-full" onclick="printReceipt()">🖨️ Dela / Skriv ut</button>
          <button class="btn btn-ghost btn-full" onclick="downloadReceiptPDF()">📄 Ladda ner PDF</button>
          <button class="btn btn-ghost btn-full" onclick="closeModal('modal-receipt')">Stäng</button>
        </div>
      </div>
    </div>
  `;
}
