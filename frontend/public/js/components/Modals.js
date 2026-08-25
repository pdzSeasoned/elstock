// components/Modals.js
import Store from '../stores/appStore.js';
import { escHtml } from '../services/api.js';

export const Modals = {
  scanner() {
    return `
      <div class="modal-overlay" id="scanner-modal">
        <div class="modal">
          <div class="modal-header"><h3>Skanna streckkod</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body">
            <div id="scanner-video-container"><video id="scanner-video" playsinline></video></div>
            <div id="scanner-canvas-container" style="display:none"><canvas id="scanner-canvas"></canvas></div>
            <div id="scanner-status">Startar kamera...</div>
          </div>
        </div>
      </div>
    `;
  },

  productSearch() {
    return `
      <div class="modal-overlay" id="product-search-modal">
        <div class="modal">
          <div class="modal-header"><h3>Sök produkt</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body">
            <input type="text" id="ps-search" placeholder="Sök..." class="search-input">
            <div class="search-results" id="ps-results"></div>
          </div>
        </div>
      </div>
    `;
  },

  quantity() {
    return `
      <div class="modal-overlay" id="qty-modal">
        <div class="modal modal-sm">
          <div class="modal-header"><h3>Ange antal</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body">
            <div class="qty-picker">
              <button class="qty-btn" id="qty-minus">−</button>
              <input type="number" id="qty-input" value="1" min="0.1" step="0.1">
              <button class="qty-btn" id="qty-plus">+</button>
            </div>
            <button class="btn btn-primary btn-block" id="qty-confirm">Bekräfta</button>
          </div>
        </div>
      </div>
    `;
  },

  checkout() {
    const cart = Store.get('cart');
    const total = cart.reduce((s, i) => s + (i.price || 0) * i.quantity, 0);
    return `
      <div class="modal-overlay" id="checkout-modal">
        <div class="modal">
          <div class="modal-header"><h3>Kassa</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body">
            <div class="checkout-summary">
              ${cart.map(item => `
                <div class="checkout-item"><span>${escHtml(item.name)} x${item.quantity}</span><span>${((item.price || 0) * item.quantity).toFixed(2)} kr</span></div>
              `).join('')}
              <div class="checkout-total">Totalt: <strong>${total.toFixed(2)} kr</strong></div>
            </div>
            <div class="form-group">
              <label>Välj jobb (valfritt)</label>
              <select id="checkout-job-select"><option value="">-- Välj jobb --</option></select>
            </div>
            <button class="btn btn-primary btn-block" id="confirm-checkout-btn">Slutför uttag</button>
          </div>
        </div>
      </div>
    `;
  },

  receipt() {
    return `
      <div class="modal-overlay" id="receipt-modal">
        <div class="modal">
          <div class="modal-header"><h3>Kvitto</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="receipt-body"></div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="receipt-print">Skriv ut</button>
            <button class="btn btn-primary" id="receipt-close">Stäng</button>
          </div>
        </div>
      </div>
    `;
  },

  editProduct() {
    return `
      <div class="modal-overlay" id="edit-product-modal">
        <div class="modal modal-lg">
          <div class="modal-header"><h3>Redigera produkt</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="edit-product-body"></div>
        </div>
      </div>
    `;
  },

  productDetail() {
    return `
      <div class="modal-overlay" id="product-detail-modal">
        <div class="modal modal-lg">
          <div class="modal-header"><h3>Produktdetaljer</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="product-detail-body"></div>
        </div>
      </div>
    `;
  },

  addWarehouse() {
    return `
      <div class="modal-overlay" id="add-warehouse-modal">
        <div class="modal">
          <div class="modal-header"><h3>Nytt lager</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body">
            <input type="text" id="wh-name" placeholder="Namn" class="form-input">
            <input type="text" id="wh-address" placeholder="Adress" class="form-input">
            <select id="wh-type" class="form-input">
              <option value="warehouse">Lager</option>
              <option value="car">Bil</option>
              <option value="garage">Garage</option>
              <option value="other">Annat</option>
            </select>
            <button class="btn btn-primary btn-block" id="save-wh-btn">Spara</button>
          </div>
        </div>
      </div>
    `;
  },

  editUser() {
    return `
      <div class="modal-overlay" id="edit-user-modal">
        <div class="modal">
          <div class="modal-header"><h3>Redigera användare</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="edit-user-body"></div>
        </div>
      </div>
    `;
  },

  changePassword() {
    return `
      <div class="modal-overlay" id="change-password-modal">
        <div class="modal">
          <div class="modal-header"><h3>Byt lösenord</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body">
            <input type="password" id="cp-old" placeholder="Nuvarande lösenord" class="form-input">
            <input type="password" id="cp-new" placeholder="Nytt lösenord" class="form-input">
            <input type="password" id="cp-confirm" placeholder="Bekräfta lösenord" class="form-input">
            <button class="btn btn-primary btn-block" id="cp-save">Spara</button>
          </div>
        </div>
      </div>
    `;
  },

  editCategory() {
    return `
      <div class="modal-overlay" id="edit-category-modal">
        <div class="modal">
          <div class="modal-header"><h3>Redigera kategori</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="edit-category-body"></div>
        </div>
      </div>
    `;
  },

  jobForm() {
    return `
      <div class="modal-overlay" id="job-form-modal">
        <div class="modal modal-lg">
          <div class="modal-header"><h3>Jobb</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="job-form-body"></div>
        </div>
      </div>
    `;
  },

  jobNote() {
    return `
      <div class="modal-overlay" id="job-note-modal">
        <div class="modal">
          <div class="modal-header"><h3>Anteckning</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body">
            <textarea id="job-note-text" class="form-textarea" rows="4"></textarea>
            <button class="btn btn-primary btn-block" id="save-note-btn">Spara</button>
          </div>
        </div>
      </div>
    `;
  },

  jobMaterial() {
    return `
      <div class="modal-overlay" id="job-material-modal">
        <div class="modal modal-lg">
          <div class="modal-header"><h3>Lägg till material</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body">
            <input type="text" id="mat-search" placeholder="Sök produkt..." class="search-input">
            <div class="search-results" id="mat-results"></div>
            <div class="qty-picker">
              <button class="qty-btn" id="mat-qty-minus">−</button>
              <input type="number" id="mat-qty" value="1" min="1">
              <button class="qty-btn" id="mat-qty-plus">+</button>
            </div>
            <button class="btn btn-primary btn-block" id="add-mat-btn">Lägg till</button>
          </div>
        </div>
      </div>
    `;
  },

  customerForm() {
    return `
      <div class="modal-overlay" id="customer-form-modal">
        <div class="modal">
          <div class="modal-header"><h3>Kund</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="customer-form-body"></div>
        </div>
      </div>
    `;
  },

  jobBooking() {
    return `
      <div class="modal-overlay" id="job-booking-modal">
        <div class="modal">
          <div class="modal-header"><h3>Boka jobb</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="job-booking-body"></div>
        </div>
      </div>
    `;
  },

  calendarEvent() {
    return `
      <div class="modal-overlay" id="cal-event-modal">
        <div class="modal">
          <div class="modal-header"><h3>Händelse</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="cal-event-body"></div>
        </div>
      </div>
    `;
  },

  editPermissions() {
    return `
      <div class="modal-overlay" id="edit-perm-modal">
        <div class="modal modal-lg">
          <div class="modal-header"><h3>Behörigheter</h3><button class="icon-btn close-modal"><i class="fas fa-times"></i></button></div>
          <div class="modal-body" id="edit-perm-body"></div>
        </div>
      </div>
    `;
  }
};
