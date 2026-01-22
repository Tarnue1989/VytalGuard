// 📁 registrationLog-actions.js – Enterprise Master Pattern (Registration Logs)
// ============================================================================
// 🧭 FULL PARITY WITH department-actions.js
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / toggle-status / submit / activate / complete / cancel / void / delete
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
import { renderCard } from "./registration-log-render.js";

/**
 * Unified permission-aware action handler for Registration Log module
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
  const tableBody = document.getElementById("registrationLogTableBody");
  const cardContainer = document.getElementById("registrationLogList");

  // 🗂️ Cache latest entries
  window.latestRegistrationLogEntries = entries;

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
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestRegistrationLogEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/registration-logs/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Registration Log not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Registration Log data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("registration_logs:view"))
        return showToast("⛔ You don't have permission to view registration logs");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("registration_logs:edit"))
        return showToast("⛔ You don't have permission to edit registration logs");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("registration_logs:edit"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("submit-btn")) {
      if (!hasPerm("registration_logs:edit"))
        return showToast("⛔ No permission to submit registration logs");
      return await handleLifecycle(id, "submit");
    }

    if (cls.contains("activate-btn")) {
      if (!hasPerm("registration_logs:edit"))
        return showToast("⛔ No permission to activate registration logs");
      return await handleLifecycle(id, "activate");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("registration_logs:edit"))
        return showToast("⛔ No permission to complete registration logs");
      return await handleLifecycle(id, "complete");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("registration_logs:edit"))
        return showToast("⛔ No permission to cancel registration logs");
      return await handleLifecycle(id, "cancel");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("registration_logs:void"))
        return showToast("⛔ No permission to void registration logs");
      return await handleLifecycle(id, "void");
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("registration_logs:delete"))
        return showToast("⛔ You don't have permission to delete registration logs");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Registration Log Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("registrationLogEditId", entry.id);
    sessionStorage.setItem("registrationLogEditPayload", JSON.stringify(entry));
    window.location.href = "add-registration-log.html";
  }

  // 🔄 Toggle Status
  async function handleToggleStatus(id, entry) {
    const confirmed = await showConfirm("Toggle registration log status?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/registration-logs/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle status");

      showToast("✅ Registration Log status updated");
      window.latestRegistrationLogEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update status");
    } finally {
      hideLoading();
    }
  }

  // 🔁 Lifecycle (submit / activate / complete / cancel / void)
  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} this registration log?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/registration-logs/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} registration log`);

      showToast(`✅ Registration Log ${action} successful`);
      window.latestRegistrationLogEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} registration log`);
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      "Delete this registration log permanently?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/registration-logs/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete registration log");

      showToast("✅ Registration Log deleted successfully");
      window.latestRegistrationLogEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete registration log");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestRegistrationLogEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewRegistrationLog = (id) => {
    if (!hasPerm("registration_logs:view"))
      return showToast("⛔ No permission to view registration logs");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editRegistrationLog = (id) => {
    if (!hasPerm("registration_logs:edit"))
      return showToast("⛔ No permission to edit registration logs");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleRegistrationLogStatus = async (id) => {
    if (!hasPerm("registration_logs:edit"))
      return showToast("⛔ No permission to toggle registration logs");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteRegistrationLog = async (id) => {
    if (!hasPerm("registration_logs:delete"))
      return showToast("⛔ No permission to delete registration logs");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
