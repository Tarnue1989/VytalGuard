// 📁 feature-access-actions.js – Enterprise Master Pattern
// ============================================================================
// 🧭 Permission-Driven Action Handler (Superadmin-Aware)
// 🔹 Mirrors feature-module-actions.js EXACTLY
// 🔹 Unified lifecycle: view, edit, toggle-status, delete
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
import { renderCard } from "./feature-access-render.js";

/**
 * Unified permission-aware action handler for Feature Access
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
  const tableBody = document.getElementById("featureAccessTableBody");
  const cardContainer = document.getElementById("featureAccessList");

  // 🗂️ Cache latest entries
  window.latestFeatureAccessEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (Patient / Module parity)
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
      (window.latestFeatureAccessEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/features/feature-access/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data?.record || data?.data;
      } catch {
        return showToast("❌ Feature Access not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Feature Access data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("feature_accesse:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("feature_accesse:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("feature_accesse:toggle-status"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("feature_accesse:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 👁️ View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Feature Access Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("featureAccessEditId", entry.id);
    sessionStorage.setItem(
      "featureAccessEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-feature-access.html";
  }

  // 🔄 Toggle Status
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? "Deactivate this feature access?"
        : "Activate this feature access?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/features/feature-access/${id}/toggle-status`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle access status");

      const roleName =
        data?.data?.role?.name || entry?.role?.name || "Role";
      const moduleName =
        data?.data?.module?.name || entry?.module?.name || "Module";

      showToast(
        `✅ Access for "${roleName}" on "${moduleName}" updated`
      );

      window.latestFeatureAccessEntries = [];
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
    const confirmed = await showConfirm(
      `Delete access for role "${entry?.role?.name || "Role"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/features/feature-access/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete access");

      const roleName =
        entry?.role?.name || data?.data?.role?.name || "Role";
      const moduleName =
        entry?.module?.name || data?.data?.module?.name || "Module";

      showToast(
        `✅ Access for "${roleName}" on "${moduleName}" deleted`
      );

      window.latestFeatureAccessEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete access");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Parity with Module)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestFeatureAccessEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewFeatureAccess = (id) => {
    if (!hasPerm("feature_accesse:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editFeatureAccess = (id) => {
    if (!hasPerm("feature_accesse:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleFeatureAccessStatus = async (id) => {
    if (!hasPerm("feature_accesse:toggle-status"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteFeatureAccess = async (id) => {
    if (!hasPerm("feature_accesse:delete"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}
