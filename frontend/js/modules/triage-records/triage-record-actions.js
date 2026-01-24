// 📁 triageRecord-actions.js – Enterprise MASTER Parity (Actions)
// ============================================================================
// 🧭 MASTER SOURCE: vital-actions.js
// 🔹 FULL lifecycle parity: view / edit / start / complete / verify / finalize / cancel / void / delete
// 🔹 Permission-driven (superadmin-aware, normalized)
// 🔹 Unified table + card dispatcher
// 🔹 Identical confirm / loading / reload behavior
// 🔹 ALL existing API routes, DOM IDs, and storage keys PRESERVED
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./triage-record-render.js";

/**
 * Unified permission-aware action handler for Triage Record module
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
  const tableBody = document.getElementById("triageRecordTableBody");
  const cardContainer = document.getElementById("triageRecordList");

  // 🗂️ Cache latest entries
  window.latestTriageRecordEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER)
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
      (window.latestTriageRecordEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/triage-records/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Triage record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Triage record data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("triage_records:view"))
        return showToast("⛔ You don't have permission to view triage records");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("triage_records:edit"))
        return showToast("⛔ You don't have permission to edit triage records");
      return handleEdit(entry);
    }

    if (cls.contains("start-btn")) {
      if (!hasPerm("triage_records:edit"))
        return showToast("⛔ No permission to start triage record");
      return await handleLifecycle(id, "start");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("triage_records:edit"))
        return showToast("⛔ No permission to complete triage record");
      return await handleLifecycle(id, "complete");
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("triage_records:verify"))
        return showToast("⛔ No permission to verify triage record");
      return await handleLifecycle(id, "verify");
    }

    if (cls.contains("finalize-btn")) {
      if (!hasPerm("triage_records:finalize"))
        return showToast("⛔ No permission to finalize triage record");
      return await handleLifecycle(id, "finalize");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("triage_records:edit"))
        return showToast("⛔ No permission to cancel triage record");
      return await handleLifecycle(id, "cancel");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("triage_records:void"))
        return showToast("⛔ No permission to void triage record");
      return await handleLifecycle(id, "void");
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("triage_records:delete"))
        return showToast("⛔ You don't have permission to delete triage records");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Triage Record Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("triageRecordEditId", entry.id);
    sessionStorage.setItem(
      "triageRecordEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-triage-record.html";
  }

  // 🔁 Lifecycle (start / complete / verify / finalize / cancel / void)
  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} this triage record?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/triage-records/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || `❌ Failed to ${action} triage record`
        );

      showToast(`✅ Triage record ${action} successful`);
      window.latestTriageRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(
        err.message || `❌ Failed to ${action} triage record`
      );
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      "Delete this triage record permanently?"
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/triage-records/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || "❌ Failed to delete triage record"
        );

      showToast("✅ Triage record deleted successfully");
      window.latestTriageRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(
        err.message || "❌ Failed to delete triage record"
      );
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestTriageRecordEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewTriageRecord = (id) => {
    if (!hasPerm("triage_records:view"))
      return showToast("⛔ No permission to view triage record");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editTriageRecord = (id) => {
    if (!hasPerm("triage_records:edit"))
      return showToast("⛔ No permission to edit triage record");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteTriageRecord = async (id) => {
    if (!hasPerm("triage_records:delete"))
      return showToast("⛔ No permission to delete triage record");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
