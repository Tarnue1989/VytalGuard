// ============================================================================
// 🏥 VytalGuard – Facility Actions (Enterprise Master Pattern Aligned)
// 🔹 Mirrors organization-actions.js for unified permission logic & UI behavior
// 🔹 Fully backward-compatible with your existing HTML/JS integrations
// 🔹 All DOM IDs, routes, and function names preserved exactly
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

/* ============================================================
   ⚙️ MAIN ACTION HANDLER SETUP
============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions }
}) {
  const tableBody = document.getElementById("facilityTableBody");
  const cardContainer = document.getElementById("facilityList");
  window.latestFacilityEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🧩 Normalize Permissions
  ============================================================= */
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
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================= */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestFacilityEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/facilities/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Facility not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Facility data missing");
    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("facilities:view"))
        return showToast("⛔ No permission to view facility");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("facilities:edit"))
        return showToast("⛔ No permission to edit facility");
      return handleEdit(entry);
    }

    // --- Toggle Status ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("facilities:toggle-status"))
        return showToast("⛔ No permission to toggle facility status");
      return await handleToggleStatus(id, entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("facilities:delete"))
        return showToast("⛔ No permission to delete facility");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     🧠 Handlers
  ============================================================= */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Facility Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;
    sessionStorage.setItem("facilityEditId", entry.id);
    sessionStorage.setItem("facilityEditPayload", JSON.stringify(entry));
    window.location.href = `add-facility.html`;
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

      const updated = data?.data || {};
      const facilityName = updated.name || entry?.name || "Facility";
      const newStatus = (updated.status || "").toLowerCase();

      if (newStatus === "active") showToast(`✅ "${facilityName}" activated`);
      else if (newStatus === "inactive") showToast(`✅ "${facilityName}" deactivated`);
      else if (newStatus === "deleted") showToast(`✅ "${facilityName}" deleted`);
      else showToast(`✅ "${facilityName}" status updated`);

      window.latestFacilityEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to toggle facility status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(`Delete facility "${entry.name}"?`);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/facilities/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete facility");

      const facilityName = entry?.name || data?.data?.name || "Facility";
      showToast(`✅ "${facilityName}" deleted successfully`);

      window.latestFacilityEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete facility");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 Global Helpers
  ============================================================= */
  const findEntry = (id) =>
    (window.latestFacilityEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("facilities:view"))
      return showToast("⛔ No permission to view facility");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Facility not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("facilities:edit"))
      return showToast("⛔ No permission to edit facility");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Facility not found for editing");
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("facilities:toggle-status"))
      return showToast("⛔ No permission to toggle facility status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("facilities:delete"))
      return showToast("⛔ No permission to delete facility");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}

// ============================================================================
// ✅ Aligned with Enterprise Master Pattern (organization-actions.js):
//    • Unified permission model
//    • Superadmin override
//    • Global window helpers
//    • Non-breaking field & ID retention
// ============================================================================
