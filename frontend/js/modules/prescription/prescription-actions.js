// 📁 prescription-actions.js
// ============================================================
// 💊 Full Permission-Driven Action Handlers for Prescriptions
// Enterprise-Aligned (Based on Lab Request Master Pattern)
// ============================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./prescription-render.js";

/**
 * Unified, permission-driven action handler
 * (Aligned with Lab Request / Central Stock Master Pattern)
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
  const tableBody = document.getElementById("prescriptionTableBody");
  const cardContainer = document.getElementById("prescriptionList");

  // Cache globally for re-access
  window.latestPrescriptionEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission Normalization + Role Handling
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
      user.roleNames.some((r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"));

  const hasPerm = (key) => {
    const normalizedKey = key.replace(/prescriptions/gi, "prescriptions").trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ============================================================
     🧩 Human-Readable Description (Used in Confirm Prompts)
  ============================================================ */
  function formatPrescriptionDesc(entry) {
    const patient = entry.patient
      ? `${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim()
      : "Unknown Patient";

    let meds = "Unknown Medication";
    if (Array.isArray(entry.items) && entry.items.length > 0) {
      meds = entry.items
        .map((i) => i.medication?.name || i.billableItem?.name || "")
        .filter(Boolean)
        .join(", ");
    }

    const date = entry.prescription_date || entry.created_at || "Unknown Date";
    return `${meds} for ${patient} (${date})`;
  }

  /* ============================================================
     ⚙️ Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestPrescriptionEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/prescriptions/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Prescription not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Prescription data missing");
    const cls = btn.classList;

    // --- Basic View ---
    if (cls.contains("view-btn")) return handleView(entry);

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("prescriptions:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("prescriptions:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    // --- Restore ---
    if (cls.contains("restore-btn")) {
      if (!hasPerm("prescriptions:restore"))
        return showToast("⛔ You don't have permission to restore");
      return await handleRestore(id, entry);
    }

    // --- Lifecycle Actions ---
    const lifecycleActions = {
      submit: "Submit this prescription?",
      activate: "Activate this prescription?",
      complete: "Mark this prescription as completed?",
      verify: "Verify this prescription?",
      cancel: "Cancel this prescription?",
      void: "Void this prescription? (Admin/Superadmin only)",
    };

    for (const [key, msg] of Object.entries(lifecycleActions)) {
      if (cls.contains(`${key}-btn`)) {
        if (!hasPerm(`prescriptions:${key}`))
          return showToast(`⛔ No permission to ${key} prescription`);
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
    openViewModal("Prescription Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("prescriptionEditId", entry.id);
    sessionStorage.setItem("prescriptionEditPayload", JSON.stringify(entry));
    window.location.href = `add-prescription.html?id=${entry.id}`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete prescription for "${entry.patient?.full_name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/prescriptions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete prescription");

      showToast(`✅ Prescription deleted successfully`);
      window.latestPrescriptionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete prescription");
    } finally {
      hideLoading();
    }
  }

  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore prescription for "${entry.patient?.full_name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/prescriptions/${id}/restore`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to restore prescription");

      showToast(`✅ Prescription restored successfully`);
      window.latestPrescriptionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to restore prescription");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🧠 Lifecycle Handler (with Reason Modal)
  ============================================================ */
  async function handleLifecycle(id, action, confirmMsg, requiresReason = false) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    let reason = null;
    if (requiresReason) {
      reason = await showReasonModal({
        title: action === "void" ? "Void Prescription" : "Cancel Prescription",
        message:
          "Please provide a reason to proceed. This action will be logged for auditing and may affect billing or dispensing records.",
      });
      if (!reason) return showToast("⚠️ Reason is required to proceed.");
    }

    try {
      showLoading();
      const res = await authFetch(`/api/prescriptions/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: requiresReason ? JSON.stringify({ reason }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} prescription`);

      showToast(`✅ Prescription ${action} successful`);
      window.latestPrescriptionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} prescription`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💬 Reason Modal (Bootstrap 5 Enterprise Pattern)
  ============================================================ */
  async function showReasonModal({ title, message }) {
    return new Promise((resolve) => {
      let modal = document.getElementById("reasonModal");
      if (!modal) {
        const html = `
        <div class="modal fade" id="reasonModal" tabindex="-1">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header bg-light">
                <h5 class="modal-title">${title}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <p>${message}</p>
                <textarea id="reasonInput" class="form-control" rows="3" placeholder="Enter reason..."></textarea>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                <button type="button" id="reasonSubmitBtn" class="btn btn-primary">Submit</button>
              </div>
            </div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML("beforeend", html);
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
        if (!val) return showToast("⚠️ Please provide a reason before submitting.");
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
     🌐 Global Shortcut Functions
  ============================================================ */
  const findEntry = (id) =>
    (window.latestPrescriptionEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  const actions = [
    "view",
    "edit",
    "delete",
    "restore",
    "submit",
    "activate",
    "complete",
    "verify",
    "cancel",
    "void",
  ];

  actions.forEach((action) => {
    window[`${action}PrescriptionEntry`] = async (id) => {
      if (!hasPerm(`prescriptions:${action}`))
        return showToast(`⛔ No permission to ${action} prescription`);
      const entry = findEntry(id);
      if (!entry) return showToast("❌ Prescription not found");

      if (["view"].includes(action)) return handleView(entry);
      if (["edit"].includes(action)) return handleEdit(entry);
      if (["delete"].includes(action)) return handleDelete(id, entry);
      if (["restore"].includes(action)) return handleRestore(id, entry);
      return await handleLifecycle(
        id,
        action,
        `Proceed to ${action} this prescription?`,
        ["cancel", "void"].includes(action)
      );
    };
  });
}
