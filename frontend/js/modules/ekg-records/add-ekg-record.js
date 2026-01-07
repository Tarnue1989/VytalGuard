// 📦 ekg-record-main.js – EKG Record Add/Edit Page Controller (Master Pattern)

import {
  setupEKGRecordFormSubmission,
} from "./ekg-record-form.js";

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
  loadFacilitiesLite,
  loadOrganizationsLite,
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard – Automatically resolve correct permission (add/edit)
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("ekgRecordForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset hidden inputs
  [
    "patientId",
    "technicianId",
    "organizationSelect",
    "facilitySelect",
    "billableItemSelect",
    "registrationLogSelect",
    "consultationSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add EKG Record";
  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add EKG Record`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("ekgRecordForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const billableSelect = document.getElementById("billableItemSelect");
  const regLogSelect = document.getElementById("registrationLogSelect");
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

  /* --------------------------- Billable Items --------------------------- */
  try {
    const ekgItems = await loadBillableItemsLite({ category: "ekg" }, true);
    setupSelectOptions(billableSelect, ekgItems, "id", "name", "-- Select EKG Item --");
  } catch (err) {
    console.error("❌ Billable items preload failed:", err);
    showToast("❌ Failed to load billable items");
  }

  /* --------------------- Patient & Technician --------------------- */
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

  setupSuggestionInputDynamic(
    document.getElementById("technicianInput"),
    document.getElementById("technicianSuggestions"),
    "/api/lite/employees",
    (selected) => {
      document.getElementById("technicianId").value = selected?.id || "";
      document.getElementById("technicianInput").value =
        selected?.full_name ||
        `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
    },
    "full_name"
  );

  /* -------------------- Form setup & submission -------------------- */
  setupEKGRecordFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode Handling
  ============================================================ */
  const editId = sessionStorage.getItem("ekgRecordEditId");
  const rawPayload = sessionStorage.getItem("ekgRecordEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("recordedDate").value =
      entry.recorded_date ? entry.recorded_date.split("T")[0] : "";
    document.getElementById("heartRate").value = entry.heart_rate || "";
    document.getElementById("prInterval").value = entry.pr_interval || "";
    document.getElementById("qrsDuration").value = entry.qrs_duration || "";
    document.getElementById("qtInterval").value = entry.qt_interval || "";
    document.getElementById("axis").value = entry.axis || "";
    document.getElementById("rhythm").value = entry.rhythm || "";
    document.getElementById("interpretation").value = entry.interpretation || "";
    document.getElementById("recommendation").value = entry.recommendation || "";
    document.getElementById("note").value = entry.note || "";

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      if (userRole.includes("super")) {
        const facs = await loadFacilitiesLite({ organization_id: entry.organization.id }, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
    }

    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.billableItem?.id && billableSelect) billableSelect.value = entry.billableItem.id;
    if (entry.registrationLog?.id && regLogSelect) regLogSelect.value = entry.registrationLog.id;

    if (entry.patient) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value =
        entry.patient.label ||
        (entry.patient.pat_no && entry.patient.full_name
          ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
          : entry.patient.full_name || entry.patient.pat_no || "");
    }

    if (entry.technician) {
      document.getElementById("technicianId").value = entry.technician.id;
      document.getElementById("technicianInput").value =
        entry.technician.full_name ||
        `${entry.technician.first_name || ""} ${entry.technician.last_name || ""}`.trim();
    }

    // 🧭 Switch to Edit Mode UI
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit EKG Record";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update EKG Record`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached EKG record for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/ekg-records/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch EKG record");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load EKG record:", err);
        showToast(err.message || "❌ Failed to load EKG record for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🔙 Cancel / Clear Handlers
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("ekgRecordEditId");
    sessionStorage.removeItem("ekgRecordEditPayload");
    window.location.href = "/ekg-records-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("ekgRecordEditId");
    sessionStorage.removeItem("ekgRecordEditPayload");
    resetForm();
  });
});
