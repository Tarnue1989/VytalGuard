// 📁 ultrasoundRecord-actions.js – Enterprise Master Pattern (Ultrasound Records)
// ============================================================================
// 🧭 FULL PARITY WITH delivery-record-actions.js / ekg-record-actions.js
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / start / complete / verify / finalize / cancel / void / delete
// 🔹 Reason modal for cancel / void (preserved)
// 🔹 Keeps all DOM IDs, routes, API calls, and UI behavior intact
// ============================================================================

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
 * Unified permission-aware action handler for Ultrasound Record module
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
  const tableBody = document.getElementById("ultrasoundRecordTableBody");
  const cardContainer = document.getElementById("ultrasoundRecordList");

  // 🗂️ Cache latest entries
  window.latestUltrasoundEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER PARITY)
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
      p.toLowerCase().trim()
    )
  );

  // 🧠 Superadmin bypass
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
     🎯 Central Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestUltrasoundEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER PARITY)
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

    if (cls.contains("view-btn")) {
      if (!hasPerm("ultrasound_records:view"))
        return showToast("⛔ You don't have permission to view ultrasound records");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("ultrasound_records:edit"))
        return showToast("⛔ You don't have permission to edit ultrasound records");
      return handleEdit(entry);
    }

    if (cls.contains("start-btn")) {
      if (!hasPerm("ultrasound_records:edit"))
        return showToast("⛔ No permission to start ultrasound records");
      return await handleLifecycle(id, "start");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("ultrasound_records:edit"))
        return showToast("⛔ No permission to complete ultrasound records");
      return await handleLifecycle(id, "complete");
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("ultrasound_records:verify"))
        return showToast("⛔ No permission to verify ultrasound records");
      return await handleLifecycle(id, "verify");
    }

    if (cls.contains("finalize-btn")) {
      if (!hasPerm("ultrasound_records:finalize"))
        return showToast("⛔ No permission to finalize ultrasound records");
      return await handleLifecycle(id, "finalize");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("ultrasound_records:edit"))
        return showToast("⛔ No permission to cancel ultrasound records");
      return await handleLifecycle(id, "cancel", true);
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("ultrasound_records:void"))
        return showToast("⛔ No permission to void ultrasound records");
      return await handleLifecycle(id, "void", true);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("ultrasound_records:delete"))
        return showToast("⛔ You don't have permission to delete ultrasound records");
      return await handleDelete(id);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Ultrasound Record Info", html);
  }

  // ✏️ Edit (FIXED KEYS)
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;

    // ✅ MATCH WHAT THE FORM EXPECTS
    sessionStorage.setItem("ultrasoundEditId", entry.id);
    sessionStorage.setItem(
      "ultrasoundEditPayload",
      JSON.stringify(entry)
    );

    window.location.href = "add-ultrasound-record.html";
  }


  // 🔁 Lifecycle (MASTER PATTERN + reason support)
  async function handleLifecycle(id, action, requiresReason = false) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} this ultrasound record?`
    );
    if (!confirmed) return;

    let reason;
    if (requiresReason) {
      reason = await showReasonModal({
        title: action === "void" ? "Void Ultrasound" : "Cancel Ultrasound",
        message: "Please provide a reason to proceed.",
      });
      if (!reason) return showToast("⚠️ Reason is required");
    }

    try {
      showLoading();
      const res = await authFetch(
        `/api/ultrasound-records/${id}/${action}`,
        {
          method: "PATCH",
          headers: requiresReason
            ? { "Content-Type": "application/json" }
            : undefined,
          body: requiresReason ? JSON.stringify({ reason }) : undefined,
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || `❌ Failed to ${action} ultrasound record`
        );

      showToast(`✅ Ultrasound record ${action} successful`);
      window.latestUltrasoundEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} ultrasound record`);
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id) {
    const confirmed = await showConfirm(
      "Delete this ultrasound record permanently?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/ultrasound-records/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || "❌ Failed to delete ultrasound record"
        );

      showToast("✅ Ultrasound record deleted successfully");
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
     🌍 Global Helpers (MASTER PARITY)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestUltrasoundEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewUltrasoundRecord = (id) => {
    if (!hasPerm("ultrasound_records:view"))
      return showToast("⛔ No permission to view ultrasound records");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editUltrasoundRecord = (id) => {
    if (!hasPerm("ultrasound_records:edit"))
      return showToast("⛔ No permission to edit ultrasound records");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteUltrasoundRecord = async (id) => {
    if (!hasPerm("ultrasound_records:delete"))
      return showToast("⛔ No permission to delete ultrasound records");
    await handleDelete(id);
  };
}

/* ============================================================
   🧠 Reason Modal Helper (Bootstrap 5)
============================================================ */
async function showReasonModal({ title, message }) {
  return new Promise((resolve) => {
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

    const input = modal.querySelector("#reasonInput");
    const submitBtn = modal.querySelector("#reasonSubmitBtn");

    submitBtn.onclick = () => {
      const val = input.value.trim();
      if (!val) return showToast("⚠️ Reason required");
      bsModal.hide();
      resolve(val);
    };

    modal.addEventListener("hidden.bs.modal", () => resolve(null), {
      once: true,
    });
  });
}
