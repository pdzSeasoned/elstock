// frontend/src/components/ProductSearchModal.js
export function ProductSearchModal() {
  return `
    <div id="modal-product-search" class="modal-overlay hidden">
      <div class="modal modal-tall">
        <div class="modal-header"><h3>Sök artikel</h3><button class="modal-close" onclick="closeModal('modal-product-search')">✕</button></div>
        <input type="search" id="product-search-input" placeholder="Sök på namn eller E-nummer..." oninput="searchProducts(this.value)" class="input-full" autofocus>
        <div id="product-search-results" class="search-results"></div>
      </div>
    </div>
  `;
}
