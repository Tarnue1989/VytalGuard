// 📦 consultation-main.js – Consultation Form (Add/Edit) Page Controller (master-aligned)

import {
  setupConsultationFormSubmission,
} from "./consultation-form.js";

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
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – automatically resolve correct permission (add/edit)
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference for consistent module handling
const sharedState = {
  currentEditIdRef: { value: null },
};

// 🧹 Reset form helper → back to Add mode
function resetForm() {
  const form = document.getElementById("consultationForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  ["patientId", "doctorId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "consultationTypeSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset appointment list
  const appointmentSelect = document.getElementById("appointmentSelect");
  if (appointmentSelect)
    appointmentSelect.innerHTML = `<option value="">— Select Appointment —</option>`;

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Consultation";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Consultation`;
}

/* ============================================================
   🚀 Main Init
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("consultationForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const typeSelect = document.getElementById("consultationTypeSelect");
  const appointmentSelect = document.getElementById("appointmentSelect");
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
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
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
    console.error("❌ Departments preload failed:", err);
  }

  /* --------------------- Consultation Types --------------------- */
  try {
    const consTypes = await loadBillableItemsLite({ category: "consultation" }, true);
    setupSelectOptions(typeSelect, consTypes, "id", "name", "-- Select Consultation Type --");
  } catch (err) {
    console.error("❌ Consultation types preload failed:", err);
  }

  /* -------------------- Patient & Doctor Suggestions -------------------- */
  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    async (selected) => {
      const patientIdEl = document.getElementById("patientId");
      const patientInput = document.getElementById("patientInput");
      if (!patientIdEl || !patientInput) return;

      patientIdEl.value = selected?.id || "";
      patientInput.value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");

      // 🔹 Load appointments for this patient
      if (appointmentSelect) {
        appointmentSelect.innerHTML = `<option value="">— Loading... —</option>`;
        try {
          const res = await authFetch(`/api/lite/appointments?patient_id=${selected.id}`);
          const data = await res.json().catch(() => ({}));
          const appts = data?.data?.records || [];

          if (!appts.length) {
            appointmentSelect.innerHTML = `<option value="">— No appointments —</option>`;
          } else {
            appointmentSelect.innerHTML = `<option value="">— Select Appointment —</option>`;
            appts.forEach((a) => {
              const formattedTime = a.date
                ? new Date(a.date).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              appointmentSelect.innerHTML += `
                <option value="${a.id}">
                  ${a.code || a.id} — ${formattedTime} (${a.status})
                </option>`;
            });
          }
        } catch (err) {
          console.error("❌ Failed to load appointments:", err);
          appointmentSelect.innerHTML = `<option value="">— Error loading —</option>`;
        }
      }
    },
    "label"
  );

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

  /* -------------------- Form setup & submission -------------------- */
  setupConsultationFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* --------------------------- Edit Mode --------------------------- */
  const editId = sessionStorage.getItem("consultationEditId");
  const rawPayload = sessionStorage.getItem("consultationEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("consultationDate").value =
      entry.consultation_date?.split("T")[0] || "";
    document.getElementById("diagnosis").value = entry.diagnosis || "";
    document.getElementById("consultationNotes").value =
      entry.consultation_notes || "";
    document.getElementById("prescribedMedications").value =
      entry.prescribed_medications || "";

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      const facs = await loadFacilitiesLite(
        { organization_id: entry.organization.id },
        true
      );
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }

    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.department?.id && deptSelect) deptSelect.value = entry.department.id;
    if (entry.consultationType?.id && typeSelect) typeSelect.value = entry.consultationType.id;

    // 🧠 Patient
    if (entry.patient) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value =
        entry.patient.label ||
        (entry.patient.pat_no && entry.patient.full_name
          ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
          : entry.patient.full_name || entry.patient.pat_no || "");

      // Prefill appointments
      try {
        const res = await authFetch(`/api/lite/appointments?patient_id=${entry.patient.id}`);
        const data = await res.json().catch(() => ({}));
        const appts = data?.data?.records || [];
        appointmentSelect.innerHTML = `<option value="">— Select Appointment —</option>`;
        appts.forEach((a) => {
          const formattedTime = a.date
            ? new Date(a.date).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          appointmentSelect.innerHTML += `
            <option value="${a.id}" ${
            entry.appointment?.id === a.id ? "selected" : ""
          }>
              ${a.code || a.id} — ${formattedTime} (${a.status})
            </option>`;
        });
      } catch (err) {
        console.error("❌ Prefill appointments failed", err);
      }
    }

    // 🧠 Doctor
    if (entry.doctor) {
      document.getElementById("doctorId").value = entry.doctor.id;
      document.getElementById("doctorInput").value =
        entry.doctor.full_name ||
        `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();
    }

    // Switch to edit mode UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Consultation";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Consultation`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached consultation for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/consultations/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch consultation");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load consultation:", err);
        showToast(err.message || "❌ Failed to load consultation for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ------------------------- Cancel & Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("consultationEditId");
    sessionStorage.removeItem("consultationEditPayload");
    window.location.href = "/consultations-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("consultationEditId");
    sessionStorage.removeItem("consultationEditPayload");
    resetForm();
  });
});
