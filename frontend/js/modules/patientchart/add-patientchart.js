// 📦 add-patientchart.js – Patient Chart Cache Page Bootstrap (No Edit Mode)
// ============================================================================
// 🔹 Lightweight version: initializes dropdowns, patient search, and cache generator
// 🔹 Mirrors add-consultation.js for structural consistency
// ============================================================================

import {
  showToast,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";
import { setupPatientChartFormSubmission } from "./patientchart-form.js";

// 🔐 Auth Guard
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("patientChartForm");
  if (!form) return console.error("❌ Missing #patientChartForm element");

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    // 🔹 Load organization/facility according to role
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // 🔹 Setup patient search
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected.label ||
          (selected.pat_no && selected.full_name
            ? `${selected.pat_no} - ${selected.full_name}`
            : selected.full_name || selected.pat_no || "");
      },
      "label"
    );

    // 🔹 Initialize cache submission
    await setupPatientChartFormSubmission({ form });

    showToast("✅ Patient Chart Cache ready");
  } catch (err) {
    console.error("❌ Initialization failed:", err);
    showToast("❌ Failed to initialize Patient Chart Cache form");
  }
});
