// frontend/src/components/AddWarehouseModal.js
export function AddWarehouseModal() {
  return `
    <div id="modal-add-warehouse" class="modal-overlay hidden">
      <div class="modal">
        <div class="modal-header"><h3 id="wh-modal-title">Nytt lager</h3><button class="modal-close" onclick="closeModal('modal-add-warehouse')">✕</button></div>
        <div class="field"><label>Namn *</label><input type="text" id="new-wh-name" placeholder="t.ex. Bil 1, Garage..."></div>
        <div class="field"><label>Typ</label><select id="new-wh-type"><option value="car">🚐 Bil</option><option value="garage">🏠 Garage</option><option value="warehouse">🏭 Förråd</option><option value="other">📦 Övrigt</option></select></div>
        <div class="field"><label>Beskrivning (valfri)</label><input type="text" id="new-wh-desc" placeholder=""></div>
        <button class="btn btn-primary btn-full" id="save-wh-btn" onclick="saveWarehouse()">Spara</button>
      </div>
    </div>
  `;
}
