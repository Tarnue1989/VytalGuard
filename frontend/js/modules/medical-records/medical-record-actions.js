// 📁 medical-record-actions.js – Full Permission-Driven Action Handlers (Upgraded)
// ==============================================================================
// 🧭 Master Pattern: Consultation (Enterprise-Aligned)
// Mirrors centralstock-actions.js & consultation-actions.js
// – Role-aware
// – Permission-normalized
// – Unified lifecycle handlers
// – Safe superadmin bypass
// ==============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./medical-record-render.js";

/**
 * Unified, permission-driven action handler for Medical Records
 */
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
  const tableBody = document.getElementById("medicalRecordTableBody");
  const cardContainer = document.getElementById("medicalRecordList");

  // Cache latest entries for global access
  window.latestMedicalRecordEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* -----------------------------------------------------------------------
     🔐 Normalize & Resolve Permissions
  ----------------------------------------------------------------------- */
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
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* -----------------------------------------------------------------------
     🎯 Unified Action Dispatcher
  ----------------------------------------------------------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestMedicalRecordEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // Fallback: fetch if missing
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/medical-records/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Medical record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Medical record data missing");
    const cls = btn.classList;

    // ---------- View ----------
    if (cls.contains("view-btn")) {
      if (!hasPerm("medical_records:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    // ---------- Edit ----------
    if (cls.contains("edit-btn")) {
      if (!hasPerm("medical_records:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // ---------- Delete ----------
    if (cls.contains("delete-btn")) {
      if (!hasPerm("medical_records:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    // ---------- Lifecycle ----------
    if (cls.contains("review-btn")) {
      if (!hasPerm("medical_records:review"))
        return showToast("⛔ No permission to review record");
      return await handleLifecycle(id, "review", "Review this medical record?");
    }

    if (cls.contains("finalize-btn")) {
      if (!hasPerm("medical_records:finalize"))
        return showToast("⛔ No permission to finalize record");
      return await handleLifecycle(
        id,
        "finalize",
        "Finalize this medical record?"
      );
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("medical_records:verify"))
        return showToast("⛔ No permission to verify record");
      return await handleLifecycle(id, "verify", "Verify this medical record?");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("medical_records:void"))
        return showToast("⛔ No permission to void record");
      return await handleLifecycle(
        id,
        "void",
        "Void this medical record? (Admin/Superadmin only)"
      );
    }

    if (cls.contains("restore-btn")) {
      if (!hasPerm("medical_records:restore"))
        return showToast("⛔ No permission to restore record");
      return await handleLifecycle(
        id,
        "restore",
        "Restore this medical record? (Admin/Superadmin only)"
      );
    }
  }

  /* -----------------------------------------------------------------------
     🧩 Individual Handlers
  ----------------------------------------------------------------------- */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Medical Record Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("medicalRecordEditId", entry.id);
    sessionStorage.setItem("medicalRecordEditPayload", JSON.stringify(entry));
    window.location.href = `add-medical-record.html`;
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm("Delete this medical record?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/medical-records/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete medical record");

      showToast("✅ Medical record deleted successfully");
      window.latestMedicalRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete medical record");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/medical-records/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} medical record`);

      showToast(`✅ Medical record ${action} successful`);
      window.latestMedicalRecordEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} medical record`);
    } finally {
      hideLoading();
    }
  }

  /* -----------------------------------------------------------------------
     🌍 Global Helper Bindings (for modals/buttons)
  ----------------------------------------------------------------------- */
  const findEntry = (id) =>
    (window.latestMedicalRecordEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("medical_records:view"))
      return showToast("⛔ No permission to view record");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Medical record not found");
  };

  window.editEntry = (id) => {
    if (!hasPerm("medical_records:edit"))
      return showToast("⛔ No permission to edit record");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Medical record not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("medical_records:delete"))
      return showToast("⛔ No permission to delete record");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  // Lifecycle globals (review → finalize → verify → void → restore)
  ["review", "finalize", "verify", "void", "restore"].forEach((action) => {
    window[`${action}Entry`] = async (id) => {
      if (!hasPerm(`medical_records:${action}`))
        return showToast(`⛔ No permission to ${action} record`);
      const entry = findEntry(id);
      await handleLifecycle(id, action, `Proceed to ${action} this record?`);
    };
  });
}
