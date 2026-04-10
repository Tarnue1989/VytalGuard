// 📁 insurance-provider-actions.js – ENTERPRISE MASTER FINAL
// ============================================================================
// 🔹 Granular permissions (insurance_providers:*)
// 🔹 Event guard (prevents duplicate handlers)
// 🔹 Fully aligned with status-action-matrix
// 🔹 Safe fallback fetch preserved
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard } from "./insurance-provider-render.js";

/* ============================================================
   🛡️ EVENT GUARD
============================================================ */
let insuranceProviderHandlersBound = false;

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  if (insuranceProviderHandlersBound) return;
  insuranceProviderHandlersBound = true;

  const tableBody = document.getElementById("insuranceProviderTableBody");
  const cardContainer = document.getElementById("insuranceProviderList");

  window.latestInsuranceProviderEntries = entries;

  tableBody?.addEventListener("click", handleActions);
  cardContainer?.addEventListener("click", handleActions);

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
      (window.latestInsuranceProviderEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    /* ===== fallback fetch ===== */
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/insurance-providers/${id}`);
        const json = await res.json().catch(() => ({}));
        entry = json?.data || null;
      } catch {
        showToast("❌ Provider not found");
        return;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Provider data missing");

    /* ===================== ACTION ROUTES ===================== */

    if (action === "view") {
      if (!hasPerm("insurance_providers:view"))
        return showToast("⛔ No permission to view providers");
      return handleView(entry);
    }

    if (action === "edit") {
      if (!hasPerm("insurance_providers:edit"))
        return showToast("⛔ No permission to edit providers");
      return handleEdit(entry);
    }

    if (action === "toggle-status") {
      if (!hasPerm("insurance_providers:toggle_status"))
        return showToast("⛔ No permission to toggle providers");
      return await handleToggleStatus(id, entry);
    }

    if (action === "delete") {
      if (!hasPerm("insurance_providers:delete"))
        return showToast("⛔ No permission to delete providers");
      return await handleDelete(id, entry);
    }
  }

  /* ===================== HANDLERS ===================== */

  function handleView(entry) {
    openViewModal(
      "Insurance Provider Info",
      renderCard(entry, visibleFields, user)
    );
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("insuranceProviderEditId", entry.id);
    sessionStorage.setItem(
      "insuranceProviderEditPayload",
      JSON.stringify(entry)
    );

    window.location.href = "add-insurance-provider.html";
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";

    const confirmed = await showConfirm(
      isActive
        ? `Deactivate provider "${entry.name}"?`
        : `Activate provider "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(
        `/api/insurance-providers/${id}/toggle-status`,
        { method: "PATCH" }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle provider");

      const newStatus =
        (data?.data?.status || (isActive ? "inactive" : "active")).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Provider "${entry.name}" activated`
          : `✅ Provider "${entry.name}" deactivated`
      );

      window.latestInsuranceProviderEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update provider");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete provider "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/insurance-providers/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete provider");

      showToast(`✅ Provider "${entry.name}" deleted`);

      window.latestInsuranceProviderEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete provider");
    } finally {
      hideLoading();
    }
  }

  /* ===================== GLOBAL HELPERS ===================== */

  const findEntry = (id) =>
    (window.latestInsuranceProviderEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("insurance_providers:view"))
      return showToast("⛔ No permission to view providers");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editEntry = (id) => {
    if (!hasPerm("insurance_providers:edit"))
      return showToast("⛔ No permission to edit providers");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("insurance_providers:toggle_status"))
      return showToast("⛔ No permission to toggle providers");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("insurance_providers:delete"))
      return showToast("⛔ No permission to delete providers");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}