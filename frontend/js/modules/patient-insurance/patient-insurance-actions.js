// 📦 patient-insurance-actions.js – Enterprise MASTER–ALIGNED (Patient Insurance Parity)
// ============================================================================
// 🔹 Converted from: insurance-claim-actions.js
// 🔹 Aligned to patientInsuranceController + routes
// 🔹 Permission-driven + superadmin-aware
// 🔹 FIXED: toggle-status button class
// 🔹 Safe fetch fallback preserved
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./patient-insurance-render.js";
import { printPatientInsuranceReceipt } from "./patient-insurance-receipt.js";

/**
 * Unified permission-aware action handler for Patient Insurance module
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
  const tableBody = document.getElementById("patientInsuranceTableBody");
  const cardContainer = document.getElementById("patientInsuranceList");
  const modalBody = document.getElementById("viewModalBody");

  window.latestPatientInsuranceEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Permissions
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

  const isSuperAdmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.roleNames?.some((r) => r.toLowerCase() === "superadmin");

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase());

  /* ============================================================
     🎯 Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestPatientInsuranceEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/patient-insurances/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Data missing");

    const cls = btn.classList;

    /* ================= VIEW ================= */
    if (cls.contains("view-btn")) {
      if (!hasPerm("patient_insurances:view"))
        return showToast("⛔ No permission to view");
      return handleView(entry);
    }

    /* ================= EDIT ================= */
    if (cls.contains("edit-btn")) {
      if (!hasPerm("patient_insurances:edit"))
        return showToast("⛔ No permission to edit");
      return handleEdit(entry);
    }

    /* ================= PRINT (ADDED) ================= */
    if (cls.contains("print-btn")) {
      if (!hasPerm("patient_insurances:print"))
        return showToast("⛔ No permission to print");
      return handlePrint(entry);
    }

    /* ================= DELETE ================= */
    if (cls.contains("delete-btn")) {
      if (!hasPerm("patient_insurances:delete"))
        return showToast("⛔ No permission to delete");
      return await handleDelete(id);
    }

    /* ================= TOGGLE STATUS ================= */
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("patient_insurances:toggle_status"))
        return showToast("⛔ No permission to update status");
      return await handleToggleStatus(id);
    }
  }

  /* ============================================================
     ⚙️ Handlers
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Patient Insurance", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("patientInsuranceEditId", entry.id);
    window.location.href = "add-patient-insurance.html";
  }

  function handlePrint(entry) {
    printPatientInsuranceReceipt(entry);
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this record?");
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/patient-insurances/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete");

      showToast("✅ Deleted successfully");

      window.latestPatientInsuranceEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Delete failed");
    } finally {
      hideLoading();
    }
  }

  async function handleToggleStatus(id) {
    const confirmed = await showConfirm("Toggle status?");
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(
        `/api/patient-insurances/${id}/toggle-status`,
        { method: "PATCH" }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle status");

      showToast("✅ Status updated");

      window.latestPatientInsuranceEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Update failed");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global helpers
  ============================================================ */

  const findEntry = (id) =>
    (window.latestPatientInsuranceEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewPatientInsurance = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editPatientInsurance = (id) => {
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deletePatientInsurance = async (id) => {
    await handleDelete(id);
  };

  window.togglePatientInsuranceStatus = async (id) => {
    await handleToggleStatus(id);
  };
}