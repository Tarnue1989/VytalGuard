// 📁 add-recommendation.js – Init edit mode on add-recommendation.html

import { setupRecommendationFormSubmission } from "./recommendation-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
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

// 🔐 Auth Guard – driven by backend permissions
const token = initPageGuard("recommendations");
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

// 🧹 Reset form helper → back to Add mode
function resetForm() {
  const form = document.getElementById("recommendationForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  // reset hidden IDs
  ["patientId", "doctorId", "consultationId"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  document.querySelector(".card-title").textContent = "Add Recommendation";
  form.querySelector("button[type=submit]").innerHTML =
    `<i class="ri-add-line me-1"></i> Create Recommendation`;
}

// 🚀 Init
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("recommendationForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");

  // Role normalization
  const roleRaw = (localStorage.getItem("userRole") || "").toLowerCase();
  let role = "staff";
  if (roleRaw.includes("super") && roleRaw.includes("admin")) role = "superadmin";
  else if (roleRaw.includes("admin")) role = "admin";

  // Doctor & consultation groups
  const doctorFieldGroup = document.getElementById("doctorFieldGroup");
  const consultationFieldGroup = document.getElementById("consultationFieldGroup");

  // ✅ Facilities reload with cascade
  async function reloadFacilities(orgId = null) {
    facSelect.innerHTML = `<option value="">-- Select Facility --</option>`;
    if (!orgId) return; // ⛔ don’t load all facilities without org
    try {
      const facs = await loadFacilitiesLite({ organization_id: orgId }, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } catch (err) {
      console.error("❌ Facilities preload failed", err);
      showToast("❌ Could not load facilities");
    }
  }

  // ✅ Organizations (superadmins only → cascade facilities)
  if (role === "superadmin") {
    try {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      // Load facilities only when org changes
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } catch (err) {
      console.error("❌ Organizations preload failed", err);
    }
  } else {
    orgSelect?.closest(".form-group")?.classList.add("hidden");
    await reloadFacilities(localStorage.getItem("organizationId") || null);
  }

  // ✅ Department dropdown
  try {
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
  } catch (err) {
    console.error("❌ Departments preload failed", err);
  }

  // ✅ Patient suggestion
  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    (selected) => {
      const input = document.getElementById("patientInput");
      document.getElementById("patientId").value = selected?.id || "";
      input.value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");
    },
    "label"
  );

  // ✅ Doctor suggestion (admin/superadmin only)
  if (role === "admin" || role === "superadmin") {
    doctorFieldGroup?.classList.remove("hidden");

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
  } else {
    doctorFieldGroup?.classList.add("hidden");
    const employeeId = localStorage.getItem("employeeId");
    document.getElementById("doctorId").value = employeeId || "";
  }

  // ✅ Consultation suggestion (admin/superadmin only)
  if (role === "admin" || role === "superadmin") {
    consultationFieldGroup?.classList.remove("hidden");

    setupSuggestionInputDynamic(
      document.getElementById("consultationInput"),
      document.getElementById("consultationSuggestions"),
      "/api/lite/consultations",
      (selected) => {
        document.getElementById("consultationId").value = selected?.id || "";
        document.getElementById("consultationInput").value =
          `${selected?.id || ""} (${selected?.status || ""})`;
      },
      "id"
    );
  } else {
    consultationFieldGroup?.classList.add("hidden");
    document.getElementById("consultationId").value = ""; // backend may auto-link
  }

  // Hook submission
  setupRecommendationFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  // --- Handle edit mode ---
  const editId = sessionStorage.getItem("recommendationEditId");
  const rawPayload = sessionStorage.getItem("recommendationEditPayload");

  async function applyPrefill(entry) {
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

    if (entry.doctor && (role === "admin" || role === "superadmin")) {
      document.getElementById("doctorId").value = entry.doctor.id;
      document.getElementById("doctorInput").value =
        entry.doctor.full_name ||
        `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();
    }

    if (entry.consultation && (role === "admin" || role === "superadmin")) {
      document.getElementById("consultationId").value = entry.consultation.id;
      document.getElementById("consultationInput").value =
        `${entry.consultation.id} (${entry.consultation.status})`;
    }

    if (entry.recommendation_date) {
      document.getElementById("recommendationDate").value =
        entry.recommendation_date.split("T")[0];
    }
    if (entry.reason) {
      document.getElementById("recommendationReason").value = entry.reason;
    }

    // Update UI
    document.querySelector(".card-title").textContent = "Edit Recommendation";
    form.querySelector("button[type=submit]").innerHTML =
      `<i class="ri-save-3-line me-1"></i> Update Recommendation`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached recommendation for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/recommendations/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch recommendation");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load recommendation:", err);
        showToast(err.message || "❌ Failed to load recommendation for editing");
      } finally {
        hideLoading();
      }
    }
  }

  // 🚪 Cancel
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("recommendationEditId");
    sessionStorage.removeItem("recommendationEditPayload");
    window.location.href = "/recommendations-list.html";
  });

  // 🚪 Clear
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("recommendationEditId");
    sessionStorage.removeItem("recommendationEditPayload");
    resetForm();
  });
});
