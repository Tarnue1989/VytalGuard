// 📁 ultrasoundRecord-actions.js
// ============================================================
// 🧭 Full Permission-Driven Action Handlers for Ultrasound Records
// With Reason Modal (Cancel / Void)
// ============================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./ultrasound-record-render.js";

/**
 * Unified, permission-driven action handler
 * Mirrors consultation-actions.js (superadmin-aware)
 */
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
  const tableBody = document.getElementById("ultrasoundRecordTableBody");
  const cardContainer = document.getElementById("ultrasoundRecordList");

  window.latestUltrasoundEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Normalize + Check Permissions
  ============================================================ */
  function normalizePermissions(perms) {
    if (!perms) return [];
    if (typeof perms === "string") {
      try {
        return JSON.parse(perms);
      } catch {
        return perms.split(",").map((p) => p.trim());
      }
    }
    return Array.isArray(perms) ? perms : [];
  }

  const userPerms = new Set(normalizePermissions(user?.permissions || []));

  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ============================================================
     ⚙️ Central Action Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestUltrasoundEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/ultrasound-records/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Ultrasound record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Ultrasound record data missing");
    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("ultrasound_records:view"))
        return showToast("⛔ No permission to view");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("ultrasound_records:edit"))
        return showToast("⛔ No permission to edit");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("ultrasound_records:delete"))
        return showToast("⛔ No permission to delete");
      return await handleDelete(id, entry);
    }

    // --- Lifecycle Actions ---
    const lifecycleActions = {
      start: "Start this ultrasound?",
      complete: "Mark this ultrasound as completed?",
      verify: "Verify this ultrasound?",
      finalize: "Finalize this ultrasound? (Admin/Superadmin only)",
      cancel: "Cancel this ultrasound?",
      void: "Void this ultrasound? (Admin/Superadmin only)",
    };

    for (const [key, msg] of Object.entries(lifecycleActions)) {
      if (cls.contains(`${key}-btn`)) {
        if (!hasPerm(`ultrasound_records:${key}`))
          return showToast(`⛔ No permission to ${key} ultrasound`);

        const requiresReason = ["cancel", "void"].includes(key);
        return await handleLifecycle(id, key, msg, requiresReason);
      }
    }
  }

  /* ============================================================
     🧩 Individual Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Ultrasound Record Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("ultrasoundEditId", entry.id);
    sessionStorage.setItem("ultrasoundEditPayload", JSON.stringify(entry));
    window.location.href = `add-ultrasound-record.html`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this ultrasound record?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/ultrasound-records/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete ultrasound record");

      showToast(`✅ Ultrasound record deleted successfully`);
      window.latestUltrasoundEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete ultrasound record");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     📋 Lifecycle Handler (with Reason Modal Support)
  ============================================================ */
  async function handleLifecycle(id, action, confirmMsg, requiresReason = false) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    let reason = null;

    if (requiresReason) {
      reason = await showReasonModal({
        title: action === "void" ? "Void Ultrasound" : "Cancel Ultrasound",
        message:
          "Please provide a reason to proceed. This action will be logged and may trigger billing rollback.",
      });
      if (!reason) return showToast("⚠️ Reason is required to proceed.");
    }

    try {
      showLoading();
      const res = await authFetch(`/api/ultrasound-records/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: requiresReason ? JSON.stringify({ reason }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} ultrasound`);

      showToast(`✅ Ultrasound ${action} successful`);
      window.latestUltrasoundEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} ultrasound`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🧠 Reusable Reason Modal (Bootstrap 5)
  ============================================================ */
  async function showReasonModal({ title, message }) {
    return new Promise((resolve) => {
      let modal = document.getElementById("reasonModal");
      if (!modal) {
        const modalHTML = `
        <div class="modal fade" id="reasonModal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header bg-light">
                <h5 class="modal-title">${title}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <p class="mb-2">${message}</p>
                <textarea id="reasonInput" class="form-control" rows="3" placeholder="Enter reason..."></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                <button type="button" id="reasonSubmitBtn" class="btn btn-primary">Submit</button>
              </div>
            </div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML("beforeend", modalHTML);
        modal = document.getElementById("reasonModal");
      }

      const bsModal = new bootstrap.Modal(modal, { backdrop: "static" });
      bsModal.show();

      const input = modal.querySelector("#reasonInput");
      const submitBtn = modal.querySelector("#reasonSubmitBtn");

      function cleanup(value = null) {
        submitBtn.removeEventListener("click", handleSubmit);
        modal.removeEventListener("hidden.bs.modal", handleCancel);
        bsModal.hide();
        resolve(value);
      }

      function handleSubmit() {
        const val = input.value.trim();
        if (!val) {
          showToast("⚠️ Please provide a reason before submitting.");
          return;
        }
        cleanup(val);
      }

      function handleCancel() {
        cleanup(null);
      }

      submitBtn.addEventListener("click", handleSubmit);
      modal.addEventListener("hidden.bs.modal", handleCancel);
    });
  }

  /* ============================================================
     🌐 Global Helper Shortcuts
  ============================================================ */
  const findEntry = (id) =>
    (window.latestUltrasoundEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("ultrasound_records:view"))
      return showToast("⛔ No permission to view ultrasound");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Ultrasound record not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("ultrasound_records:edit"))
      return showToast("⛔ No permission to edit ultrasound");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Ultrasound record not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("ultrasound_records:delete"))
      return showToast("⛔ No permission to delete ultrasound");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  ["start", "complete", "verify", "finalize", "cancel", "void"].forEach(
    (action) => {
      window[`${action}Entry`] = async (id) => {
        if (!hasPerm(`ultrasound_records:${action}`))
          return showToast(`⛔ No permission to ${action} ultrasound`);
        const entry = findEntry(id);
        await handleLifecycle(
          id,
          action,
          `Proceed to ${action} this ultrasound?`,
          ["cancel", "void"].includes(action)
        );
      };
    }
  );
}
