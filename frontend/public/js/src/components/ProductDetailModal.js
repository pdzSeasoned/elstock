// frontend/src/components/ProductDetailModal.js
export function ProductDetailModal() {
  return `
    <div id="modal-product-detail" class="modal-overlay hidden">
      <div class="modal modal-tall">
        <div class="modal-header"><h3 id="detail-product-name">Produkt</h3><button class="modal-close" onclick="closeModal('modal-product-detail')">✕</button></div>
        <div id="product-detail-content" class="product-detail"></div>
        <div class="modal-actions">
          <button class="btn btn-accent btn-full" id="detail-add-to-cart-btn">Lägg i varukorg</button>
          <button class="btn btn-ghost btn-full admin-only" onclick="editCurrentDetailProduct()">✏️ Redigera produkt</button>
        </div>
      </div>
    </div>
  `;
}
