// 📁 delivery-record-actions.js – Full Permission-Driven Action Handlers for Delivery Records
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./delivery-record-render.js";

/**
 * Unified, permission-driven action handler
 * Mirrors centralstock-actions.js (superadmin-aware, normalized permissions)
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("deliveryRecordTableBody");
  const cardContainer = document.getElementById("deliveryRecordList");

  // Cache latest entries
  window.latestDeliveryRecordEntries = entries;

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

  const userPerms = new Set(normalizePermissions(user?.permissions || []).map((p) => p.toLowerCase().trim()));

  // ✅ Super Admin bypass
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker (underscore-based)
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
      (window.latestDeliveryRecordEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch if missing
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/delivery-records/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Delivery Record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Delivery Record data missing");
    const cls = btn.classList;

    // --- Basic view ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("delivery_records:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("delivery_records:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("delivery_records:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    // --- Lifecycle actions ---
    if (cls.contains("start-btn")) {
      if (!hasPerm("delivery_records:start"))
        return showToast("⛔ No permission to start delivery record");
      return await handleLifecycle(id, "start", "Start this delivery record?");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("delivery_records:complete"))
        return showToast("⛔ No permission to complete delivery record");
      return await handleLifecycle(
        id,
        "complete",
        "Mark this delivery record as completed?"
      );
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("delivery_records:verify"))
        return showToast("⛔ No permission to verify delivery record");
      return await handleLifecycle(id, "verify", "Verify this delivery record?");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("delivery_records:cancel"))
        return showToast("⛔ No permission to cancel delivery record");
      return await handleLifecycle(id, "cancel", "Cancel this delivery record?");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("delivery_records:void"))
        return showToast("⛔ No permission to void delivery record");
      return await handleLifecycle(
        id,
        "void",
        "Void this delivery record? (Admin/Superadmin only)"
      );
    }
  }

  /* ---------------------- Handlers ---------------------- */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Delivery Record Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("deliveryRecordEditId", entry.id);
    sessionStorage.setItem("deliveryRecordEditPayload", JSON.stringify(entry));
    window.location.href = `add-delivery-record.html`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this delivery record?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/delivery-records/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete delivery record");

      showToast(`✅ Delivery Record deleted successfully`);
      window.latestDeliveryRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete delivery record");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/delivery-records/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} delivery record`);

      showToast(`✅ Delivery Record ${action} successful`);
      window.latestDeliveryRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} delivery record`);
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global helpers ---------------------- */
  const findEntry = (id) =>
    (window.latestDeliveryRecordEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("delivery_records:view"))
      return showToast("⛔ No permission to view delivery record");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Delivery record not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("delivery_records:edit"))
      return showToast("⛔ No permission to edit delivery record");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Delivery record not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("delivery_records:delete"))
      return showToast("⛔ No permission to delete delivery record");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  // lifecycle globals
  ["start", "complete", "verify", "cancel", "void"].forEach((action) => {
    window[`${action}Entry`] = async (id) => {
      if (!hasPerm(`delivery_records:${action}`))
        return showToast(`⛔ No permission to ${action} delivery record`);
      const entry = findEntry(id);
      await handleLifecycle(id, action, `Proceed to ${action} this delivery record?`);
    };
  });
}
