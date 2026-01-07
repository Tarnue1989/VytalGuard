// 📁 employee-actions.js – Enterprise Master Pattern (Upgraded)
// ============================================================================
// 🧭 Permission-Driven Action Handler
// 🔹 Mirrors delivery-record-actions.js (superadmin-aware, normalized permissions)
// 🔹 Keeps full functional parity with working Employee module
// 🔹 Retains toggle-status flow + unified lifecycle structure
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
 * Unified, permission-driven action handler for Employee module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("employeeTableBody");
  const cardContainer = document.getElementById("employeeList");

  // Cache latest entries
  window.latestEmployeeEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ---------------------- Normalize permissions ---------------------- */
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

  // ✅ Super Admin bypass
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker
  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ---------------------- Main Handler Dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestEmployeeEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch if missing
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

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("employees:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("employees:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // --- Toggle Status ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("employees:toggle-status"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("employees:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }
  }

  /* ---------------------- Action Handlers ---------------------- */

  // 🔍 View Employee Details
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Employee Info", html);
  }

  // ✏️ Edit Employee
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("employeeEditId", entry.id);
    sessionStorage.setItem("employeeEditPayload", JSON.stringify(entry));
    window.location.href = "add-employee.html";
  }

  // 🔄 Toggle Status (Active/Inactive)
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
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
        throw new Error(data.message || "❌ Failed to toggle employee status");

      const newStatus =
        (data?.data?.status || (isActive ? "inactive" : "active")).toLowerCase();
      const empName =
        entry?.full_name ||
        `${entry?.first_name || ""} ${entry?.last_name || ""}`.trim() ||
        data?.data?.full_name ||
        "Employee";

      if (newStatus === "active") {
        showToast(`✅ Employee "${empName}" has been activated`);
      } else if (newStatus === "inactive") {
        showToast(`✅ Employee "${empName}" has been deactivated`);
      } else {
        showToast(`✅ Employee "${empName}" status updated to ${newStatus}`);
      }

      window.latestEmployeeEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update employee status");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete Employee
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this employee?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/employees/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete employee");

      const empName =
        entry?.full_name ||
        `${entry?.first_name || ""} ${entry?.last_name || ""}`.trim() ||
        data?.data?.full_name ||
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

  /* ---------------------- Global Helpers ---------------------- */
  const findEntry = (id) =>
    (window.latestEmployeeEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("employees:view"))
      return showToast("⛔ No permission to view employee");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Employee not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("employees:edit"))
      return showToast("⛔ No permission to edit employee");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Employee not found for editing");
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("employees:toggle-status"))
      return showToast("⛔ No permission to toggle employee status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("employees:delete"))
      return showToast("⛔ No permission to delete employee");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
