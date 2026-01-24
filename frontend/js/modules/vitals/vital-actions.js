// 📁 vital-actions.js – Enterprise Master Pattern (Vitals)
// ============================================================================
// 🧭 FULL PARITY WITH ekg-record-actions.js (Enterprise Master)
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
import { renderCard } from "./vital-render.js";

/**
 * Unified permission-aware action handler for Vital module
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
  const tableBody = document.getElementById("vitalTableBody");
  const cardContainer = document.getElementById("vitalList");

  // 🗂️ Cache latest entries
  window.latestVitalEntries = entries;

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
      (window.latestVitalEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/vitals/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Vital not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Vital data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("vitals:view"))
        return showToast("⛔ You don't have permission to view vitals");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("vitals:edit"))
        return showToast("⛔ You don't have permission to edit vitals");
      return handleEdit(entry);
    }

    if (cls.contains("start-btn")) {
      if (!hasPerm("vitals:edit"))
        return showToast("⛔ No permission to start vitals");
      return await handleLifecycle(id, "start");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("vitals:edit"))
        return showToast("⛔ No permission to complete vitals");
      return await handleLifecycle(id, "complete");
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("vitals:verify"))
        return showToast("⛔ No permission to verify vitals");
      return await handleLifecycle(id, "verify");
    }

    if (cls.contains("finalize-btn")) {
      if (!hasPerm("vitals:finalize"))
        return showToast("⛔ No permission to finalize vitals");
      return await handleLifecycle(id, "finalize");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("vitals:edit"))
        return showToast("⛔ No permission to cancel vitals");
      return await handleLifecycle(id, "cancel");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("vitals:void"))
        return showToast("⛔ No permission to void vitals");
      return await handleLifecycle(id, "void");
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("vitals:delete"))
        return showToast("⛔ You don't have permission to delete vitals");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Vital Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("vitalEditId", entry.id);
    sessionStorage.setItem("vitalEditPayload", JSON.stringify(entry));
    window.location.href = "add-vital.html";
  }

  // 🔁 Lifecycle (start / complete / verify / finalize / cancel / void)
  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} this vital record?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/vitals/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} vital`);

      showToast(`✅ Vital ${action} successful`);
      window.latestVitalEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} vital`);
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      "Delete this vital record permanently?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/vitals/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete vital");

      showToast("✅ Vital deleted successfully");
      window.latestVitalEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete vital");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestVitalEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewVital = (id) => {
    if (!hasPerm("vitals:view"))
      return showToast("⛔ No permission to view vitals");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editVital = (id) => {
    if (!hasPerm("vitals:edit"))
      return showToast("⛔ No permission to edit vitals");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteVital = async (id) => {
    if (!hasPerm("vitals:delete"))
      return showToast("⛔ No permission to delete vitals");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
