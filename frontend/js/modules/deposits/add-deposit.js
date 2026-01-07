// 📁 add-deposit.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors add-appointment.js for unified lifecycle & RBAC consistency
// 🔹 Maintains all deposit-specific IDs, logic, and API endpoints intact
// 🔹 Adds role-aware organization/facility cascade, tooltips, and safe guards
// ============================================================================

import { setupDepositFormSubmission } from "./deposit-form.js";
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
const token = initPageGuard(autoPagePermissionKey(["deposits:create", "deposits:edit"]));
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
  const form = document.getElementById("depositForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  ["patientId", "organizationSelect", "facilitySelect", "appliedInvoiceId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Deposit";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Deposit`;

  // Hide reason field on add
  document.getElementById("reason")?.closest(".form-group")?.classList.add("hidden");
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("depositForm");
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
    await reloadFacilities(); // Admins see their scoped facilities
  } else {
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* ============================================================
     👥 Patient Suggestion
  ============================================================ */
  setupSuggestionInputDynamic(
    patientInput,
    patientSuggestions,
    "/api/lite/patients",
    (selected) => {
      patientHidden.value = selected?.id || "";
      patientInput.value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");
    },
    "label"
  );

  /* ============================================================
     💾 Form Submission Integration
  ============================================================ */
  setupDepositFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Prefill
  ============================================================ */
  const editId = sessionStorage.getItem("depositEditId");
  const rawPayload = sessionStorage.getItem("depositEditPayload");

  async function applyPrefill(entry) {
    const amountEl = document.getElementById("amount");
    const methodEl = document.getElementById("methodSelect");
    const refEl = document.getElementById("transactionRef");
    const notesEl = document.getElementById("notes");
    const reasonEl = document.getElementById("reason");
    const invoiceEl = document.getElementById("appliedInvoiceId");

    // Populate values
    if (amountEl) amountEl.value = entry.amount || "";
    if (methodEl) methodEl.value = entry.method || "";
    if (refEl) refEl.value = entry.transaction_ref || "";
    if (notesEl) notesEl.value = entry.notes || "";
    if (reasonEl) reasonEl.value = entry.reason || "";
    if (invoiceEl && entry.applied_invoice_id) invoiceEl.value = entry.applied_invoice_id;

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

    // Show reason on edit
    reasonEl?.closest(".form-group")?.classList.remove("hidden");

    // Update UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Deposit";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Deposit`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached deposit for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/deposits/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch deposit");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load deposit:", err);
        showToast(err.message || "❌ Failed to load deposit for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel & Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("depositEditId");
    sessionStorage.removeItem("depositEditPayload");
    window.location.href = "/deposits-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("depositEditId");
    sessionStorage.removeItem("depositEditPayload");
    resetForm();
  });
});
