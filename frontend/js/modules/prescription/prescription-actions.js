// 📁 prescription-actions.js
// ============================================================================
// 🧭 Enterprise MASTER–ALIGNED Action Handlers (Prescriptions)
// ----------------------------------------------------------------------------
// 🔹 Pattern Source: lab-request-actions.js (Enterprise MASTER)
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / delete / submit / activate / complete / verify / cancel / void
// 🔹 Safe fallback fetch + global helpers
// 🔹 100% API preservation (NO endpoint changes)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./prescription-render.js";

/**
 * Unified permission-aware action handler for Prescription module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("prescriptionTableBody");
  const cardContainer = document.getElementById("prescriptionList");

  // 🗂️ Cache latest entries
  window.latestPrescriptionEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER PATTERN)
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
      String(p).toLowerCase().trim()
    )
  );

  // 🧠 Superadmin bypass (MASTER PATTERN)
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestPrescriptionEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER SAFETY NET)
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/prescriptions/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Prescription not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Prescription data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("prescriptions:view"))
        return showToast("⛔ You don't have permission to view prescriptions");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("prescriptions:edit"))
        return showToast("⛔ You don't have permission to edit prescriptions");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("prescriptions:delete"))
        return showToast("⛔ You don't have permission to delete prescriptions");
      return await handleDelete(id, entry);
    }

    if (cls.contains("submit-btn")) {
      if (!hasPerm("prescriptions:submit"))
        return showToast("⛔ No permission to submit prescription");
      return await handleLifecycle(id, "submit", "Submit this prescription?");
    }

    if (cls.contains("activate-btn")) {
      if (!hasPerm("prescriptions:activate"))
        return showToast("⛔ No permission to activate prescription");
      return await handleLifecycle(id, "activate", "Activate this prescription?");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("prescriptions:complete"))
        return showToast("⛔ No permission to complete prescription");
      return await handleLifecycle(
        id,
        "complete",
        "Mark this prescription as completed?"
      );
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("prescriptions:verify"))
        return showToast("⛔ No permission to verify prescription");
      return await handleLifecycle(id, "verify", "Verify this prescription?");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("prescriptions:cancel"))
        return showToast("⛔ No permission to cancel prescription");
      return await handleLifecycle(
        id,
        "cancel",
        "Cancel this prescription?"
      );
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("prescriptions:void"))
        return showToast("⛔ No permission to void prescription");
      return await handleLifecycle(
        id,
        "void",
        "Void this prescription? (Admin/Superadmin only)"
      );
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Prescription Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("prescriptionEditId", entry.id);
    sessionStorage.setItem("prescriptionEditPayload", JSON.stringify(entry));
    window.location.href = "add-prescription.html";
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete prescription for patient "${entry?.patient?.first_name || ""}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/prescriptions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete prescription");

      showToast("✅ Prescription deleted successfully");
      window.latestPrescriptionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete prescription");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/prescriptions/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} prescription`);

      showToast(`✅ Prescription ${action} successful`);
      window.latestPrescriptionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} prescription`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestPrescriptionEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  // 🔹 Master-style helpers
  window.viewPrescription = (id) => {
    if (!hasPerm("prescriptions:view"))
      return showToast("⛔ No permission to view prescriptions");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editPrescription = (id) => {
    if (!hasPerm("prescriptions:edit"))
      return showToast("⛔ No permission to edit prescriptions");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deletePrescription = async (id) => {
    if (!hasPerm("prescriptions:delete"))
      return showToast("⛔ No permission to delete prescriptions");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  ["submit", "activate", "complete", "verify", "cancel", "void"].forEach(
    (action) => {
      window[`${action}Prescription`] = async (id) => {
        if (!hasPerm(`prescriptions:${action}`))
          return showToast(`⛔ No permission to ${action} prescription`);
        await handleLifecycle(
          id,
          action,
          `Proceed to ${action} this prescription?`
        );
      };
    }
  );

  // 🔹 Backward compatibility
  window.viewEntry = window.viewPrescription;
  window.editEntry = window.editPrescription;
  window.deleteEntry = window.deletePrescription;
  window.submitEntry = window.submitPrescription;
  window.activateEntry = window.activatePrescription;
  window.completeEntry = window.completePrescription;
  window.verifyEntry = window.verifyPrescription;
  window.cancelEntry = window.cancelPrescription;
  window.voidEntry = window.voidPrescription;
}