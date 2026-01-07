// 📁 add-registration-log.js – Init Add/Edit mode for add-registration-log.html

import { setupRegistrationLogFormSubmission } from "./registration-log-form.js";
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – automatically detect permission ("registration_logs:create" or "registration_logs:edit")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// 🔁 Shared state for cross-module operations
const sharedState = {
  currentEditIdRef: { value: null },
};

// 🧹 Reset form helper → back to Add mode
function resetForm() {
  const form = document.getElementById("registrationLogForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden IDs
  [
    "patientId",
    "registrarId",
    "organizationSelect",
    "facilitySelect",
    "registrationTypeSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Registration Log";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Registration Log`;
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("registrationLogForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const typeSelect = document.getElementById("registrationTypeSelect");

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
    // Facility head / registrar / staff → hide facility field
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  /* --------------------- Registration Type --------------------- */
  try {
    const regTypes = await loadBillableItemsLite({ category: "registration" }, true);
    setupSelectOptions(typeSelect, regTypes, "id", "name", "-- Select Registration Type --");
  } catch (err) {
    console.error("❌ Registration types preload failed", err);
    showToast("❌ Could not load registration types");
  }

  /* --------------------- Patient Suggestion --------------------- */
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

  /* --------------------- Registrar Suggestion --------------------- */
  setupSuggestionInputDynamic(
    document.getElementById("registrarInput"),
    document.getElementById("registrarSuggestions"),
    "/api/lite/employees",
    (selected) => {
      document.getElementById("registrarId").value = selected?.id || "";
      document.getElementById("registrarInput").value =
        selected?.full_name ||
        `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
    },
    "full_name"
  );

  /* --------------------- Form Submission --------------------- */
  setupRegistrationLogFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* --------------------- Edit Mode --------------------- */
  const editId = sessionStorage.getItem("registrationLogEditId");
  const rawPayload = sessionStorage.getItem("registrationLogEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("registrationMethod").value = entry.registration_method || "";
    document.getElementById("patientCategory").value = entry.patient_category || "";
    document.getElementById("visitReason").value = entry.visit_reason || "";
    document.getElementById("registrationSource").value = entry.registration_source || "";
    document.getElementById("notes").value = entry.notes || "";

    if (typeof entry.is_emergency !== "undefined") {
      document.getElementById("isEmergency").checked = !!entry.is_emergency;
    }

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      await reloadFacilities(entry.organization.id);
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.registrationType?.id && typeSelect) typeSelect.value = entry.registrationType.id;

    if (entry.patient) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value =
        entry.patient.label ||
        (entry.patient.pat_no && entry.patient.full_name
          ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
          : entry.patient.full_name || entry.patient.pat_no || "");
    }

    if (entry.registrar) {
      document.getElementById("registrarId").value = entry.registrar.id;
      document.getElementById("registrarInput").value =
        entry.registrar.full_name ||
        `${entry.registrar.first_name || ""} ${entry.registrar.last_name || ""}`.trim();
    }

    // Update UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Registration Log";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached registration log for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/registration-logs/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch registration log");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load registration log:", err);
        showToast(err.message || "❌ Failed to load registration log for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* --------------------- Cancel & Clear --------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("registrationLogEditId");
    sessionStorage.removeItem("registrationLogEditPayload");
    window.location.href = "/registration-logs-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("registrationLogEditId");
    sessionStorage.removeItem("registrationLogEditPayload");
    resetForm();
  });
});
