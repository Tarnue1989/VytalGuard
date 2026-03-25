// 📁 billing-trigger-actions.js – Enterprise Master Pattern (FIXED)
// ============================================================================
// 🧭 Permission-Driven Action Handler (Superadmin-Aware)
// 🔹 Mirrors patient / employee actions pattern
// 🔹 Fully aligned with BillingTrigger controller + routes
// 🔹 Unified lifecycle: view, edit, toggle-status, delete
// 🔹 ALL IDs preserved exactly for Billing Trigger list & form
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./billing-trigger-render.js";

/**
 * Unified permission-aware action handler for Billing Trigger module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("billingTriggerTableBody");
  const cardContainer = document.getElementById("billingTriggerList");

  // 🗂️ Cache latest entries
  window.latestBillingTriggerEntries = entries || [];

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
      String(p).toLowerCase().trim()
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
      (window.latestBillingTriggerEntries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/billing-triggers/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Billing trigger not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Billing trigger data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("billing_triggers:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("billing_triggers:update"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // ✅ FIXED: correct class name
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("billing_triggers:update"))
        return showToast("⛔ You don't have permission to change status");
      return handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("billing_triggers:delete"))
        return showToast("⛔ You don't have permission to delete");
      return handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Billing Trigger", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("billingTriggerEditId", entry.id);
    sessionStorage.setItem(
      "billingTriggerEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-billing-trigger.html";
  }

  // 🔄 Toggle Active
  async function handleToggleStatus(id, entry) {
    const isActive = !!entry.is_active;
    const confirmed = await showConfirm(
      isActive ? "Deactivate this trigger?" : "Activate this trigger?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/billing-triggers/${id}/toggle`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data?.message || "❌ Failed to toggle billing trigger"
        );

      showToast(
        `✅ Billing trigger "${entry.module_key}" ${
          data?.data?.is_active ? "activated" : "deactivated"
        }`
      );

      window.latestBillingTriggerEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update trigger status");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this billing trigger?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/billing-triggers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data?.message || "❌ Failed to delete billing trigger"
        );

      showToast(
        `✅ Billing trigger "${entry.module_key}" deleted successfully`
      );

      window.latestBillingTriggerEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete billing trigger");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (INLINE ACTION SUPPORT)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestBillingTriggerEntries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewBillingTrigger = (id) => {
    if (!hasPerm("billing_triggers:view"))
      return showToast("⛔ No permission to view billing trigger");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Billing trigger not found");
  };

  window.editBillingTrigger = (id) => {
    if (!hasPerm("billing_triggers:update"))
      return showToast("⛔ No permission to edit billing trigger");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Billing trigger not found");
  };

  window.toggleBillingTrigger = async (id) => {
    if (!hasPerm("billing_triggers:update"))
      return showToast("⛔ No permission to toggle trigger");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteBillingTrigger = async (id) => {
    if (!hasPerm("billing_triggers:delete"))
      return showToast("⛔ No permission to delete billing trigger");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}
