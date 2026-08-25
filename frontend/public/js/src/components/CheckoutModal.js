// frontend/src/components/CheckoutModal.js
export function CheckoutModal() {
  return `
    <div id="modal-checkout" class="modal-overlay hidden">
      <div class="modal modal-tall">
        <div class="modal-header"><h3>Slutför uttag</h3><button class="modal-close" onclick="closeModal('modal-checkout')">✕</button></div>
        <div id="checkout-job-picker" style="display:none"></div>
        <div id="checkout-manual-fields">
          <div class="field"><label>Kund / Adress</label><input type="text" id="checkout-customer" placeholder="Kundens namn"><input type="text" id="checkout-address" placeholder="Adress" style="margin-top:8px"></div>
          <div class="field"><label>Arbetsnummer / AO</label><input type="text" id="checkout-workorder" placeholder="t.ex. AO-2024-001"></div>
        </div>
        <div class="field"><label>Anteckning (valfri)</label><textarea id="checkout-notes" rows="2"></textarea></div>
        <div id="checkout-items-summary" class="checkout-summary"></div>
        <button class="btn btn-primary btn-full" onclick="submitCheckout()">Bekräfta &amp; skapa kvitto</button>
      </div>
    </div>
  `;
}
