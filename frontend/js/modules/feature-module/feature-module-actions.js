// 📁 feature-module-actions.js – Enterprise Master Pattern
// ============================================================================
// 🧭 Permission-Driven Action Handler (Superadmin-Aware)
// 🔹 Mirrors patient-actions.js EXACTLY
// 🔹 Keeps existing toggle-status & toggle-enabled APIs
// 🔹 Unified lifecycle: view, edit, toggle-status, toggle-enabled, delete
// 🔹 IDs, routes, and DOM contracts preserved
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./feature-module-render.js";

/**
 * Unified permission-aware action handler for Feature Modules
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
  const tableBody = document.getElementById("featureModuleTableBody");
  const cardContainer = document.getElementById("featureModuleList");

  // 🗂️ Cache latest entries
  window.latestFeatureModuleEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (Patient parity)
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
      (window.latestFeatureModuleEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/features/feature-modules/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data?.record || data?.data;
      } catch {
        return showToast("❌ Feature Module not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Feature Module data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("feature_modules:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("feature_modules:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("feature_modules:toggle-status"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("toggle-enabled-btn")) {
      if (!hasPerm("feature_modules:toggle-enabled"))
        return showToast("⛔ You don't have permission to enable/disable");
      return await handleToggleEnabled(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("feature_modules:delete"))
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
    openViewModal("Feature Module Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("featureModuleEditId", entry.id);
    sessionStorage.setItem(
      "featureModuleEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-feature-module.html";
  }

  // 🔄 Toggle Status
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? "Deactivate this feature module?"
        : "Activate this feature module?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/features/feature-modules/${id}/toggle-status`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle status");

      showToast(
        `✅ Module "${entry.name || "Module"}" status updated`
      );
      window.latestFeatureModuleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update status");
    } finally {
      hideLoading();
    }
  }

  // 🔄 Toggle Enabled
  async function handleToggleEnabled(id, entry) {
    const isEnabled = !!entry.enabled;
    const confirmed = await showConfirm(
      isEnabled
        ? "Disable this feature module?"
        : "Enable this feature module?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/features/feature-modules/${id}/toggle-enabled`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle enabled");

      showToast(
        `✅ Module "${entry.name || "Module"}" ${
          isEnabled ? "disabled" : "enabled"
        }`
      );
      window.latestFeatureModuleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update enabled state");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete feature module "${entry?.name || "Module"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/features/feature-modules/${id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete module");

      showToast(
        `✅ Module "${entry?.name || "Module"}" deleted`
      );
      window.latestFeatureModuleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete module");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (parity)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestFeatureModuleEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewFeatureModule = (id) => {
    if (!hasPerm("feature_modules:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editFeatureModule = (id) => {
    if (!hasPerm("feature_modules:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleFeatureModuleStatus = async (id) => {
    if (!hasPerm("feature_modules:toggle-status"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.toggleFeatureModuleEnabled = async (id) => {
    if (!hasPerm("feature_modules:toggle-enabled"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) await handleToggleEnabled(id, entry);
  };

  window.deleteFeatureModule = async (id) => {
    if (!hasPerm("feature_modules:delete"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}
