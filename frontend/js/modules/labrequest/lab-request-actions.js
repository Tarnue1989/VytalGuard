// 📁 lab-request-actions.js
// ============================================================
// 🧭 Full Permission-Driven Action Handlers for Lab Requests
// Enterprise-Aligned (Central Stock Master Pattern)
// ============================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./lab-request-render.js";

/**
 * Unified, permission-driven action handler
 * (Aligned to Central Stock master pattern)
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
  const tableBody = document.getElementById("labRequestTableBody");
  const cardContainer = document.getElementById("labRequestList");

  // Cache globally for easy re-access
  window.latestLabRequestEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission Normalization + Check
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
    const normalizedKey = key
      .replace(/labrequests/gi, "lab_requests")
      .trim()
      .toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ============================================================
     ⚙️ Action Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestLabRequestEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/lab-requests/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Lab request not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Lab request data missing");
    const cls = btn.classList;

    // --- Basic View ---
    if (cls.contains("view-btn")) return handleView(entry);

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("lab_requests:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("lab_requests:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    // --- Lifecycle Actions ---
    const lifecycleActions = {
      submit: "Submit this lab request?",
      activate: "Activate this lab request?",
      complete: "Mark this lab request as completed?",
      verify: "Verify this lab request?",
      cancel: "Cancel this lab request?",
      void: "Void this lab request? (Admin/Superadmin only)",
    };

    for (const [key, msg] of Object.entries(lifecycleActions)) {
      if (cls.contains(`${key}-btn`)) {
        if (!hasPerm(`lab_requests:${key}`))
          return showToast(`⛔ No permission to ${key} lab request`);
        const requiresReason = ["cancel", "void"].includes(key);
        return await handleLifecycle(id, key, msg, requiresReason);
      }
    }
  }

  /* ============================================================
     🧩 Individual Handlers
  ============================================================ */
  function handleView(entry) {
    if (!hasPerm("lab_requests:view"))
      return showToast("⛔ You don't have permission to view lab request");

    // Open professional read-only view page
    window.open(
      `/lab-results-view.html?id=${entry.id}`,
      "_blank"
    );
  }


  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("labRequestEditId", entry.id);
    sessionStorage.setItem("labRequestEditPayload", JSON.stringify(entry));
    window.location.href = `add-lab-request.html?id=${entry.id}`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete lab request for "${entry.patient?.full_name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/lab-requests/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete lab request");

      showToast(`✅ Lab request deleted successfully`);
      window.latestLabRequestEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete lab request");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🧠 Lifecycle Handler (Reason Modal Support)
  ============================================================ */
  async function handleLifecycle(id, action, confirmMsg, requiresReason = false) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    let reason = null;
    if (requiresReason) {
      reason = await showReasonModal({
        title: action === "void" ? "Void Lab Request" : "Cancel Lab Request",
        message:
          "Please provide a reason to proceed. This action will be logged for auditing and may affect billing records.",
      });
      if (!reason) return showToast("⚠️ Reason is required to proceed.");
    }

    try {
      showLoading();
      const res = await authFetch(`/api/lab-requests/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: requiresReason ? JSON.stringify({ reason }) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} lab request`);

      showToast(`✅ Lab request ${action} successful`);
      window.latestLabRequestEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} lab request`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💬 Reason Modal (Bootstrap 5, Enterprise Style)
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
    (window.latestLabRequestEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("lab_requests:view"))
      return showToast("⛔ No permission to view lab request");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Lab request not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("lab_requests:edit"))
      return showToast("⛔ No permission to edit lab request");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Lab request not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("lab_requests:delete"))
      return showToast("⛔ No permission to delete lab request");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  ["submit", "activate", "complete", "verify", "cancel", "void"].forEach(
    (action) => {
      window[`${action}Entry`] = async (id) => {
        if (!hasPerm(`lab_requests:${action}`))
          return showToast(`⛔ No permission to ${action} lab request`);
        const entry = findEntry(id);
        await handleLifecycle(
          id,
          action,
          `Proceed to ${action} this lab request?`,
          ["cancel", "void"].includes(action)
        );
      };
    }
  );
}
