// ============================================================================
// 🏢 VytalGuard – Organization Actions (Enterprise Master Pattern Aligned)
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
  user,
}) {
  const tableBody = document.getElementById("organizationTableBody");
  const cardContainer = document.getElementById("organizationList");

  window.latestOrganizationEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🧩 PERMISSIONS
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

  const userPerms = new Set(
    normalizePermissions(user?.permissions || []).map((p) =>
      String(p).toLowerCase().trim()
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
    isSuperAdmin || userPerms.has(key.toLowerCase().trim());

  /* ============================================================
     🎯 DISPATCHER
  ============================================================= */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestOrganizationEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/organizations/${id}`);
        const json = await res.json().catch(() => ({}));
        entry = json?.data || null;
      } catch {
        showToast("❌ Organization not found");
        return;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Organization data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("organizations:view"))
        return showToast("⛔ No permission to view organization");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("organizations:edit"))
        return showToast("⛔ No permission to edit organization");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("organizations:update"))
        return showToast("⛔ No permission to toggle organization");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("organizations:delete"))
        return showToast("⛔ No permission to delete organization");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     🧠 HANDLERS
  ============================================================= */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Organization Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("organizationEditId", entry.id);
    sessionStorage.setItem(
      "organizationEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-organization.html";
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
      const res = await authFetch(
        `/api/organizations/${id}/toggle-status`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || "❌ Failed to toggle organization status"
        );

      showToast(
        isActive
          ? `✅ "${entry.name}" deactivated`
          : `✅ "${entry.name}" activated`
      );

      window.latestOrganizationEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update organization status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete organization "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/organizations/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete organization");

      showToast(`✅ "${entry.name}" deleted`);
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
     🌐 GLOBAL HELPERS
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
  };

  window.editEntry = (id) => {
    if (!hasPerm("organizations:edit"))
      return showToast("⛔ No permission to edit organization");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("organizations:update"))
      return showToast("⛔ No permission to toggle organization");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("organizations:delete"))
      return showToast("⛔ No permission to delete organization");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}
