// 📁 supplier-actions.js – Enterprise-Aligned Master Pattern (Permission-Driven + Role-Aware)
// ============================================================================
// 🧭 Master Pattern Source: triageRecord-actions.js
// 🔹 Unified lifecycle, permission logic, confirm handling, DOM bindings
// 🔹 Superadmin bypass + normalized permission parsing
// 🔹 All existing HTML IDs preserved (safe integration)
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

/* ============================================================
   ⚙️ MAIN ACTION HANDLER INITIALIZER
============================================================ */
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

  // 🧩 Cache entries globally
  window.latestSupplierEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 PERMISSION NORMALIZATION (Unified)
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

  // ✅ Superadmin bypass (covers both single and multiple roles)
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker
  const hasPerm = (key) => {
    const normalized = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalized);
  };

  /* ============================================================
     ⚙️ MAIN ACTION HANDLER
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestSupplierEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback → fetch full record if not cached
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

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("suppliers:view"))
        return showToast("⛔ No permission to view suppliers");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("suppliers:edit"))
        return showToast("⛔ No permission to edit suppliers");
      return handleEdit(entry);
    }

    // --- Toggle Status ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("suppliers:update"))
        return showToast("⛔ No permission to change supplier status");
      return await handleToggleStatus(id, entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("suppliers:delete"))
        return showToast("⛔ No permission to delete suppliers");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     🧩 ACTION HANDLERS
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Supplier Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("supplierEditId", entry.id);
    sessionStorage.setItem("supplierEditPayload", JSON.stringify(entry));
    window.location.href = `add-supplier.html`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive ? "Deactivate this supplier?" : "Activate this supplier?"
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
        data?.data?.status || (isActive ? "inactive" : "active");
      showToast(
        `✅ Supplier "${entry.name}" status changed to ${newStatus.toUpperCase()}`
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

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this supplier?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/suppliers/${id}`, { method: "DELETE" });
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

  /* ============================================================
     🌐 GLOBAL HELPERS (Window-Level)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestSupplierEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("suppliers:view"))
      return showToast("⛔ No permission to view supplier");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Supplier not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("suppliers:edit"))
      return showToast("⛔ No permission to edit supplier");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Supplier not found for editing");
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("suppliers:update"))
      return showToast("⛔ No permission to change supplier status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("suppliers:delete"))
      return showToast("⛔ No permission to delete supplier");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
