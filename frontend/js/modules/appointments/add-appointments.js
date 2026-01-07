// 📁 add-appointment.js – Init Add/Edit mode for add-appointment.html

import { setupAppointmentFormSubmission } from "./appointments-form.js";
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
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – automatically detect permission ("appointments:create" or "appointments:edit")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// 🔁 Shared state for cross-module operations
const sharedState = {
  currentEditIdRef: { value: null },
};

// 🧹 Reset form helper → back to Add mode
function resetForm() {
  const form = document.getElementById("appointmentForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  ["patientId", "doctorId", "organizationSelect", "facilitySelect", "departmentSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Appointment";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Appointment`;
}

/* ============================================================
   🚀 Init
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("appointmentForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organizations --------------------- */
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

  /* --------------------- Facilities --------------------- */
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
    // Facility head / doctor / staff → hide facility field
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* --------------------- Departments --------------------- */
  try {
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
  } catch (err) {
    console.error("❌ Departments preload failed", err);
    showToast("❌ Could not load departments");
  }

  /* --------------------- Patient Suggestion --------------------- */
  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    (selected) => {
      document.getElementById("patientId").value = selected?.id || "";
      const input = document.getElementById("patientInput");
      input.value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");
    },
    "label"
  );

  /* --------------------- Doctor Suggestion --------------------- */
  setupSuggestionInputDynamic(
    document.getElementById("doctorInput"),
    document.getElementById("doctorSuggestions"),
    "/api/lite/employees",
    (selected) => {
      document.getElementById("doctorId").value = selected?.id || "";
      document.getElementById("doctorInput").value =
        selected?.full_name ||
        `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
    },
    "full_name"
  );

  /* --------------------- Form Submission --------------------- */
  setupAppointmentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* --------------------- Edit Mode --------------------- */
  const editId = sessionStorage.getItem("appointmentEditId");
  const rawPayload = sessionStorage.getItem("appointmentEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("dateTime").value = entry.date_time
      ? entry.date_time.split("Z")[0]
      : "";
    document.getElementById("notes").value = entry.notes || "";

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      await reloadFacilities(entry.organization.id);
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.department?.id && deptSelect) deptSelect.value = entry.department.id;

    if (entry.patient) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value =
        entry.patient.label ||
        (entry.patient.pat_no && entry.patient.full_name
          ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
          : entry.patient.full_name || entry.patient.pat_no || "");
    }

    if (entry.doctor) {
      document.getElementById("doctorId").value = entry.doctor.id;
      document.getElementById("doctorInput").value =
        entry.doctor.full_name ||
        `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();
    }

    // Update UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Appointment";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Appointment`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached appointment for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/appointments/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch appointment");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load appointment:", err);
        showToast(err.message || "❌ Failed to load appointment for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* --------------------- Cancel & Clear --------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("appointmentEditId");
    sessionStorage.removeItem("appointmentEditPayload");
    window.location.href = "/appointments-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("appointmentEditId");
    sessionStorage.removeItem("appointmentEditPayload");
    resetForm();
  });
});
