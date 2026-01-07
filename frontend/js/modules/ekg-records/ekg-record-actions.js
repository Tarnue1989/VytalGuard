// 📁 ekg-record-actions.js – Full Permission-Driven Action Handlers for EKG Records

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
 * Unified, permission-driven action handler
 * Mirrors the centralstock master pattern (no hardcoded roles)
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, roleNames, permissions }
}) {
  const tableBody = document.getElementById("ekgRecordTableBody");
  const cardContainer = document.getElementById("ekgRecordList");

  // cache last entries globally
  window.latestEKGRecordEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Normalize Permissions
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

  // ✅ Unified permission checker
  const hasPerm = (key) => {
    const normalizedKey = key
      .replace(/ekgrecords/gi, "ekg_records")
      .trim()
      .toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ============================================================
     🧠 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestEKGRecordEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch
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

    // --- Basic View ---
    if (cls.contains("view-btn")) return handleView(entry);

    // --- Core Actions ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("ekg_records:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("ekg_records:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    // --- Lifecycle Actions ---
    const lifecycleMap = {
      "start-btn": "start",
      "complete-btn": "complete",
      "verify-btn": "verify",
      "finalize-btn": "finalize",
      "cancel-btn": "cancel",
      "void-btn": "void",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`ekg_records:${action}`) && !hasPerm("ekg_records:edit"))
          return showToast(`⛔ You don't have permission to ${action} records`);
        return await handleLifecycle(id, entry, action);
      }
    }
  }

  /* ============================================================
     🧩 Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("EKG Record Info", html);
  }

  function handleEdit(entry) {
    if (!entry?.id) return showToast("❌ Missing record ID");
    sessionStorage.setItem("ekgRecordEditId", entry.id);
    window.location.href = `add-ekg-record.html?id=${entry.id}`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete EKG record for "${entry.patient?.full_name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/ekg-records/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete EKG record");

      showToast(`✅ EKG record deleted successfully`);
      window.latestEKGRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete EKG record");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, entry, action) {
    const actionTitles = {
      start: "Start this EKG record?",
      complete: "Mark this EKG record as completed?",
      verify: "Verify this EKG record?",
      finalize: "Finalize this EKG record? (Admin/Superadmin only)",
      cancel: "Cancel this EKG record?",
      void: "Void this EKG record? (Admin/Superadmin only)",
    };
    const confirmed = await showConfirm(actionTitles[action]);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/ekg-records/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} EKG record`);

      showToast(`✅ EKG record ${action} successful`);
      window.latestEKGRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} EKG record`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helper Shortcuts
  ============================================================ */
  const findEntry = (id) =>
    (window.latestEKGRecordEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEKGRecord = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ EKG record not found for viewing");
  };

  window.editEKGRecord = (id) => {
    if (!hasPerm("ekg_records:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ EKG record not found for editing");
  };

  window.deleteEKGRecord = async (id) => {
    if (!hasPerm("ekg_records:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  const lifecycleActions = [
    "start",
    "complete",
    "verify",
    "finalize",
    "cancel",
    "void",
  ];

  lifecycleActions.forEach((action) => {
    window[`${action}EKGRecord`] = async (id) => {
      if (!hasPerm(`ekg_records:${action}`) && !hasPerm("ekg_records:edit"))
        return showToast(`⛔ No permission to ${action} record`);
      const entry = findEntry(id);
      await handleLifecycle(id, entry, action);
    };
  });
}
