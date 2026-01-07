// 📁 registrationLog-actions.js – Upgraded to Master Pattern (Permission-Driven + Role-Aware + SuperAdmin Bypass)

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
 * 🧠 Unified, permission-driven action handler for Registration Logs
 * Matches the structure and logic of the Consultation & Appointment master patterns
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ unified user object { role, permissions }
}) {
  const tableBody = document.getElementById("registrationLogTableBody");
  const cardContainer = document.getElementById("registrationLogList");

  // Cache recent entries
  window.latestRegistrationLogEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ---------------------- 🔐 Permission Normalization ---------------------- */
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

  // ✅ SuperAdmin Bypass
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified Permission Checker
  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  const hasCreateOrEdit = () =>
    hasPerm("registration_logs:create") || hasPerm("registration_logs:edit");

  /* ---------------------- 🧭 Main Click Handler ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestRegistrationLogEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback → fetch full record
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

    // --- Basic actions ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("registration_logs:view"))
        return showToast("⛔ You don't have permission to view registration logs");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasCreateOrEdit())
        return showToast("⛔ You don't have permission to edit registration logs");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("registration_logs:delete"))
        return showToast("⛔ You don't have permission to delete registration logs");
      return await handleDelete(id);
    }

    // --- Status toggle ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("registration_logs:edit"))
        return showToast("⛔ You don't have permission to update status");
      return await handleToggleStatus(id, entry);
    }

    // --- Lifecycle / workflow actions ---
    const lifecycleActions = [
      { cls: "submit-btn", action: "submit", perm: "registration_logs:edit" },
      { cls: "activate-btn", action: "activate", perm: "registration_logs:edit" },
      { cls: "complete-btn", action: "complete", perm: "registration_logs:edit" },
      { cls: "cancel-btn", action: "cancel", perm: "registration_logs:edit" },
      { cls: "void-btn", action: "void", perm: "registration_logs:void" },
    ];

    for (const cfg of lifecycleActions) {
      if (cls.contains(cfg.cls)) {
        if (!hasPerm(cfg.perm))
          return showToast(`⛔ You don't have permission to ${cfg.action} registration logs`);
        return await handleLifecycle(
          id,
          cfg.action,
          `Are you sure you want to ${cfg.action} this registration log?`
        );
      }
    }
  }

  /* ---------------------- ⚙️ Handlers ---------------------- */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Registration Log Info", html);
  }

  function handleEdit(entry) {
    sessionStorage.setItem("registrationLogEditId", entry.id);
    sessionStorage.setItem("registrationLogEditPayload", JSON.stringify(entry));
    window.location.href = "add-registration-log.html";
  }

  async function handleToggleStatus(id, entry) {
    const status = (entry.log_status || "").toLowerCase();
    const confirmed = await showConfirm(
      `Toggle status for this registration log? (Currently: ${status})`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/registration-logs/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || "❌ Failed to toggle status");
        return;
      }

      showToast(`✅ Status updated to ${data?.data?.log_status || "unknown"}`);
      window.latestRegistrationLogEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to update registration log status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this registration log?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/registration-logs/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || "❌ Failed to delete registration log");
        return;
      }

      showToast("✅ Registration Log deleted successfully");
      window.latestRegistrationLogEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to delete registration log");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/registration-logs/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.message || `❌ Failed to ${action} registration log`);
        return;
      }

      showToast(`✅ Registration Log ${action} successful`);
      window.latestRegistrationLogEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(`❌ Failed to ${action} registration log`);
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- 🌐 Global Helpers ---------------------- */

  const findEntry = (id) =>
    (window.latestRegistrationLogEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("registration_logs:view") && !isSuperAdmin)
      return showToast("⛔ You don't have permission to view registration logs");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Registration Log not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasCreateOrEdit() && !isSuperAdmin)
      return showToast("⛔ You don't have permission to edit registration logs");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Registration Log not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("registration_logs:delete") && !isSuperAdmin)
      return showToast("⛔ You don't have permission to delete registration logs");
    await handleDelete(id);
  };

  const lifecycle = ["submit", "activate", "complete", "cancel", "void"];
  lifecycle.forEach((action) => {
    window[`${action}Entry`] = async (id) => {
      const permKey = `registration_logs:${action}`;
      if (!hasPerm(permKey) && !hasPerm("registration_logs:edit") && !isSuperAdmin)
        return showToast(`⛔ You don't have permission to ${action} registration logs`);
      await handleLifecycle(id, action, `Are you sure you want to ${action} this registration log?`);
    };
  });
}
