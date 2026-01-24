// 📁 ekg-record-actions.js – Enterprise Master Pattern (EKG Records)
// ============================================================================
// 🧭 FULL PARITY WITH registrationLog-actions.js
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / start / complete / verify / finalize / cancel / void / delete
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
import { renderCard } from "./ekg-record-render.js";

/**
 * Unified permission-aware action handler for EKG Record module
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
  const tableBody = document.getElementById("ekgRecordTableBody");
  const cardContainer = document.getElementById("ekgRecordList");

  // 🗂️ Cache latest entries
  window.latestEKGRecordEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions
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

  // ✅ Permission checker
  const hasPerm = (key) =>
    isSuperAdmin ||
    userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestEKGRecordEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/ekg-records/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ EKG record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ EKG record data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("ekg_records:view"))
        return showToast("⛔ You don't have permission to view EKG records");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("ekg_records:edit"))
        return showToast("⛔ You don't have permission to edit EKG records");
      return handleEdit(entry);
    }

    if (cls.contains("start-btn")) {
      if (!hasPerm("ekg_records:edit"))
        return showToast("⛔ No permission to start EKG records");
      return await handleLifecycle(id, "start");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("ekg_records:edit"))
        return showToast("⛔ No permission to complete EKG records");
      return await handleLifecycle(id, "complete");
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("ekg_records:verify"))
        return showToast("⛔ No permission to verify EKG records");
      return await handleLifecycle(id, "verify");
    }

    if (cls.contains("finalize-btn")) {
      if (!hasPerm("ekg_records:finalize"))
        return showToast("⛔ No permission to finalize EKG records");
      return await handleLifecycle(id, "finalize");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("ekg_records:edit"))
        return showToast("⛔ No permission to cancel EKG records");
      return await handleLifecycle(id, "cancel");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("ekg_records:void"))
        return showToast("⛔ No permission to void EKG records");
      return await handleLifecycle(id, "void");
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("ekg_records:delete"))
        return showToast("⛔ You don't have permission to delete EKG records");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("EKG Record Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("ekgRecordEditId", entry.id);
    sessionStorage.setItem("ekgRecordEditPayload", JSON.stringify(entry));
    window.location.href = "add-ekg-record.html";
  }

  // 🔁 Lifecycle (start / complete / verify / finalize / cancel / void)
  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} this EKG record?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/ekg-records/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} EKG record`);

      showToast(`✅ EKG Record ${action} successful`);
      window.latestEKGRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} EKG record`);
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      "Delete this EKG record permanently?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/ekg-records/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete EKG record");

      showToast("✅ EKG Record deleted successfully");
      window.latestEKGRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete EKG record");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestEKGRecordEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEKGRecord = (id) => {
    if (!hasPerm("ekg_records:view"))
      return showToast("⛔ No permission to view EKG records");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editEKGRecord = (id) => {
    if (!hasPerm("ekg_records:edit"))
      return showToast("⛔ No permission to edit EKG records");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteEKGRecord = async (id) => {
    if (!hasPerm("ekg_records:delete"))
      return showToast("⛔ No permission to delete EKG records");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
