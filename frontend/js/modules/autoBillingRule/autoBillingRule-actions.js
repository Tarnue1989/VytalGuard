// 📁 autoBillingRule-actions.js – ENTERPRISE MASTER PARITY (UPGRADED)
// ============================================================================
// 🧭 FULL ALIGNMENT WITH registrationLog-actions.js MASTER
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Explicit lifecycle: view / edit / toggle / restore / delete
// 🔹 Keeps ALL existing API routes intact
// 🔹 Adds standardized permission normalization + global helpers
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
   🎯 MAIN SETUP
============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  const { currentEditIdRef } = sharedState || {};

  const tableBody = document.getElementById("autoBillingRuleTableBody");
  const cardContainer = document.getElementById("autoBillingRuleList");

  // 🗂️ Cache latest entries
  window.latestAutoBillingRuleEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER)
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

  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin ||
    userPerms.has(
      String(key)
        .replace(/autoBillingRules?/gi, "auto_billing_rules")
        .toLowerCase()
        .trim()
    );

  /* ============================================================
     🎯 MAIN DISPATCHER
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestAutoBillingRuleEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER)
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

    /* ---------------- VIEW ---------------- */
    if (cls.contains("view-btn")) {
      return handleView(entry);
    }

    /* ---------------- EDIT ---------------- */
    if (cls.contains("edit-btn")) {
      if (!hasPerm("auto_billing_rules:edit"))
        return showToast("⛔ No permission to edit");
      return handleEdit(entry);
    }

    /* ---------------- TOGGLE ---------------- */
    if (cls.contains("toggle-btn") || cls.contains("toggle-status-btn")) {
      if (
        !hasPerm("auto_billing_rules:toggle-status") &&
        !hasPerm("auto_billing_rules:edit")
      )
        return showToast("⛔ No permission to toggle status");
      return handleToggleStatus(id, entry);
    }

    /* ---------------- RESTORE ---------------- */
    if (cls.contains("restore-btn")) {
      if (
        !hasPerm("auto_billing_rules:restore") &&
        !hasPerm("auto_billing_rules:edit")
      )
        return showToast("⛔ No permission to restore");
      return handleRestore(id, entry);
    }

    /* ---------------- DELETE ---------------- */
    if (cls.contains("delete-btn")) {
      if (!hasPerm("auto_billing_rules:delete"))
        return showToast("⛔ No permission to delete");
      return handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ HANDLERS
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Auto Billing Rule Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("autoBillingRuleEditId", entry.id);
    sessionStorage.setItem(
      "autoBillingRuleEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-autoBillingRule.html";
  }

  // 🔁 Toggle Status (kept original API)
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";

    const confirmed = await showConfirm(
      isActive
        ? `Deactivate rule for "${entry.trigger_module || "Unknown"}"?`
        : `Activate rule for "${entry.trigger_module || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(
        `/api/auto-billing-rules/${id}/toggle-status`,
        { method: "PATCH" }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle status");

      showToast(
        isActive
          ? "✅ Rule deactivated successfully"
          : "✅ Rule activated successfully"
      );

      window.latestAutoBillingRuleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to toggle status");
    } finally {
      hideLoading();
    }
  }

  // 🔁 Restore
  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore rule "${entry.trigger_module || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(
        `/api/auto-billing-rules/${id}/restore`,
        { method: "PATCH" }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to restore");

      showToast("✅ Rule restored successfully");
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Restore failed");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete rule "${entry.trigger_module || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/auto-billing-rules/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete");

      showToast("✅ Rule deleted successfully");

      window.latestAutoBillingRuleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Delete failed");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 GLOBAL HELPERS (MASTER)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestAutoBillingRuleEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewAutoBillingRule = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editAutoBillingRule = (id) => {
    if (!hasPerm("auto_billing_rules:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteAutoBillingRule = async (id) => {
    if (!hasPerm("auto_billing_rules:delete"))
      return showToast("⛔ No permission to delete");
    await handleDelete(id);
  };
}