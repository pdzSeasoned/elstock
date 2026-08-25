// frontend/src/components/ChangePasswordModal.js
export function ChangePasswordModal() {
  return `
    <div id="modal-change-pw" class="modal-overlay hidden">
      <div class="modal">
        <div class="modal-header"><h3>Ändra lösenord</h3><button class="modal-close" onclick="closeModal('modal-change-pw')">✕</button></div>
        <div class="field"><label>Nuvarande lösenord</label><input type="password" id="pw-current"></div>
        <div class="field"><label>Nytt lösenord</label><input type="password" id="pw-new"></div>
        <button class="btn btn-primary btn-full" onclick="changePassword()">Spara</button>
        <div id="pw-error" class="error-msg hidden"></div>
      </div>
    </div>
  `;
}
