// 📁 surgery-actions.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors centralstock-actions.js for unified permission-driven behavior
// 🔹 Preserves all existing IDs, classNames, and DOM bindings
// 🔹 Adds superadmin bypass, normalized permissions, and lifecycle consistency
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./surgery-render.js";
import { syncRefsToState } from "./surgery-main.js";

/* ============================================================
   🧩 SETUP ACTION HANDLERS
============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions }
}) {
  const { currentEditIdRef } = sharedState || { currentEditIdRef: { value: null } };
  const tableBody = document.getElementById("surgeryTableBody");
  const cardContainer = document.getElementById("surgeryList");

  // Cache globally
  window.latestSurgeryEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission Normalization
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
    const normalizedKey = key.trim().toLowerCase();
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
      (window.latestSurgeryEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // Fallback fetch if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/surgeries/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Surgery not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Surgery data missing");
    const cls = btn.classList;

    /* ----------------------- Core Actions ----------------------- */
    if (cls.contains("view-btn")) return handleView(entry);

    if (cls.contains("edit-btn")) {
      if (!hasPerm("surgeries:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("surgeries:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    /* ----------------------- Lifecycle Actions ----------------------- */
    const lifecycleMap = {
      "start-btn": "start",
      "complete-btn": "complete",
      "verify-btn": "verify",
      "finalize-btn": "finalize",
      "cancel-btn": "cancel",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`surgeries:${action}`) && !hasPerm("surgeries:edit"))
          return showToast(`⛔ You don't have permission to ${action} surgeries`);
        return await handleLifecycle(id, entry, action);
      }
    }
  }

  /* ============================================================
     🧠 Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Surgery Info", html);
  }

  function handleEdit(entry) {
    currentEditIdRef.value = entry.id;
    window.location.href = `add-surgery.html?id=${entry.id}`;
  }

  async function handleLifecycle(id, entry, action) {
    const name = entry?.patient?.name || entry?.surgeon?.name || "Surgery";
    const confirmMsgMap = {
      start: `Start surgery for "${name}"?`,
      complete: `Mark surgery for "${name}" as completed?`,
      verify: `Verify surgery for "${name}"?`,
      finalize: `Finalize surgery for "${name}"? (Admin/Superadmin only)`,
      cancel: `Cancel surgery for "${name}"?`,
      void: `Void surgery for "${name}"? (Admin/Superadmin only)`,
      restore: `Restore deleted surgery record for "${name}"?`,
    };
    const confirmed = await showConfirm(confirmMsgMap[action] || "Proceed?");
    if (!confirmed) return;

    try {
      showLoading();
      const method = action === "restore" ? "PATCH" : "PATCH";
      const res = await authFetch(`/api/surgeries/${id}/${action}`, { method });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} surgery`);

      showToast(`✅ Surgery "${name}" ${action} successful`);
      window.latestSurgeryEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} surgery`);
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete surgery for "${entry.patient?.name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/surgeries/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete surgery");

      showToast(`✅ Surgery for "${entry.patient?.name || "Unknown"}" deleted`);
      window.latestSurgeryEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete surgery");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 Global Helpers (Universal Entry API)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestSurgeryEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Surgery not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("surgeries:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Surgery not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("surgeries:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  const lifecycleKeys = [
    "start",
    "complete",
    "verify",
    "finalize",
    "cancel",
    "void",
    "restore",
  ];
  for (const key of lifecycleKeys) {
    window[`${key}Entry`] = async (id) => {
      if (!hasPerm(`surgeries:${key}`) && !hasPerm("surgeries:edit"))
        return showToast(`⛔ No permission to ${key}`);
      const entry = findEntry(id);
      await handleLifecycle(id, entry, key);
    };
  }
}
