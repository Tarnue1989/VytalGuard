// 📁 supplier-actions.js – Enterprise Master Pattern (Suppliers)
// ============================================================================
// 🧭 Mirrors department-actions.js EXACTLY (Supplier Parity)
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / toggle-status / delete / restore
// 🔹 Keeps all DOM IDs, routes, storage keys, and UI behavior intact
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./supplier-render.js";

/**
 * Unified permission-aware action handler for Supplier module
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
  const tableBody = document.getElementById("supplierTableBody");
  const cardContainer = document.getElementById("supplierList");

  // 🗂️ Cache latest entries
  window.latestSupplierEntries = entries;

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
      (window.latestSupplierEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/suppliers/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Supplier not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Supplier data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("suppliers:view"))
        return showToast("⛔ You don't have permission to view suppliers");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("suppliers:edit"))
        return showToast("⛔ You don't have permission to edit suppliers");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("suppliers:toggle-status"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("suppliers:delete"))
        return showToast("⛔ You don't have permission to delete suppliers");
      return await handleDelete(id, entry);
    }

    if (cls.contains("restore-btn")) {
      if (!hasPerm("suppliers:restore"))
        return showToast("⛔ You don't have permission to restore suppliers");
      return await handleRestore(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Supplier Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("supplierEditId", entry.id);
    sessionStorage.setItem("supplierEditPayload", JSON.stringify(entry));
    window.location.href = "add-supplier.html";
  }

  // 🔄 Toggle Status
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate supplier "${entry.name}"?`
        : `Activate supplier "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/suppliers/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle supplier status");

      const newStatus =
        (data?.data?.status ||
          (isActive ? "inactive" : "active")).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Supplier "${entry.name}" activated`
          : `✅ Supplier "${entry.name}" deactivated`
      );

      window.latestSupplierEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update supplier status");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete supplier "${entry.name}" permanently?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/suppliers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete supplier");

      showToast(`✅ Supplier "${entry.name}" deleted successfully`);
      window.latestSupplierEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete supplier");
    } finally {
      hideLoading();
    }
  }

  // ♻️ Restore
  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore supplier "${entry.name}" record?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/suppliers/${id}/restore`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to restore supplier");

      showToast(`✅ Supplier "${entry.name}" restored successfully`);
      window.latestSupplierEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to restore supplier");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestSupplierEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewSupplier = (id) => {
    if (!hasPerm("suppliers:view"))
      return showToast("⛔ No permission to view suppliers");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editSupplier = (id) => {
    if (!hasPerm("suppliers:edit"))
      return showToast("⛔ No permission to edit suppliers");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleSupplierStatus = async (id) => {
    if (!hasPerm("suppliers:toggle-status"))
      return showToast("⛔ No permission to toggle suppliers");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteSupplier = async (id) => {
    if (!hasPerm("suppliers:delete"))
      return showToast("⛔ No permission to delete suppliers");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  window.restoreSupplier = async (id) => {
    if (!hasPerm("suppliers:restore"))
      return showToast("⛔ No permission to restore suppliers");
    const entry = findEntry(id);
    await handleRestore(id, entry);
  };
}
