// 📦 surgery-main.js – Enterprise Role-Aware Add/Edit Controller (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors centralstock-main.js for secure, consistent lifecycle & UI flow
// 🔹 Keeps all existing IDs and working bindings intact
// ============================================================================

import { setupSurgeryFormSubmission } from "./surgery-form.js";
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
  loadBillableItemsLite,
  loadDepartmentsLite,
  loadConsultationsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – automatically resolves correct permission (add/edit)
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference for consistent module handling
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("surgeryForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  ["patientId", "surgeonId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organizationSelect", "facilitySelect", "billableItemSelect", "departmentSelect", "consultationSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Surgery";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Surgery`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("surgeryForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const billableSelect = document.getElementById("billableItemSelect");
  const deptSelect = document.getElementById("departmentSelect");
  const consultationSelect = document.getElementById("consultationSelect");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🏢 Organization & Facility Preload (Role-Aware)
  ============================================================ */
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
    } else if (userRole.includes("facilityhead") || userRole.includes("orgowner")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* ============================================================
     💰 Billable Items + Departments
  ============================================================ */
  try {
    const billables = await loadBillableItemsLite({ category: "surgery" }, true);
    setupSelectOptions(billableSelect, billables, "id", "name", "-- Select Surgery Type --");
  } catch (err) {
    console.error("❌ Billable items preload failed:", err);
  }

  try {
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
  } catch (err) {
    console.error("❌ Departments preload failed:", err);
  }

  /* ============================================================
     🧠 Patient & Surgeon Suggestions
  ============================================================ */
  async function reloadConsultations(patientId) {
    if (!consultationSelect) return;
    if (!patientId) {
      setupSelectOptions(consultationSelect, [], "id", "g_code", "-- Select Consultation --");
      return;
    }
    try {
      const records = await loadConsultationsLite({
        patient_id: patientId,
        status: "open,in_progress",
      });
      setupSelectOptions(consultationSelect, records, "id", "g_code", "-- Select Consultation --");
    } catch (err) {
      console.error("❌ Consultations preload failed:", err);
      showToast("❌ Could not load consultations");
    }
  }

  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    async (selected) => {
      document.getElementById("patientId").value = selected?.id || "";
      const input = document.getElementById("patientInput");
      input.value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");
      await reloadConsultations(selected?.id || null);
    },
    "label"
  );

  setupSuggestionInputDynamic(
    document.getElementById("surgeonInput"),
    document.getElementById("surgeonSuggestions"),
    "/api/lite/employees",
    (selected) => {
      document.getElementById("surgeonId").value = selected?.id || "";
      document.getElementById("surgeonInput").value =
        selected?.full_name ||
        `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
    },
    "full_name"
  );

  /* ============================================================
     🧩 Form Setup & Submission
  ============================================================ */
  setupSurgeryFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Handling
  ============================================================ */
  const editId = sessionStorage.getItem("surgeryEditId");
  const rawPayload = sessionStorage.getItem("surgeryEditPayload");

  async function applyPrefill(entry) {
    // Patient
    if (entry.patient?.id) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value =
        (entry.patient.pat_no ? entry.patient.pat_no + " - " : "") +
        [entry.patient.first_name, entry.patient.last_name].filter(Boolean).join(" ");
      await reloadConsultations(entry.patient.id);
    }

    // Surgeon
    if (entry.surgeon?.id) {
      document.getElementById("surgeonId").value = entry.surgeon.id;
      document.getElementById("surgeonInput").value =
        [entry.surgeon.first_name, entry.surgeon.last_name].filter(Boolean).join(" ");
    }

    // Consultation
    if (entry.consultation?.id) consultationSelect.value = entry.consultation.id;

    // Other fields
    document.getElementById("scheduledDate").value =
      entry.scheduled_date ? entry.scheduled_date.split("T")[0] : "";
    document.getElementById("durationMinutes").value = entry.duration_minutes || "";
    document.getElementById("anesthesiaType").value = entry.anesthesia_type || "";
    document.getElementById("complications").value = entry.complications || "";
    document.getElementById("notes").value = entry.notes || "";
    document.getElementById("isEmergency").checked = entry.is_emergency || false;

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      if (userRole.includes("super")) await loadFacilitiesLite({ organization_id: entry.organization.id }, true);
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.billableItem?.id && billableSelect) billableSelect.value = entry.billableItem.id;
    if (entry.department?.id && deptSelect) deptSelect.value = entry.department.id;

    // Update UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Surgery";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Surgery`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached surgery edit:", err);
      showToast("❌ Could not load cached surgery for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/surgeries/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch surgery");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load surgery entry:", err);
        showToast(err.message || "❌ Failed to load surgery for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("surgeryEditId");
    sessionStorage.removeItem("surgeryEditPayload");
    window.location.href = "/surgeries-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("surgeryEditId");
    sessionStorage.removeItem("surgeryEditPayload");
    resetForm();
  });
});
