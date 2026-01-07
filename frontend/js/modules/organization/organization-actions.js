// ============================================================================
// 🏢 VytalGuard – Organization Actions (Enterprise Master Pattern Aligned)
// 🔹 Mirrors consultation-actions.js for unified permission logic & UI behavior
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
import { renderCard } from "./organization-render.js";

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
  const tableBody = document.getElementById("organizationTableBody");
  const cardContainer = document.getElementById("organizationList");
  window.latestOrganizationEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🧩 Normalize + Superadmin Bypass
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
      (window.latestOrganizationEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/organizations/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Organization not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Organization data missing");
    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("organizations:view"))
        return showToast("⛔ No permission to view organization");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("organizations:edit"))
        return showToast("⛔ No permission to edit organization");
      return handleEdit(entry);
    }

    // --- Toggle Status ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("organizations:toggle-status"))
        return showToast("⛔ No permission to toggle status");
      return await handleToggleStatus(id, entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("organizations:delete"))
        return showToast("⛔ No permission to delete organization");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     🧠 Handlers
  ============================================================= */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Organization Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;
    sessionStorage.setItem("organizationEditId", entry.id);
    sessionStorage.setItem("organizationEditPayload", JSON.stringify(entry));
    window.location.href = `add-organization.html`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate organization "${entry.name}"?`
        : `Activate organization "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/organizations/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle organization status");

      const updated = data?.data || {};
      const orgName = updated.name || entry?.name || "Organization";
      const newStatus = (updated.status || "").toLowerCase();

      if (newStatus === "active") showToast(`✅ "${orgName}" activated`);
      else if (newStatus === "inactive") showToast(`✅ "${orgName}" deactivated`);
      else if (newStatus === "deleted")
        showToast(`✅ "${orgName}" marked as deleted`);
      else showToast(`✅ "${orgName}" status updated`);

      window.latestOrganizationEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to toggle organization status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this organization?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/organizations/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete organization");

      const orgName = entry?.name || data?.data?.name || "Organization";
      showToast(`✅ "${orgName}" deleted successfully`);

      window.latestOrganizationEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete organization");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 Global Helpers
  ============================================================= */
  const findEntry = (id) =>
    (window.latestOrganizationEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("organizations:view"))
      return showToast("⛔ No permission to view organization");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Organization not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("organizations:edit"))
      return showToast("⛔ No permission to edit organization");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Organization not found for editing");
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("organizations:toggle-status"))
      return showToast("⛔ No permission to toggle organization status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("organizations:delete"))
      return showToast("⛔ No permission to delete organization");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}

// ============================================================================
// ✅ Aligned with Enterprise Master Pattern (consultation-actions.js):
//    • Unified permission model
//    • Superadmin override
//    • Global window helpers
//    • Non-breaking field & ID retention
// ============================================================================
