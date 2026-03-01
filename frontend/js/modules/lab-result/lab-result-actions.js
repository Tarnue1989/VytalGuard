// 📁 lab-result-actions.js – Enterprise MASTER–ALIGNED Action Handlers (Lab Result)
// ============================================================================
// 🧭 Pattern Source: patient-actions.js (Enterprise MASTER)
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / delete / status transitions
// 🔹 Safe fallback fetch + global helpers
// 🔹 100% API preservation (NO endpoint changes)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./lab-result-render.js";

/**
 * Unified permission-aware action handler for Lab Result module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("labResultTableBody");
  const cardContainer = document.getElementById("labResultList");

  // 🗂️ Cache latest entries
  window.latestLabResultEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER PATTERN)
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

  const userPerms = new Set(
    normalizePermissions(user?.permissions || []).map((p) =>
      String(p).toLowerCase().trim()
    )
  );

  // 🧠 Superadmin bypass (MASTER PATTERN)
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestLabResultEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER PATTERN)
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/lab-results/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data?.record || null;
      } catch {
        return showToast("❌ Lab Result not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Lab Result data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("lab_results:view"))
        return showToast("⛔ You don't have permission to view lab results");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("lab_results:edit"))
        return showToast("⛔ You don't have permission to edit lab results");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("lab_results:delete"))
        return showToast("⛔ You don't have permission to delete lab results");
      return await handleDelete(id, entry);
    }

    // 🔄 Lifecycle Actions
    const lifecycleActions = [
      "submit",
      "start",
      "complete",
      "review",
      "verify",
      "cancel",
      "void",
    ];

    for (const action of lifecycleActions) {
      if (cls.contains(`${action}-btn`)) {
        if (!hasPerm(`lab_results:${action}`))
          return showToast(`⛔ No permission to ${action} lab result`);
        const requiresReason = ["cancel", "void"].includes(action);
        return await handleLifecycle(id, action, requiresReason);
      }
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Lab Result Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("labResultEditId", entry.id);
    sessionStorage.setItem(
      "labResultEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-lab-result.html";
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this lab result?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/lab-results/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete lab result");

      showToast(`✅ Lab Result deleted successfully`);
      window.latestLabResultEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete lab result");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, requiresReason = false) {
    const confirmed = await showConfirm(
      `Proceed to ${action} this lab result?`
    );
    if (!confirmed) return;

    let reason = null;

    if (requiresReason) {
      reason = await showReasonModal({
        title:
          action === "void"
            ? "Void Lab Result"
            : "Cancel Lab Result",
        message:
          "Please provide a reason. This action will be logged for auditing.",
      });
      if (!reason) return showToast("⚠️ Reason is required to proceed.");
    }

    try {
      showLoading();
      const res = await authFetch(`/api/lab-results/${id}/${action}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: requiresReason ? JSON.stringify({ reason }) : undefined,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || `❌ Failed to ${action} lab result`
        );

      showToast(`✅ Lab Result ${action} successful`);
      window.latestLabResultEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} lab result`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💬 Reason Modal (Reusable Enterprise Pattern)
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

      const bsModal = new bootstrap.Modal(modal, {
        backdrop: "static",
      });

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
        if (!val)
          return showToast(
            "⚠️ Please provide a reason before submitting."
          );
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
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestLabResultEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewLabResult = (id) => {
    if (!hasPerm("lab_results:view"))
      return showToast("⛔ No permission to view lab result");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editLabResult = (id) => {
    if (!hasPerm("lab_results:edit"))
      return showToast("⛔ No permission to edit lab result");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteLabResult = async (id) => {
    if (!hasPerm("lab_results:delete"))
      return showToast("⛔ No permission to delete lab result");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };

  // 🔹 Backward compatibility aliases
  window.viewEntry = window.viewLabResult;
  window.editEntry = window.editLabResult;
  window.deleteEntry = window.deleteLabResult;
}