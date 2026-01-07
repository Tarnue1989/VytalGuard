// 📁 add-refund.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors add-deposit.js for unified lifecycle & RBAC consistency
// 🔹 Maintains all refund-specific IDs, logic, and API endpoints intact
// 🔹 Adds role-aware organization/facility cascade, tooltips, and safe guards
// ============================================================================

import { setupRefundFormSubmission } from "./refund-form.js";
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
  loadPaymentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Session Watch
============================================================ */
const token = initPageGuard(autoPagePermissionKey(["refunds:create", "refunds:edit"]));
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
  const form = document.getElementById("refundForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  ["patientId", "organizationSelect", "facilitySelect", "paymentSelect", "invoiceId"]
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Refund";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Refund`;
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("refundForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const paymentSelect = document.getElementById("paymentSelect");
  const invoiceHidden = document.getElementById("invoiceId");
  const amountInput = document.getElementById("amount");
  const methodSelect = document.getElementById("methodSelect");
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
    await reloadFacilities(); // Admins see their scoped facilities
  } else {
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     👥 Patient Suggestion + Payment Fetch
  ============================================================ */
  setupSuggestionInputDynamic(
    patientInput,
    patientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      patientHidden.value = selected?.id || "";

      if (selected) {
        patientInput.value =
          selected.label ||
          `${selected.pat_no || ""} ${selected.full_name || ""}`.trim();

        try {
          // 🔥 Load REAL payments with REAL refundable balances
          const payments = await loadPaymentsLite({
            patient_id: selected.id,
            status: "completed",
            is_deposit: "false",
          });

          setupSelectOptions(paymentSelect, payments, "id", "label", "-- Select Payment --");

          /* ============================================================
             🔥 ON PAYMENT CHANGE – always use real refundable_balance
          ============================================================ */
          paymentSelect.onchange = () => {
            const chosen = payments.find((p) => p.id === paymentSelect.value);
            if (chosen) {
              invoiceHidden.value = chosen.invoice_id || "";
              methodSelect.value = chosen.method || "";

              // 🚀 ALWAYS use true backend-provided refundable_balance
              const balance = Number(chosen.refundable_balance);

              amountInput.value = balance.toFixed(2);
              amountInput.max = balance.toFixed(2);
            } else {
              invoiceHidden.value = "";
              methodSelect.value = "";
              amountInput.value = "";
              amountInput.removeAttribute("max");
            }
          };
        } catch (err) {
          console.error("❌ Payments load failed", err);
          setupSelectOptions(paymentSelect, [], "id", "label", "-- Select Payment --");
        }
      } else {
        setupSelectOptions(paymentSelect, [], "id", "label", "-- Select Payment --");
        invoiceHidden.value = "";
        methodSelect.value = "";
        amountInput.value = "";
        amountInput.removeAttribute("max");
      }
    },
    "label"
  );

  /* ============================================================
     💾 Integrate Form Submission Logic
  ============================================================ */
  setupRefundFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("refundEditId");
  const rawPayload = sessionStorage.getItem("refundEditPayload");

  async function applyPrefill(entry) {
    const amountEl = document.getElementById("amount");
    const methodEl = document.getElementById("methodSelect");
    const reasonEl = document.getElementById("reason");

    if (amountEl) amountEl.value = entry.amount || "";
    if (methodEl) methodEl.value = entry.method || "";
    if (reasonEl && entry.reason) reasonEl.value = entry.reason;

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

      const payments = await loadPaymentsLite({
        patient_id: entry.patient.id,
        status: "completed",
        is_deposit: "false",
      });

      setupSelectOptions(paymentSelect, payments, "id", "label", "-- Select Payment --");

      if (entry.payment) {
        paymentSelect.value = entry.payment.id;
        if (entry.payment?.invoice_id) invoiceHidden.value = entry.payment.invoice_id;
      }
    }

    if (entry.invoice_id) invoiceHidden.value = entry.invoice_id;

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Refund";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Refund`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached refund for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/refunds/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch refund");

        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load refund:", err);
        showToast(err.message || "❌ Failed to load refund for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("refundEditId");
    sessionStorage.removeItem("refundEditPayload");
    window.location.href = "/refunds-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("refundEditId");
    sessionStorage.removeItem("refundEditPayload");

    resetForm();

    // 🔥 FIX: Completely clear payment dropdown options
    const paymentSelect = document.getElementById("paymentSelect");
    if (paymentSelect) {
      paymentSelect.innerHTML = `<option value="">-- Select Payment --</option>`;
    }

    // 🔥 FIX: Clear invoice reference
    const invoiceHidden = document.getElementById("invoiceId");
    if (invoiceHidden) invoiceHidden.value = "";

    // 🔥 FIX: Remove max limit on amount (so stale balance isn't enforced)
    const amountInput = document.getElementById("amount");
    if (amountInput) amountInput.removeAttribute("max");

    // Also reset method select
    const methodSelect = document.getElementById("methodSelect");
    if (methodSelect) methodSelect.value = "";
  });

});
