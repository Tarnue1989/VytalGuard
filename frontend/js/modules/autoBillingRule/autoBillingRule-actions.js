// 📁 autoBillingRule-actions.js – Full Permission-Driven Action Handlers for Auto Billing Rules
// ============================================================================
// 🧠 Master Pattern: BillableItem / Vital / Central Stock
// 🔹 Enterprise Permission Control (RBAC + Superadmin)
// 🔹 Unified UI Behavior (view, edit, toggle, restore, delete)
// 🔹 Safe ID Preservation for HTML Bindings
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./autoBillingRule-render.js";

/* ============================================================
   🎯 Main Setup
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
  const tableBody = document.getElementById("autoBillingRuleTableBody");
  const cardContainer = document.getElementById("autoBillingRuleList");
  const { currentEditIdRef } = sharedState || {};

  // Cache latest entries globally
  window.latestAutoBillingRuleEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🧩 Permission Normalization
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
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) => {
    const normalizedKey = key
      .replace(/autoBillingRules?/gi, "auto_billing_rules")
      .trim()
      .toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ============================================================
     ⚙️ Action Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestAutoBillingRuleEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/auto-billing-rules/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Auto Billing Rule not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Auto Billing Rule data missing");
    const cls = btn.classList;

    // 🔹 View — always allowed
    if (cls.contains("view-btn")) return handleView(entry);

    // 🔹 Edit
    if (cls.contains("edit-btn")) {
      if (!hasPerm("auto_billing_rules:edit"))
        return showToast("⛔ No permission to edit");
      return handleEdit(entry);
    }

    // 🔹 Toggle Status
    if (cls.contains("toggle-btn") || cls.contains("toggle-status-btn")) {
      if (
        !hasPerm("auto_billing_rules:toggle-status") &&
        !hasPerm("auto_billing_rules:edit")
      )
        return showToast("⛔ No permission to toggle status");
      return await handleToggleStatus(id, entry);
    }

    // 🔹 Restore
    if (cls.contains("restore-btn")) {
      if (
        !hasPerm("auto_billing_rules:restore") &&
        !hasPerm("auto_billing_rules:edit")
      )
        return showToast("⛔ No permission to restore");
      return await handleRestore(id, entry);
    }

    // 🔹 Delete
    if (cls.contains("delete-btn")) {
      if (!hasPerm("auto_billing_rules:delete"))
        return showToast("⛔ No permission to delete");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     🧭 Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Auto Billing Rule Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("autoBillingRuleEditId", entry.id);
    sessionStorage.setItem("autoBillingRuleEditPayload", JSON.stringify(entry));
    window.location.href = `add-autoBillingRule.html?id=${entry.id}`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate auto billing rule for "${entry.trigger_module || "Unknown"}"?`
        : `Activate auto billing rule for "${entry.trigger_module || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/auto-billing-rules/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle rule status");

      const newStatus = (
        data?.data?.status || (isActive ? "inactive" : "active")
      ).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Rule for "${entry.trigger_module || "Unknown"}" activated`
          : `✅ Rule for "${entry.trigger_module || "Unknown"}" deactivated`
      );

      window.latestAutoBillingRuleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update rule status");
    } finally {
      hideLoading();
    }
  }

  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore deleted Auto Billing Rule for "${entry.trigger_module || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/auto-billing-rules/${id}/restore`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to restore Auto Billing Rule");

      showToast(`✅ "${entry.trigger_module || "Unknown"}" restored successfully`);
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Restore failed");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete Auto Billing Rule for "${entry.trigger_module || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/auto-billing-rules/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete Auto Billing Rule");

      showToast(`✅ Rule for "${entry.trigger_module || "Unknown"}" deleted`);
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 Global Helper Bindings
  ============================================================ */
  const findEntry = (id) =>
    (window.latestAutoBillingRuleEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewAutoBillingEntry = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Auto Billing Rule not found");
  };

  window.editAutoBillingEntry = (id) => {
    if (!hasPerm("auto_billing_rules:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Rule not found");
  };

  window.toggleAutoBillingStatus = async (id) => {
    if (
      !hasPerm("auto_billing_rules:toggle-status") &&
      !hasPerm("auto_billing_rules:edit")
    )
      return showToast("⛔ No permission to toggle status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.restoreAutoBillingEntry = async (id) => {
    if (
      !hasPerm("auto_billing_rules:restore") &&
      !hasPerm("auto_billing_rules:edit")
    )
      return showToast("⛔ No permission to restore");
    const entry = findEntry(id);
    await handleRestore(id, entry);
  };

  window.deleteAutoBillingEntry = async (id) => {
    if (!hasPerm("auto_billing_rules:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
