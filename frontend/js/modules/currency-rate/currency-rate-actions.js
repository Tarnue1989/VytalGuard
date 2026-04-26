// 📁 currency-rate-actions.js – Full Permission-Driven Action Handlers for Currency Rates
// ============================================================================
// 🧭 Master Pattern: role-actions.js
// 🔹 Action routing via data-action (DYNAMIC, enterprise-safe)
// 🔹 Superadmin bypass + normalized permissions
// 🔹 Unified lifecycle (view, edit, toggle-status, delete)
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
import { renderCard } from "./currency-rate-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const tableBody = document.getElementById("currencyRateTableBody");
  const cardContainer = document.getElementById("currencyRateList");

  // cache last entries
  window.latestCurrencyRateEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ===================== PERMISSIONS ===================== */
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

  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(key.toLowerCase().trim());

  /* ===================== DISPATCHER ===================== */
  async function handleActions(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const { id, action } = btn.dataset;
    if (!id || !action) return;

    let entry =
      (window.latestCurrencyRateEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/currency-rates/${id}`);
        const json = await res.json().catch(() => ({}));
        entry = json?.data || null;
      } catch {
        showToast("❌ Currency rate not found");
        return;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Currency rate data missing");

    /* ===================== ACTION ROUTES ===================== */

    // VIEW
    if (action === "view") {
      if (!hasPerm("currency_rates:view"))
        return showToast("⛔ You don't have permission to view currency rates");
      return handleView(entry);
    }

    // EDIT
    if (action === "edit") {
      if (!hasPerm("currency_rates:edit"))
        return showToast("⛔ You don't have permission to edit currency rates");
      return handleEdit(entry);
    }

    // TOGGLE STATUS
    if (action === "toggle-status") {
      if (!hasPerm("currency_rates:update"))
        return showToast("⛔ You don't have permission to toggle currency rates");
      return await handleToggleStatus(id, entry);
    }

    // DELETE
    if (action === "delete") {
      if (!hasPerm("currency_rates:delete"))
        return showToast("⛔ You don't have permission to delete currency rates");
      return await handleDelete(id, entry);
    }

    // Unknown action → safely ignore
  }

  /* ===================== HANDLERS ===================== */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Currency Rate Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("currencyRateEditId", entry.id);
    sessionStorage.setItem("currencyRateEditPayload", JSON.stringify(entry));
    window.location.href = "add-currency-rate.html";
  }

  async function handleToggleStatus(id, entry) {
    const isActive =
      entry.is_active === true ||
      (entry.status || "").toLowerCase() === "active";

    const confirmed = await showConfirm(
      isActive
        ? `Deactivate currency rate "${entry.from_currency} → ${entry.to_currency}"?`
        : `Activate currency rate "${entry.from_currency} → ${entry.to_currency}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/currency-rates/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle currency rate status");

      const newStatus =
        (data?.data?.status ||
          (isActive ? "inactive" : "active")).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Currency rate activated`
          : `✅ Currency rate deactivated`
      );

      window.latestCurrencyRateEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update currency rate status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete currency rate "${entry.from_currency} → ${entry.to_currency}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/currency-rates/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete currency rate");

      showToast(`✅ Currency rate deleted`);
      window.latestCurrencyRateEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete currency rate");
    } finally {
      hideLoading();
    }
  }

  /* ===================== GLOBAL HELPERS ===================== */

  const findEntry = (id) =>
    (window.latestCurrencyRateEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("currency_rates:view"))
      return showToast("⛔ No permission to view currency rates");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editEntry = (id) => {
    if (!hasPerm("currency_rates:edit"))
      return showToast("⛔ No permission to edit currency rates");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("currency_rates:update"))
      return showToast("⛔ No permission to toggle currency rates");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("currency_rates:delete"))
      return showToast("⛔ No permission to delete currency rates");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}