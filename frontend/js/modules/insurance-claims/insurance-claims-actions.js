// 📦 insurance-claim-actions.js – Enterprise MASTER FINAL
// ============================================================================
// 🔹 Granular permissions (insurance_claims:*)
// 🔹 Event bind guard (prevents duplicate handlers)
// 🔹 Lifecycle permission mapping
// 🔹 Print support added
// 🔹 Fully MASTER aligned
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard } from "./insurance-claims-render.js";
import { printInsuranceClaimReceipt } from "./insurance-claim-receipt.js";

/* ============================================================
   🛡️ EVENT GUARD
============================================================ */
let insuranceClaimHandlersBound = false;

/**
 * Unified permission-aware action handler for Insurance Claim module
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
  if (insuranceClaimHandlersBound) return;
  insuranceClaimHandlersBound = true;

  const { currentEditIdRef } = sharedState || {};

  const tableBody = document.getElementById("insuranceClaimTableBody");
  const cardContainer = document.getElementById("insuranceClaimList");
  const modalBody = document.getElementById("viewModalBody");

  window.latestInsuranceClaimEntries = entries;

  tableBody?.addEventListener("click", handleActions);
  cardContainer?.addEventListener("click", handleActions);
  modalBody?.addEventListener("click", handleActions);

  /* ============================================================
     🔑 PERMISSIONS
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
     🎯 ACTION DISPATCHER
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestInsuranceClaimEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    /* ===== fallback fetch ===== */
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/insurance-claims/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Claim not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Claim data missing");

    const cls = btn.classList;

    /* ================= VIEW ================= */
    if (cls.contains("view-btn")) {
      if (!hasPerm("insurance_claims:view"))
        return showToast("⛔ No permission to view claims");
      return handleView(entry);
    }

    /* ================= EDIT ================= */
    if (cls.contains("edit-btn")) {
      if (!hasPerm("insurance_claims:edit"))
        return showToast("⛔ No permission to edit claims");
      return handleEdit(entry);
    }

    /* ================= DELETE ================= */
    if (cls.contains("delete-btn")) {
      if (!hasPerm("insurance_claims:delete"))
        return showToast("⛔ No permission to delete claims");
      return await handleDelete(id);
    }

    /* ================= PRINT ================= */
    if (cls.contains("print-btn")) {
      if (!hasPerm("insurance_claims:print"))
        return showToast("⛔ No permission to print claims");
      return handlePrint(entry);
    }

    /* ================= LIFECYCLE ================= */
    const lifecycleMap = {
      "submit-btn": "submit",
      "review-btn": "review",
      "approve-btn": "approve",
      "partial-btn": "partial-approve",
      "reject-btn": "reject",
      "process-btn": "process-payment",
      "paid-btn": "mark-paid",
      "reverse-btn": "reverse-payment",
    };

    const permMap = {
      submit: "insurance_claims:submit",
      review: "insurance_claims:review",
      approve: "insurance_claims:approve",
      "partial-approve": "insurance_claims:partial_approve",
      reject: "insurance_claims:reject",
      "process-payment": "insurance_claims:process_payment",
      "mark-paid": "insurance_claims:mark_paid",
      "reverse-payment": "insurance_claims:reverse_payment",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        const permKey = permMap[action];

        if (!hasPerm(permKey))
          return showToast(`⛔ No permission to ${action}`);

        return await handleLifecycle(id, action);
      }
    }
  }

  /* ============================================================
     ⚙️ HANDLERS
  ============================================================ */
  function handleView(entry) {
    openViewModal("Insurance Claim", renderCard(entry, visibleFields, user));
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;

    sessionStorage.setItem("insuranceClaimEditId", entry.id);
    window.location.href = "add-insurance-claims.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this claim?");
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/insurance-claims/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete claim");

      showToast("✅ Claim deleted");

      window.latestInsuranceClaimEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Delete failed");
    } finally {
      hideLoading();
    }
  }

  function handlePrint(entry) {
    try {
      printInsuranceClaimReceipt(entry);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to print claim");
    }
  }

  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(`Proceed to ${action}?`);
    if (!confirmed) return;

    const endpointMap = {
      submit: "submit",
      review: "review",
      approve: "approve",
      "partial-approve": "partial-approve",
      reject: "reject",
      "process-payment": "process-payment",
      "mark-paid": "mark-paid",
      "reverse-payment": "reverse-payment",
    };

    const url = `/api/insurance-claims/${id}/${endpointMap[action]}`;

    try {
      showLoading();

      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action}`);

      showToast(`✅ ${action} successful`);

      window.latestInsuranceClaimEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ ${action} failed`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 GLOBAL HELPERS
  ============================================================ */
  const findEntry = (id) =>
    (window.latestInsuranceClaimEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewInsuranceClaim = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editInsuranceClaim = (id) => {
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteInsuranceClaim = async (id) => {
    await handleDelete(id);
  };
}