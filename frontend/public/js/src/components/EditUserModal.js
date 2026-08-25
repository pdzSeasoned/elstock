// frontend/src/components/EditUserModal.js
export function EditUserModal() {
  return `
    <div id="modal-edit-user" class="modal-overlay hidden">
      <div class="modal">
        <div class="modal-header"><h3 id="user-modal-title">Ny användare</h3><button class="modal-close" onclick="closeModal('modal-edit-user')">✕</button></div>
        <input type="hidden" id="edit-user-id">
        <div class="field"><label>Namn</label><input type="text" id="edit-user-display" placeholder="Visningsnamn"></div>
        <div class="field"><label>Användarnamn</label><input type="text" id="edit-user-username" placeholder="användarnamn"></div>
        <div class="field"><label>Lösenord</label><input type="password" id="edit-user-password" placeholder="Lösenord (min 6 tecken)"></div>
        <div class="field"><label>Roll</label>
          <select id="edit-user-role">
            <option value="user">Användare (standard)</option>
            <option value="admin">Admin (full åtkomst)</option>
          </select>
        </div>
        <div class="field" id="adminkey-row"><label>Admin-nyckel</label><input type="text" id="edit-user-adminkey" placeholder="Fås från .env → ADMIN_KEY"></div>
        <button class="btn btn-primary btn-full" onclick="saveUser()">Spara</button>
        <div id="user-modal-error" class="error-msg hidden"></div>
      </div>
    </div>
  `;
}
