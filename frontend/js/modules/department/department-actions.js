// 📁 department-actions.js – Full Permission-Driven Action Handlers for Departments
// ============================================================================
// 🧭 Master Pattern: role-actions.js / vital-actions.js
// 🔹 Follows enterprise-aligned permission scheme (departments:view, edit, delete, etc.)
// 🔹 Includes Superadmin bypass, normalized permissions
// 🔹 Unified lifecycle: view / edit / toggle / restore / delete
// 🔹 All DOM IDs preserved exactly
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./department-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions, roleNames }
}) {
  const tableBody = document.getElementById("departmentTableBody");
  const cardContainer = document.getElementById("departmentList");

  // 🧠 Cache latest entries for global access
  window.latestDepartmentEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🧩 Normalize Permissions
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

  // ✅ Superadmin bypass
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker
  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ============================================================
     ⚙️ Central Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestDepartmentEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // Fallback fetch if missing
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/departments/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Department not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Department data missing");

    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("departments:view"))
        return showToast("⛔ You don't have permission to view departments");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("departments:edit"))
        return showToast("⛔ You don't have permission to edit departments");
      return handleEdit(entry);
    }

    // --- Toggle (Activate / Deactivate) ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("departments:toggle"))
        return showToast("⛔ You don't have permission to toggle departments");
      return await handleToggleStatus(id, entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("departments:delete"))
        return showToast("⛔ You don't have permission to delete departments");
      return await handleDelete(id, entry);
    }

    // --- Restore ---
    if (cls.contains("restore-btn")) {
      if (!hasPerm("departments:restore"))
        return showToast("⛔ You don't have permission to restore departments");
      return await handleRestore(id, entry);
    }
  }

  /* ============================================================
     🧠 Action Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Department Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("departmentEditId", entry.id);
    sessionStorage.setItem("departmentEditPayload", JSON.stringify(entry));
    window.location.href = `add-department.html`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate department "${entry.name}"?`
        : `Activate department "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/departments/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle department status");

      const newStatus = (
        data?.data?.status || (isActive ? "inactive" : "active")
      ).toLowerCase();
      const deptName = entry?.name || data?.data?.name || "Department";

      showToast(
        newStatus === "active"
          ? `✅ Department "${deptName}" has been activated`
          : `✅ Department "${deptName}" has been deactivated`
      );

      window.latestDepartmentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update department status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete department "${entry.name}" permanently?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/departments/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete department");

      showToast(`✅ Department "${entry.name}" deleted successfully`);
      window.latestDepartmentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete department");
    } finally {
      hideLoading();
    }
  }

  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore department "${entry.name}" record?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/departments/${id}/restore`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to restore department");

      showToast(`✅ Department "${entry.name}" restored successfully`);
      window.latestDepartmentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to restore department");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 Global Helpers
  ============================================================ */
  const findEntry = (id) =>
    (window.latestDepartmentEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("departments:view"))
      return showToast("⛔ No permission to view departments");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Department not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("departments:edit"))
      return showToast("⛔ No permission to edit departments");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Department not found for editing");
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("departments:toggle"))
      return showToast("⛔ No permission to toggle departments");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("departments:delete"))
      return showToast("⛔ No permission to delete departments");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  window.restoreEntry = async (id) => {
    if (!hasPerm("departments:restore"))
      return showToast("⛔ No permission to restore departments");
    const entry = findEntry(id);
    await handleRestore(id, entry);
  };
}
