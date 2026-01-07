// 📁 add-payment.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors add-deposit.js for unified lifecycle & RBAC consistency
// 🔹 Maintains all payment-specific IDs, logic, and API endpoints intact
// 🔹 Adds role-aware org/facility cascade, patient suggestion, and edit prefill
// ============================================================================

import { setupPaymentFormSubmission } from "./payment-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Session Watch
============================================================ */
const token = initPageGuard(autoPagePermissionKey(["payments:create", "payments:edit"]));
initLogoutWatcher();

/* ============================================================
   🧩 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("paymentForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  ["patientId", "invoiceSelect", "organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Payment";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Payment`;

  document.getElementById("reasonGroup")?.classList.add("hidden");
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("paymentForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🏢 Organizations
  ============================================================ */
  if (userRole.includes("super")) {
    try {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
    } catch (err) {
      console.error("❌ Organizations preload failed", err);
      showToast("❌ Could not load organizations");
    }
  } else {
    orgSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     🏭 Facilities
  ============================================================ */
  async function reloadFacilities(orgId = null) {
    try {
      const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } catch (err) {
      console.error("❌ Facilities preload failed", err);
      showToast("❌ Could not load facilities");
    }
  }

  if (userRole.includes("super")) {
    orgSelect?.addEventListener("change", async () => {
      await reloadFacilities(orgSelect.value || null);
    });
  } else if (userRole.includes("admin")) {
    await reloadFacilities();
  } else {
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
    👥 Patient Suggestion (UPDATED to also load invoices)
  ============================================================ */
  setupSuggestionInputDynamic(
    patientInput,
    patientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      patientHidden.value = selected?.id || "";
      patientInput.value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");

      // 🔥 NEW: Load invoices for this patient
      const invoiceSelect = document.getElementById("invoiceSelect");
      if (selected?.id && invoiceSelect) {
        try {
          const res = await authFetch(`/api/lite/invoices?patient_id=${selected.id}`);
          const data = await res.json().catch(() => ({}));
          const invoices = data?.data?.records || [];

          const opts = invoices.map((inv) => ({
            id: inv.id,
            label: `${inv.invoice_number} | ${inv.status} | Balance: ${inv.balance}`,
            balance: inv.balance,
          }));

          setupSelectOptions(invoiceSelect, opts, "id", "label", "-- Select Invoice --");

        } catch (err) {
          console.error("❌ Failed loading invoices:", err);
          showToast("❌ Could not load invoices for selected patient");
        }
      }
    },
    "label"
  );


  /* ============================================================
     💾 Form Submission Integration
  ============================================================ */
  setupPaymentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("paymentEditId");
  const rawPayload = sessionStorage.getItem("paymentEditPayload");

  async function applyPrefill(entry) {
    const amountEl = document.getElementById("amount");
    const methodEl = document.getElementById("methodSelect");
    const refEl = document.getElementById("transactionRef");
    const reasonEl = document.getElementById("reason");
    const isDepEl = document.getElementById("isDeposit");
    const invoiceEl = document.getElementById("invoiceSelect");

    if (amountEl) amountEl.value = entry.amount || "";
    if (methodEl) methodEl.value = entry.method || "";
    if (refEl) refEl.value = entry.transaction_ref || "";
    if (isDepEl) isDepEl.checked = !!entry.is_deposit;
    if (reasonEl) reasonEl.value = entry.reason || "";

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      await reloadFacilities(entry.organization.id);
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;

    if (entry.patient) {
      patientHidden.value = entry.patient.id;
      patientInput.value =
        entry.patient.label ||
        `${entry.patient.pat_no || ""} - ${entry.patient.full_name || ""}`.trim();
    }

    if (entry.invoice) invoiceEl.value = entry.invoice.id;

    document.querySelector(".card-title").textContent = "Edit Payment";
    form.querySelector("button[type=submit]").innerHTML =
      `<i class="ri-save-3-line me-1"></i> Update Payment`;
    document.getElementById("reasonGroup")?.classList.remove("hidden");
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached payment for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/payments/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch payment");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load payment:", err);
        showToast(err.message || "❌ Failed to load payment for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("paymentEditId");
    sessionStorage.removeItem("paymentEditPayload");
    window.location.href = "/payments-list.html";
  });
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("paymentEditId");
    sessionStorage.removeItem("paymentEditPayload");
    resetForm();
  });
});
