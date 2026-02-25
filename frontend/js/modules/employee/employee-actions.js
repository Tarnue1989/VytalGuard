// 📁 employee-actions.js – Enterprise MASTER–ALIGNED Action Handlers (Employee)
// ============================================================================
// 🧭 Pattern Source: patient-actions.js (Enterprise MASTER)
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / toggle-status / delete
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
import { renderCard } from "./employee-render.js";

/**
 * Unified permission-aware action handler for Employee module
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
  const tableBody = document.getElementById("employeeTableBody");
  const cardContainer = document.getElementById("employeeList");

  // 🗂️ Cache latest entries
  window.latestEmployeeEntries = entries;

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
      (window.latestEmployeeEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/employees/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Employee not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Employee data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("employees:view"))
        return showToast("⛔ You don't have permission to view employees");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("employees:edit"))
        return showToast("⛔ You don't have permission to edit employees");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("employees:toggle_status"))
        return showToast("⛔ No permission to change employee status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("employees:delete"))
        return showToast("⛔ You don't have permission to delete employees");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Employee Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("employeeEditId", entry.id);
    sessionStorage.setItem("employeeEditPayload", JSON.stringify(entry));
    window.location.href = "add-employee.html";
  }

  async function handleToggleStatus(id, entry) {
    const currentStatus = String(entry?.status || "").toUpperCase();
    const isActive = currentStatus === "ACTIVE";

    const confirmed = await showConfirm(
      isActive ? "Deactivate this employee?" : "Activate this employee?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/employees/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || "❌ Failed to toggle employee status"
        );

      const newStatus = String(data?.data?.status || "").toUpperCase();

      const empName =
        entry?.full_name ||
        `${entry?.first_name || ""} ${entry?.last_name || ""}`.trim() ||
        "Employee";

      showToast(
        `✅ Employee "${empName}" status changed to ${newStatus || "UPDATED"}`
      );

      window.latestEmployeeEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update employee status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this employee?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/employees/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete employee");

      const empName =
        entry?.full_name ||
        `${entry?.first_name || ""} ${entry?.last_name || ""}`.trim() ||
        "Employee";

      showToast(`✅ Employee "${empName}" deleted successfully`);
      window.latestEmployeeEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete employee");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestEmployeeEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEmployee = (id) => {
    if (!hasPerm("employees:view"))
      return showToast("⛔ No permission to view employee");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editEmployee = (id) => {
    if (!hasPerm("employees:edit"))
      return showToast("⛔ No permission to edit employee");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleEmployeeStatus = async (id) => {
    if (!hasPerm("employees:toggle_status"))
      return showToast("⛔ No permission to toggle employee status");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteEmployee = async (id) => {
    if (!hasPerm("employees:delete"))
      return showToast("⛔ No permission to delete employee");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };

  // 🔹 Backward compatibility aliases
  window.viewEntry = window.viewEmployee;
  window.editEntry = window.editEmployee;
  window.deleteEntry = window.deleteEmployee;
}
