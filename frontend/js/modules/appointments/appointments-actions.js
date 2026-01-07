// 📦 appointments-actions.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors consultation-actions.js structure for unified permission flow
// 🔹 Preserves all appointment-specific IDs, classNames, and button handlers
// 🔹 Superadmin-aware, lifecycle-consistent, permission-driven architecture
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

/* ============================================================
   ⚙️ Unified Action Handler – Appointment Module
============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, roleNames, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("appointmentTableBody");
  const cardContainer = document.getElementById("appointmentList");

  // 🗂️ Cache latest entries globally
  window.latestAppointmentEntries = entries;

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

  // 🧭 Super Admin bypass check
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // 🧩 Unified permission checker
  const hasPerm = (key) => isSuperAdmin || userPerms.has(key.trim().toLowerCase());

  /* ============================================================
     🎛️ Main Action Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestAppointmentEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🔁 Fetch if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/appointments/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Appointment not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Appointment data missing");

    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("appointments:view"))
        return showToast("⛔ You don't have permission to view appointments");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("appointments:edit") && !hasPerm("appointments:create"))
        return showToast("⛔ You don't have permission to edit appointments");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("appointments:delete"))
        return showToast("⛔ You don't have permission to delete appointments");
      return await handleDelete(id, entry);
    }

    // --- Toggle Status ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("appointments:edit"))
        return showToast("⛔ You don't have permission to toggle status");
      return await handleToggleStatus(id, entry);
    }

    // --- Lifecycle Actions (Unified with Consultation Pattern) ---
    const lifecycleMap = {
      "start-btn": "start",
      "activate-btn": "activate",
      "complete-btn": "complete",
      "verify-btn": "verify",
      "cancel-btn": "cancel",
      "no-show-btn": "no-show",
      "void-btn": "void",
      "restore-btn": "restore", // ✅ Added for restore action
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`appointments:${action}`) && !hasPerm("appointments:edit"))
          return showToast(`⛔ You don't have permission to ${action} appointments`);
        return await handleLifecycle(
          id,
          action,
          `Proceed to ${action} this appointment?`
        );
      }
    }
  }

  /* ============================================================
     🧩 Action Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Appointment Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("appointmentEditId", entry.id);
    sessionStorage.setItem("appointmentEditPayload", JSON.stringify(entry));
    window.location.href = "add-appointment.html";
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this appointment?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/appointments/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete appointment");

      showToast("✅ Appointment deleted successfully");
      window.latestAppointmentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete appointment");
    } finally {
      hideLoading();
    }
  }

  async function handleToggleStatus(id, entry) {
    const status = (entry.status || "").toLowerCase();
    const confirmed = await showConfirm(
      `Toggle status for this appointment? (Current: ${status})`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/appointments/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle appointment status");

      showToast(`✅ Status updated to ${data?.data?.status || "unknown"}`);
      window.latestAppointmentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update appointment status");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    // 🚫 Optional: Prevent invalid frontend actions (e.g. verified → void)
    if (action === "void") {
      const entry = findEntry(id);
      if (entry?.status?.toLowerCase() === "verified")
        return showToast("⛔ Cannot void a verified appointment");
    }

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
     🌐 Global Helpers / Exposed APIs
  ============================================================ */
  const findEntry = (id) =>
    (window.latestAppointmentEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  // Global: view/edit/delete
  window.viewEntry = (id) => {
    if (!hasPerm("appointments:view"))
      return showToast("⛔ No permission to view appointments");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Appointment not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("appointments:edit") && !hasPerm("appointments:create"))
      return showToast("⛔ No permission to edit appointments");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Appointment not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("appointments:delete"))
      return showToast("⛔ No permission to delete appointments");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  // Lifecycle globals (fully expanded)
  [
    "start",
    "activate",
    "complete",
    "verify",
    "cancel",
    "no-show",
    "void",
    "restore", // ✅ Added global restore handler
  ].forEach((action) => {
    window[`${action}Entry`] = async (id) => {
      if (!hasPerm(`appointments:${action}`) && !hasPerm("appointments:edit"))
        return showToast(`⛔ No permission to ${action} appointments`);
      const entry = findEntry(id);
      await handleLifecycle(id, action, `Proceed to ${action} this appointment?`);
    };
  });
}
