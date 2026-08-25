// frontend/src/components/QuantityModal.js
export function QuantityModal() {
  return `
    <div id="modal-quantity" class="modal-overlay hidden">
      <div class="modal">
        <div class="modal-header"><h3 id="qty-modal-title">Antal</h3><button class="modal-close" onclick="closeModal('modal-quantity')">✕</button></div>
        <div class="qty-info" id="qty-modal-info"></div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="adjustQty(-1)">−</button>
          <input type="number" id="qty-input" value="1" min="0.1" step="0.1" class="qty-field">
          <button class="qty-btn" onclick="adjustQty(1)">+</button>
        </div>
        <div class="modal-actions"><button class="btn btn-primary btn-full" onclick="confirmQty()">Lägg till</button></div>
      </div>
    </div>
  `;
}
