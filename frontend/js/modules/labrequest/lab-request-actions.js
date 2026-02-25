// 📁 lab-request-actions.js
// ============================================================================
// 🧭 Enterprise MASTER–ALIGNED Action Handlers (Lab Requests)
// ----------------------------------------------------------------------------
// 🔹 Pattern Source: consultation-actions.js (Enterprise MASTER)
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / delete / submit / activate / complete / verify / cancel / void
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
import { renderCard } from "./lab-request-render.js";

/**
 * Unified permission-aware action handler for Lab Request module
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
  const tableBody = document.getElementById("labRequestTableBody");
  const cardContainer = document.getElementById("labRequestList");

  // 🗂️ Cache latest entries
  window.latestLabRequestEntries = entries;

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
      (window.latestLabRequestEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER SAFETY NET)
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

    if (cls.contains("view-btn")) {
      if (!hasPerm("lab_requests:view"))
        return showToast("⛔ You don't have permission to view lab requests");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("lab_requests:edit"))
        return showToast("⛔ You don't have permission to edit lab requests");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("lab_requests:delete"))
        return showToast("⛔ You don't have permission to delete lab requests");
      return await handleDelete(id, entry);
    }

    if (cls.contains("submit-btn")) {
      if (!hasPerm("lab_requests:submit"))
        return showToast("⛔ No permission to submit lab request");
      return await handleLifecycle(id, "submit", "Submit this lab request?");
    }

    if (cls.contains("activate-btn")) {
      if (!hasPerm("lab_requests:activate"))
        return showToast("⛔ No permission to activate lab request");
      return await handleLifecycle(id, "activate", "Activate this lab request?");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("lab_requests:complete"))
        return showToast("⛔ No permission to complete lab request");
      return await handleLifecycle(
        id,
        "complete",
        "Mark this lab request as completed?"
      );
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("lab_requests:verify"))
        return showToast("⛔ No permission to verify lab request");
      return await handleLifecycle(id, "verify", "Verify this lab request?");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("lab_requests:cancel"))
        return showToast("⛔ No permission to cancel lab request");
      return await handleLifecycle(id, "cancel", "Cancel this lab request?");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("lab_requests:void"))
        return showToast("⛔ No permission to void lab request");
      return await handleLifecycle(
        id,
        "void",
        "Void this lab request? (Admin/Superadmin only)"
      );
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Lab Request Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("labRequestEditId", entry.id);
    sessionStorage.setItem("labRequestEditPayload", JSON.stringify(entry));
    window.location.href = "add-lab-request.html";
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete lab request for patient "${entry?.patient?.first_name || ""}"?`
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

      showToast("✅ Lab request deleted successfully");
      window.latestLabRequestEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete lab request");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/lab-requests/${id}/${action}`, {
        method: "PATCH",
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
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestLabRequestEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  // 🔹 Master-style helpers
  window.viewLabRequest = (id) => {
    if (!hasPerm("lab_requests:view"))
      return showToast("⛔ No permission to view lab requests");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editLabRequest = (id) => {
    if (!hasPerm("lab_requests:edit"))
      return showToast("⛔ No permission to edit lab requests");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteLabRequest = async (id) => {
    if (!hasPerm("lab_requests:delete"))
      return showToast("⛔ No permission to delete lab requests");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  ["submit", "activate", "complete", "verify", "cancel", "void"].forEach(
    (action) => {
      window[`${action}LabRequest`] = async (id) => {
        if (!hasPerm(`lab_requests:${action}`))
          return showToast(`⛔ No permission to ${action} lab request`);
        await handleLifecycle(
          id,
          action,
          `Proceed to ${action} this lab request?`
        );
      };
    }
  );

  // 🔹 Backward compatibility (existing bindings)
  window.viewEntry = window.viewLabRequest;
  window.editEntry = window.editLabRequest;
  window.deleteEntry = window.deleteLabRequest;
  window.submitEntry = window.submitLabRequest;
  window.activateEntry = window.activateLabRequest;
  window.completeEntry = window.completeLabRequest;
  window.verifyEntry = window.verifyLabRequest;
  window.cancelEntry = window.cancelLabRequest;
  window.voidEntry = window.voidLabRequest;
}
