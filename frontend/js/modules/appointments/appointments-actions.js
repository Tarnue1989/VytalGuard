// 📦 appointments-actions.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🧭 Mirrors feature-access-actions.js EXACTLY (structure + lifecycle)
// 🔹 Permission-driven, Superadmin-aware
// 🔹 Unified lifecycle: view, edit, toggle-status, delete, lifecycle actions
// 🔹 IDs, routes, and DOM contracts preserved
// 🔹 UI-safe + permission-safe
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard } from "./appointments-render.js";

/**
 * Unified permission-aware action handler for Appointments
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions, roleNames }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("appointmentTableBody");
  const cardContainer = document.getElementById("appointmentList");

  // 🗂️ Cache latest entries
  window.latestAppointmentEntries = entries;

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
      (window.latestAppointmentEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/appointments/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data || data?.data?.record;
      } catch {
        return showToast("❌ Appointment not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Appointment data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("appointments:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("appointments:edit") && !hasPerm("appointments:create"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("appointments:toggle-status") && !hasPerm("appointments:edit"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("appointments:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    const lifecycleMap = {
      "start-btn": "start",
      "activate-btn": "activate",
      "complete-btn": "complete",
      "verify-btn": "verify",
      "cancel-btn": "cancel",
      "no-show-btn": "no-show",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (
          !hasPerm(`appointments:${action}`) &&
          !hasPerm("appointments:edit")
        )
          return showToast(`⛔ You don't have permission to ${action}`);
        return await handleLifecycle(
          id,
          entry,
          action,
          `Proceed to ${action} this appointment?`
        );
      }
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 👁️ View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Appointment Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("appointmentEditId", entry.id);
    sessionStorage.setItem("appointmentEditPayload", JSON.stringify(entry));
    window.location.href = "add-appointment.html";
  }

  // 🔄 Toggle Status
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? "Deactivate this appointment?"
        : "Activate this appointment?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/appointments/${id}/toggle-status`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle appointment status");

      showToast("✅ Appointment status updated");
      window.latestAppointmentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update status");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this appointment?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/appointments/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete appointment");

      showToast("✅ Appointment deleted");
      window.latestAppointmentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete appointment");
    } finally {
      hideLoading();
    }
  }

  // 🔁 Lifecycle
  async function handleLifecycle(id, entry, action, confirmMsg) {
    if (action === "void" && entry?.status?.toLowerCase() === "verified")
      return showToast("⛔ Cannot void a verified appointment");

    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/appointments/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} appointment`);

      showToast(`✅ Appointment ${action} successful`);
      window.latestAppointmentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} appointment`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Parity with Master)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestAppointmentEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("appointments:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editEntry = (id) => {
    if (!hasPerm("appointments:edit") && !hasPerm("appointments:create"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleAppointmentStatus = async (id) => {
    if (!hasPerm("appointments:toggle-status") && !hasPerm("appointments:edit"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("appointments:delete"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };

  [
    "start",
    "activate",
    "complete",
    "verify",
    "cancel",
    "no-show",
    "void",
    "restore",
  ].forEach((action) => {
    window[`${action}Entry`] = async (id) => {
      if (
        !hasPerm(`appointments:${action}`) &&
        !hasPerm("appointments:edit")
      )
        return showToast(`⛔ No permission to ${action}`);
      const entry = findEntry(id);
      if (entry)
        await handleLifecycle(
          id,
          entry,
          action,
          `Proceed to ${action} this appointment?`
        );
    };
  });
}
