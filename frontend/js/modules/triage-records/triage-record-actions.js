// 📁 triageRecord-actions.js – Enterprise-Aligned Master Pattern (Permission-Driven + Role-Aware)
// ============================================================================
// 🧭 Master Pattern Source: vital-actions.js
// 🔹 Same lifecycle flow, permission logic, confirm handling, and DOM bindings
// 🔹 Supports: start → complete → verify → cancel → void
// 🔹 Includes full superadmin bypass and normalized permission parsing
// 🔹 All existing HTML element IDs preserved exactly
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

  // 🧩 Cache entries globally
  window.latestTriageRecordEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 PERMISSION NORMALIZATION (Unified)
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

  const userPerms = new Set(normalizePermissions(user?.permissions || []));

  // ✅ Superadmin bypass (covers both single and multiple roles)
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker
  const hasPerm = (key) => {
    const normalized = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalized);
  };

  /* ============================================================
     ⚙️ MAIN ACTION HANDLER
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestTriageRecordEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback → fetch full record if not cached
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

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("triage_records:view"))
        return showToast("⛔ No permission to view triage records");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("triage_records:edit"))
        return showToast("⛔ No permission to edit triage records");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("triage_records:delete"))
        return showToast("⛔ No permission to delete triage records");
      return await handleDelete(id, entry);
    }

    // --- Lifecycle Actions ---
    if (cls.contains("start-btn")) {
      if (!hasPerm("triage_records:start"))
        return showToast("⛔ No permission to start triage record");
      return await handleLifecycle(id, "start", "Start this triage record?");
    }

    if (cls.contains("complete-btn") || cls.contains("finalize-btn")) {
      if (!hasPerm("triage_records:complete"))
        return showToast("⛔ No permission to complete triage record");
      return await handleLifecycle(
        id,
        "complete",
        "Mark this triage record as completed?"
      );
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("triage_records:verify"))
        return showToast("⛔ No permission to verify triage record");
      return await handleLifecycle(id, "verify", "Verify this triage record?");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("triage_records:cancel"))
        return showToast("⛔ No permission to cancel triage record");
      return await handleLifecycle(id, "cancel", "Cancel this triage record?");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("triage_records:void"))
        return showToast("⛔ No permission to void triage record");
      return await handleLifecycle(
        id,
        "void",
        "Void this triage record? (Admin/Superadmin only)"
      );
    }
  }

  /* ============================================================
     🧩 ACTION HANDLERS
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Triage Record Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("triageRecordEditId", entry.id);
    sessionStorage.setItem("triageRecordEditPayload", JSON.stringify(entry));
    window.location.href = `add-triage-record.html`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this triage record?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/triage-records/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete triage record");

      showToast("✅ Triage record deleted successfully");
      window.latestTriageRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete triage record");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/triage-records/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} triage record`);

      const label =
        action === "complete"
          ? "completed"
          : action === "void"
          ? "voided"
          : action;
      showToast(`✅ Triage record ${label} successfully`);
      window.latestTriageRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} triage record`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 GLOBAL HELPERS (Window-Level)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestTriageRecordEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("triage_records:view"))
      return showToast("⛔ No permission to view triage record");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Triage record not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("triage_records:edit"))
      return showToast("⛔ No permission to edit triage record");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Triage record not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("triage_records:delete"))
      return showToast("⛔ No permission to delete triage record");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  ["start", "complete", "verify", "cancel", "void"].forEach((action) => {
    window[`${action}Entry`] = async (id) => {
      if (!hasPerm(`triage_records:${action}`))
        return showToast(`⛔ No permission to ${action} triage record`);
      const entry = findEntry(id);
      await handleLifecycle(
        id,
        action,
        `Proceed to ${action} this triage record?`
      );
    };
  });
}
