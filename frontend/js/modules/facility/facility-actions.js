// 📁 facility-actions.js – Full Permission-Driven Action Handlers for Facilities
// ============================================================================
// 🧭 Master Pattern: role-actions.js (Authoritative)
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
import { renderCard } from "./facility-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const tableBody = document.getElementById("facilityTableBody");
  const cardContainer = document.getElementById("facilityList");

  // cache last entries
  window.latestFacilityEntries = entries;

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
      (window.latestFacilityEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/facilities/${id}`);
        const json = await res.json().catch(() => ({}));
        entry = json?.data || null;
      } catch {
        showToast("❌ Facility not found");
        return;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Facility data missing");

    /* ===================== ACTION ROUTES ===================== */

    // VIEW
    if (action === "view") {
      if (!hasPerm("facilities:view"))
        return showToast("⛔ You don't have permission to view facilities");
      return handleView(entry);
    }

    // EDIT
    if (action === "edit") {
      if (!hasPerm("facilities:edit"))
        return showToast("⛔ You don't have permission to edit facilities");
      return handleEdit(entry);
    }

    // TOGGLE STATUS
    if (action === "toggle-status") {
      if (!hasPerm("facilities:update"))
        return showToast("⛔ You don't have permission to toggle facilities");
      return await handleToggleStatus(id, entry);
    }

    // DELETE
    if (action === "delete") {
      if (!hasPerm("facilities:delete"))
        return showToast("⛔ You don't have permission to delete facilities");
      return await handleDelete(id, entry);
    }

    // Unknown action → safely ignore
  }

  /* ===================== HANDLERS ===================== */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Facility Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("facilityEditId", entry.id);
    sessionStorage.setItem(
      "facilityEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-facility.html";
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";

    const confirmed = await showConfirm(
      isActive
        ? `Deactivate facility "${entry.name}"?`
        : `Activate facility "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/facilities/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle facility status");

      const newStatus =
        (data?.data?.status ||
          (isActive ? "inactive" : "active")).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Facility "${entry.name}" activated`
          : `✅ Facility "${entry.name}" deactivated`
      );

      window.latestFacilityEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update facility status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete facility "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/facilities/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete facility");

      showToast(`✅ Facility "${entry.name}" deleted`);
      window.latestFacilityEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete facility");
    } finally {
      hideLoading();
    }
  }

  /* ===================== GLOBAL HELPERS ===================== */

  const findEntry = (id) =>
    (window.latestFacilityEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("facilities:view"))
      return showToast("⛔ No permission to view facilities");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editEntry = (id) => {
    if (!hasPerm("facilities:edit"))
      return showToast("⛔ No permission to edit facilities");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("facilities:update"))
      return showToast("⛔ No permission to toggle facilities");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("facilities:delete"))
      return showToast("⛔ No permission to delete facilities");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}
