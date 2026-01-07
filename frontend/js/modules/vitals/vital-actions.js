// 📁 vital-actions.js – Full Permission-Driven Action Handlers for Vitals
// ============================================================================
// 🧭 Master Pattern: consultation-actions.js
// 🔹 Full permission alignment (view, edit, delete, lifecycle)
// 🔹 "Complete" button label now calls backend `/finalize` route
// 🔹 Includes normalized permission parsing + superadmin bypass
// 🔹 Keeps all existing DOM IDs exactly as in your HTML
// ============================================================================
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./vital-render.js";

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
  const tableBody = document.getElementById("vitalTableBody");
  const cardContainer = document.getElementById("vitalList");

  // cache latest entries
  window.latestVitalEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ---------------------- Normalize permissions ---------------------- */
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

  // ✅ Super Admin bypass
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker
  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ---------------------- Handler dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestVitalEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch if missing
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/vitals/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Vital not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Vital data missing");
    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("vitals:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("vitals:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("vitals:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    // --- Lifecycle (start, complete→finalize, verify, void) ---
    if (cls.contains("start-btn")) {
      if (!hasPerm("vitals:start"))
        return showToast("⛔ No permission to start vital");
      return await handleLifecycle(id, "start", "Start this vital record?");
    }

    // 🟢 "Complete" button (calls finalize endpoint)
    if (cls.contains("complete-btn") || cls.contains("finalize-btn")) {
      if (!hasPerm("vitals:finalize"))
        return showToast("⛔ No permission to complete vital");
      return await handleLifecycle(id, "finalize", "Mark this vital as completed?");
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("vitals:verify"))
        return showToast("⛔ No permission to verify vital");
      return await handleLifecycle(id, "verify", "Verify this vital record?");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("vitals:void"))
        return showToast("⛔ No permission to void vital");
      return await handleLifecycle(
        id,
        "void",
        "Void this vital record? (Admin/Superadmin only)"
      );
    }
  }

  /* ---------------------- Handlers ---------------------- */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Vital Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("vitalEditId", entry.id);
    sessionStorage.setItem("vitalEditPayload", JSON.stringify(entry));
    window.location.href = `add-vital.html`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this vital record?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/vitals/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete vital");

      showToast("✅ Vital deleted successfully");
      window.latestVitalEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete vital");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/vitals/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `❌ Failed to ${action} vital`);

      const label =
        action === "finalize" ? "completed" : action === "void" ? "voided" : action;
      showToast(`✅ Vital ${label} successfully`);
      window.latestVitalEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} vital`);
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global helpers ---------------------- */
  const findEntry = (id) =>
    (window.latestVitalEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("vitals:view"))
      return showToast("⛔ No permission to view vital");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Vital not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("vitals:edit"))
      return showToast("⛔ No permission to edit vital");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Vital not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("vitals:delete"))
      return showToast("⛔ No permission to delete vital");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  ["start", "finalize", "verify", "void"].forEach((action) => {
    window[`${action}Entry`] = async (id) => {
      if (!hasPerm(`vitals:${action}`))
        return showToast(`⛔ No permission to ${action} vital`);
      const entry = findEntry(id);
      await handleLifecycle(
        id,
        action,
        `Proceed to ${action === "finalize" ? "complete" : action} this vital record?`
      );
    };
  });
}
