// frontend/src/components/EditProductModal.js
export function EditProductModal() {
  return `
    <div id="modal-edit-product" class="modal-overlay hidden">
      <div class="modal modal-tall">
        <div class="modal-header"><h3 id="edit-product-title">Ny produkt</h3><button class="modal-close" onclick="closeModal('modal-edit-product')">✕</button></div>
        <input type="hidden" id="edit-product-id">
        <div class="image-upload-area" id="image-upload-area" onclick="triggerImageUpload()">
          <img id="edit-product-img-preview" src="" style="display:none">
          <div class="upload-hint"><div class="upload-icon">📷</div><div>Tryck för att lägga till bild</div><div style="font-size:11px;margin-top:4px;color:var(--muted)">JPG, PNG — max 5MB</div></div>
          <div class="image-upload-overlay">
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();changeProductImage()">Byt bild</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();removeProductImage()">Ta bort</button>
          </div>
        </div>
        <input type="file" id="image-file-input" accept="image/*" style="display:none" onchange="handleImageFile(this)">
        <div class="field"><label>E-nummer *</label><input type="text" id="edit-e-number" placeholder="t.ex. 5161234" inputmode="numeric"></div>
        <div class="field"><label>Namn *</label><input type="text" id="edit-product-name" placeholder="Artikelnamn"></div>
        <div class="field"><label>Kategori</label><select id="edit-category-id" onchange="onCategoryChange(this.value)"><option value="">-- Välj kategori --</option></select></div>
        <div class="field"><label>Märke</label><select id="edit-brand"><option value="">-- Välj märke --</option></select></div>
        <div id="edit-attr-fields" class="attr-grid"></div>
        <div style="display:flex;gap:10px;margin-top:4px">
          <div class="field" style="flex:1"><label>Enhet</label><select id="edit-unit"><option value="st">st</option><option value="m">m</option><option value="förp">förp</option><option value="par">par</option><option value="rulle">rulle</option><option value="box">box</option></select></div>
          <div class="field" style="flex:2"><label>Streckkod (valfri)</label><div style="display:flex;gap:6px"><input type="text" id="edit-barcode" placeholder="EAN/QR" style="flex:1"><button class="btn btn-ghost btn-sm" onclick="openScanModal('edit-barcode-scan')">📷</button></div></div>
        </div>
        <div class="field"><label>Beskrivning</label><textarea id="edit-description" rows="2"></textarea></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-primary" style="flex:1" onclick="saveEditProduct()">Spara</button>
          <button id="delete-product-btn" class="btn btn-danger btn-sm" onclick="deleteProduct()" style="display:none">🗑</button>
        </div>
      </div>
    </div>
  `;
}
