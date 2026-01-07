// 📁 permissions-actions.js
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./permissions-render.js";

/* ============================================================
   ⚙️ Unified Permission Action Handlers
   Fully permission-aware + backend aligned
   ============================================================ */
export function setupPermissionActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions }
}) {
  const tableBody = document.getElementById("permissionTableBody");
  const cardContainer = document.getElementById("permissionList");

  // Cache entries globally
  window.latestPermissionEntries = entries || [];

  // Attach event listeners
  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ---------------------- Permission Normalization ---------------------- */
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

  const userPerms = normalizePermissions(user?.permissions || []);
  const hasPerm = (key) => userPerms.includes(key);
  const hasCreateOrEdit = () =>
    hasPerm("permissions:create") || hasPerm("permissions:edit");

  /* ---------------------- Core Action Dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestPermissionEntries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🧭 Fallback: fetch fresh record if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/permissions/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data?.record || data?.data;
      } catch (err) {
        console.error("❌ Fetch error:", err);
        return showToast("❌ Permission not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Permission data missing");

    const cls = btn.classList;

    // --- Basic Actions ---
    if (cls.contains("view-btn")) return handleView(entry);
    if (cls.contains("edit-btn")) return handleEdit(entry);
    if (cls.contains("delete-btn")) return handleDelete(id);
  }

  /* ---------------------- Action Handlers ---------------------- */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Permission Info", html);
  }

  function handleEdit(entry) {
    if (!hasCreateOrEdit()) {
      return showToast("⛔ You don't have permission to edit permissions");
    }
    sessionStorage.setItem("permissionEditId", entry.id);
    sessionStorage.setItem("permissionEditPayload", JSON.stringify(entry));
    window.location.href = "add-permission.html";
  }

  async function handleDelete(id) {
    if (!hasPerm("permissions:delete")) {
      return showToast("⛔ You don't have permission to delete permissions");
    }

    const confirmed = await showConfirm("🗑️ Delete this permission?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/permissions/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("❌ Delete failed:", data);
        showToast(data.message || "❌ Failed to delete permission");
        return;
      }

      showToast("✅ Permission deleted successfully");
      window.latestPermissionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error("❌ Delete error:", err);
      showToast("❌ Failed to delete permission");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global Shortcuts ---------------------- */
  const findEntry = (id) =>
    (window.latestPermissionEntries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewPermission = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Permission not found for viewing");
  };

  window.editPermission = (id) => {
    if (!hasCreateOrEdit()) {
      return showToast("⛔ You don't have permission to edit permissions");
    }
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Permission not found for editing");
  };

  window.deletePermission = async (id) => {
    if (!hasPerm("permissions:delete")) {
      return showToast("⛔ You don't have permission to delete permissions");
    }
    await handleDelete(id);
  };
}
