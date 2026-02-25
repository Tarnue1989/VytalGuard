// 📦 appointments-actions.js – Enterprise Master–Aligned Action Handlers (Appointments)
// ============================================================================
// 🧭 Pattern Source: consultation-actions.js (Enterprise Master)
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / delete / activate / complete / verify / cancel / no-show / void / restore
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
import { renderCard } from "./appointments-render.js";

/**
 * Unified permission-aware action handler for Appointment module
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
  const tableBody = document.getElementById("appointmentTableBody");
  const cardContainer = document.getElementById("appointmentList");

  // 🗂️ Cache latest entries
  window.latestAppointmentEntries = entries;

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
      (window.latestAppointmentEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
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

    if (cls.contains("view-btn")) {
      if (!hasPerm("appointments:view"))
        return showToast("⛔ You don't have permission to view appointments");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("appointments:edit"))
        return showToast("⛔ You don't have permission to edit appointments");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("appointments:delete"))
        return showToast("⛔ You don't have permission to delete appointments");
      return await handleDelete(id, entry);
    }

    const lifecycleMap = {
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
        if (!hasPerm(`appointments:${action}`))
          return showToast(`⛔ No permission to ${action} appointment`);
        return await handleLifecycle(
          id,
          action,
          `Proceed to ${action} this appointment?`
        );
      }
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Appointment Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("appointmentEditId", entry.id);
    sessionStorage.setItem(
      "appointmentEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-appointment.html";
  }

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

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/appointments/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || `❌ Failed to ${action} appointment`
        );

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
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestAppointmentEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewAppointment = (id) => {
    if (!hasPerm("appointments:view"))
      return showToast("⛔ No permission to view appointments");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editAppointment = (id) => {
    if (!hasPerm("appointments:edit"))
      return showToast("⛔ No permission to edit appointments");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteAppointment = async (id) => {
    if (!hasPerm("appointments:delete"))
      return showToast("⛔ No permission to delete appointments");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  ["activate", "complete", "verify", "cancel", "no-show", "void", "restore"].forEach(
    (action) => {
      window[`${action}Appointment`] = async (id) => {
        if (!hasPerm(`appointments:${action}`))
          return showToast(`⛔ No permission to ${action} appointment`);
        await handleLifecycle(id, action, `Proceed to ${action} this appointment?`);
      };
    }
  );
}
