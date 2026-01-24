// 📁 delivery-record-actions.js – Enterprise Master Pattern (Delivery Records)
// ============================================================================
// 🧭 FULL PARITY WITH ekg-record-actions.js
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / start / complete / verify / finalize / cancel / void / delete
// 🔹 Keeps all DOM IDs, routes, API calls, and UI behavior intact
// ============================================================================

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
 * Unified permission-aware action handler for Delivery Record module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("deliveryRecordTableBody");
  const cardContainer = document.getElementById("deliveryRecordList");

  // 🗂️ Cache latest entries
  window.latestDeliveryRecordEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions
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

  // 🧠 Superadmin bypass
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Permission checker
  const hasPerm = (key) =>
    isSuperAdmin ||
    userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestDeliveryRecordEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/delivery-records/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Delivery record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Delivery record data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("delivery_records:view"))
        return showToast("⛔ You don't have permission to view delivery records");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("delivery_records:edit"))
        return showToast("⛔ You don't have permission to edit delivery records");
      return handleEdit(entry);
    }

    if (cls.contains("start-btn")) {
      if (!hasPerm("delivery_records:edit"))
        return showToast("⛔ No permission to start delivery records");
      return await handleLifecycle(id, "start");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("delivery_records:edit"))
        return showToast("⛔ No permission to complete delivery records");
      return await handleLifecycle(id, "complete");
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("delivery_records:verify"))
        return showToast("⛔ No permission to verify delivery records");
      return await handleLifecycle(id, "verify");
    }

    if (cls.contains("finalize-btn")) {
      if (!hasPerm("delivery_records:finalize"))
        return showToast("⛔ No permission to finalize delivery records");
      return await handleLifecycle(id, "finalize");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("delivery_records:edit"))
        return showToast("⛔ No permission to cancel delivery records");
      return await handleLifecycle(id, "cancel");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("delivery_records:void"))
        return showToast("⛔ No permission to void delivery records");
      return await handleLifecycle(id, "void");
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("delivery_records:delete"))
        return showToast("⛔ You don't have permission to delete delivery records");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Delivery Record Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("deliveryRecordEditId", entry.id);
    sessionStorage.setItem(
      "deliveryRecordEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-delivery-record.html";
  }

  // 🔁 Lifecycle
  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} this delivery record?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/delivery-records/${id}/${action}`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || `❌ Failed to ${action} delivery record`
        );

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

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      "Delete this delivery record permanently?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/delivery-records/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || "❌ Failed to delete delivery record"
        );

      showToast("✅ Delivery Record deleted successfully");
      window.latestDeliveryRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete delivery record");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestDeliveryRecordEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewDeliveryRecord = (id) => {
    if (!hasPerm("delivery_records:view"))
      return showToast("⛔ No permission to view delivery records");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editDeliveryRecord = (id) => {
    if (!hasPerm("delivery_records:edit"))
      return showToast("⛔ No permission to edit delivery records");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteDeliveryRecord = async (id) => {
    if (!hasPerm("delivery_records:delete"))
      return showToast("⛔ No permission to delete delivery records");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
