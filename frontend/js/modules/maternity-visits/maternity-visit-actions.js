// 📁 maternityVisit-actions.js
// ============================================================
// 🧭 Full Permission-Driven Action Handlers for Maternity Visits
// Ultrasound-Parity | Reason Modal (Cancel / Void)
// ============================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./maternity-visit-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("maternityVisitTableBody");
  const cardContainer = document.getElementById("maternityVisitList");

  window.latestMaternityVisitEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission Helpers (Ultrasound-Parity)
  ============================================================ */
  function normalizePermissions(perms) {
    if (!perms) return [];
    if (typeof perms === "string") {
      try {
        return JSON.parse(perms);
      } catch {
        return perms.split(",").map(p => p.trim());
      }
    }
    return Array.isArray(perms) ? perms : [];
  }

  const userPerms = new Set(normalizePermissions(user?.permissions || []));

  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(r => r.toLowerCase().replace(/\s+/g, "") === "superadmin"));

  const hasPerm = (key) => {
    const k = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(k);
  };

  /* ============================================================
     ⚙️ Central Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestMaternityVisitEntries || entries || []).find(
        x => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/maternity-visits/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Maternity visit not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Maternity visit data missing");

    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("maternity_visits:view"))
        return showToast("⛔ No permission to view");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("maternity_visits:edit"))
        return showToast("⛔ No permission to edit");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("maternity_visits:delete"))
        return showToast("⛔ No permission to delete");
      return await handleDelete(id);
    }

    // --- Lifecycle ---
    const lifecycle = {
      start: "Start this maternity visit?",
      complete: "Mark this maternity visit as completed?",
      verify: "Verify this maternity visit?",
      cancel: "Cancel this maternity visit?",
      void: "Void this maternity visit? (Admin/Superadmin only)",
    };

    for (const [key, msg] of Object.entries(lifecycle)) {
      if (cls.contains(`${key}-btn`)) {
        if (!hasPerm(`maternity_visits:${key}`))
          return showToast(`⛔ No permission to ${key}`);
        return await handleLifecycle(
          id,
          key,
          msg,
          ["cancel", "void"].includes(key)
        );
      }
    }
  }

  /* ============================================================
     🧩 Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Maternity Visit Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("maternityVisitEditId", entry.id);
    sessionStorage.setItem("maternityVisitEditPayload", JSON.stringify(entry));
    window.location.href = `add-maternity-visit.html`;
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this maternity visit?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/maternity-visits/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete maternity visit");

      showToast("✅ Maternity visit deleted successfully");
      window.latestMaternityVisitEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete maternity visit");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg, requiresReason = false) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    let reason = null;
    if (requiresReason) {
      reason = await showReasonModal({
        title: action === "void" ? "Void Maternity Visit" : "Cancel Maternity Visit",
        message: "Please provide a reason to proceed.",
      });
      if (!reason) return showToast("⚠️ Reason is required");
    }

    try {
      showLoading();
      const res = await authFetch(`/api/maternity-visits/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: requiresReason ? JSON.stringify({ reason }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action}`);

      showToast(`✅ Maternity visit ${action} successful`);
      window.latestMaternityVisitEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action}`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🧠 Reason Modal (Bootstrap 5)
  ============================================================ */
  async function showReasonModal({ title, message }) {
    return new Promise(resolve => {
      let modal = document.getElementById("reasonModal");
      if (!modal) {
        document.body.insertAdjacentHTML(
          "beforeend",
          `
          <div class="modal fade" id="reasonModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                <div class="modal-header bg-light">
                  <h5 class="modal-title">${title}</h5>
                  <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                  <p>${message}</p>
                  <textarea id="reasonInput" class="form-control" rows="3"></textarea>
                </div>
                <div class="modal-footer">
                  <button class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                  <button id="reasonSubmitBtn" class="btn btn-primary">Submit</button>
                </div>
              </div>
            </div>
          </div>`
        );
        modal = document.getElementById("reasonModal");
      }

      const bsModal = new bootstrap.Modal(modal, { backdrop: "static" });
      bsModal.show();

      const submitBtn = modal.querySelector("#reasonSubmitBtn");
      const input = modal.querySelector("#reasonInput");

      function cleanup(val = null) {
        submitBtn.onclick = null;
        bsModal.hide();
        resolve(val);
      }

      submitBtn.onclick = () => {
        const val = input.value.trim();
        if (!val) return showToast("⚠️ Reason required");
        cleanup(val);
      };

      modal.addEventListener("hidden.bs.modal", () => cleanup(null), { once: true });
    });
  }

  /* ============================================================
     🌐 Global Helpers (Parity)
  ============================================================ */
  const findEntry = id =>
    (window.latestMaternityVisitEntries || entries || []).find(
      x => String(x.id) === String(id)
    );

  window.viewEntry = id => {
    if (!hasPerm("maternity_visits:view"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editEntry = id => {
    if (!hasPerm("maternity_visits:edit"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteEntry = id => {
    if (!hasPerm("maternity_visits:delete"))
      return showToast("⛔ No permission");
    handleDelete(id);
  };

  ["start", "complete", "verify", "cancel", "void"].forEach(action => {
    window[`${action}Entry`] = async id => {
      if (!hasPerm(`maternity_visits:${action}`))
        return showToast("⛔ No permission");
      await handleLifecycle(
        id,
        action,
        `Proceed to ${action} this maternity visit?`,
        ["cancel", "void"].includes(action)
      );
    };
  });
}
