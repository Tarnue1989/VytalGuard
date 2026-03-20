// 📁 prescription-main.js – Add/Edit Prescriptions (Enterprise-Aligned Master Pattern)
// ============================================================
// 🧭 Fully aligned with Lab Request Master Module
// ============================================================

import {
  setupPrescriptionFormSubmission,
  getPrescriptionFormState,
} from "./prescription-form.js";

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
  loadDepartmentsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard – Secure Session
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference for consistent module handling
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper → Safe Default
============================================================ */
function resetForm() {
  const form = document.getElementById("prescriptionForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset suggestion datasets
  [
    "patientSearch",
    "doctorSearch",
    "consultationSearch",
    "registrationLogSearch",
    "medicationSearch",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.dataset.value = "";
  });

  // Reset dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset pills container
  const pillsContainer = document.getElementById("prescriptionPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML = `<p class="text-muted">No prescription items added yet.</p>`;

  // Reset UI state
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Prescription";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit Prescription`;
}

/* ============================================================
   🚀 Main Init (DOM Ready)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("prescriptionForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organization & Facility --------------------- */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      orgSelect?.addEventListener("change", async () => {
        const orgId = orgSelect.value;
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      });

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* --------------------------- Departments --------------------------- */
  try {
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
  } catch (err) {
    console.error("❌ Department preload failed:", err);
    showToast("❌ Failed to load departments");
  }

  /* -------------------- Form Setup & Submission -------------------- */
  setupPrescriptionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* --------------------------- Edit Mode --------------------------- */
  const editId = sessionStorage.getItem("prescriptionEditId");
  const rawPayload = sessionStorage.getItem("prescriptionEditPayload");

  async function applyPrefill(entry) {
    const { selectedItems, renderItemPills } = getPrescriptionFormState();

    // Clear and refill pills
    selectedItems.length = 0;
    (entry.items || []).forEach((i) => {
      selectedItems.push({
        id: i.id,
        billable_item_id: i.billable_item_id,
        medication_name: i.billableItem?.name || "",
        dosage: i.dosage || "",
        route: i.route || "",
        duration: i.duration || "",
        quantity: i.quantity || "",
        instructions: i.instructions || "",
        notes: i.notes || "",
      });
    });
    renderItemPills();

    // Prefill inputs
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };
    const setChk = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    };

    setVal("prescription_date", normalizeDate(entry.prescription_date) || normalizeDate(new Date()));
    setVal("notes", entry.notes || "");
    setChk("is_emergency", entry.is_emergency);

    // Patient, Doctor, Consultation, Registration Log
    const mapInput = (id, datasetVal, displayVal) => {
      const el = document.getElementById(id);
      if (el) {
        el.dataset.value = datasetVal || "";
        el.value = displayVal || "";
      }
    };

    mapInput(
      "patientSearch",
      entry.patient_id,
      entry.patient?.label ||
        `${entry.patient?.pat_no || ""} - ${entry.patient?.full_name || ""}`
    );
    mapInput(
      "doctorSearch",
      entry.doctor_id,
      entry.doctor?.label || entry.doctor?.full_name || ""
    );
    mapInput(
      "consultationSearch",
      entry.consultation_id,
      entry.consultation?.label ||
        (entry.consultation ? `Consultation #${entry.consultation.id}` : "")
    );
    mapInput(
      "registrationLogSearch",
      entry.registration_log_id,
      entry.registrationLog?.label ||
        (entry.registrationLog ? `#${entry.registrationLog.id}` : "")
    );

    // Org / Facility / Department
    if (userRole.includes("super") && entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      const facs = await loadFacilitiesLite(
        { organization_id: entry.organization.id },
        true
      );
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }
    if ((userRole.includes("super") || userRole.includes("admin")) && entry.facility?.id)
      facSelect.value = entry.facility.id;
    if (entry.department?.id && deptSelect) deptSelect.value = entry.department.id;

    // Update UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Prescription";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Prescription`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached prescription for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/prescriptions/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch prescription");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load prescription:", err);
        showToast(err.message || "❌ Failed to load prescription for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("prescriptionEditId");
    sessionStorage.removeItem("prescriptionEditPayload");
    window.location.href = "/prescriptions-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("prescriptionEditId");
    sessionStorage.removeItem("prescriptionEditPayload");
    resetForm();
  });
});

/* ============================================================
   🧭 Helper: Normalize Date (Enterprise Consistent)
============================================================ */
function normalizeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
