// 📦 delivery-record-main.js – Secure Add/Edit Page Controller for Delivery Records (Master Pattern)

import {
  setupDeliveryRecordFormSubmission,
} from "./delivery-record-form.js";

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

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  const form = document.getElementById("deliveryRecordForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  [
    "patientId",
    "doctorId",
    "midwifeId",
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "consultationSelect",
    "billableItemSelect",
    "deliveryType",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Delivery Record";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Delivery Record`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("deliveryRecordForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const billableItemSelect = document.getElementById("billableItemSelect");
  const deliveryTypeInput = document.getElementById("deliveryType");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* --------------------- Organizations & Facilities --------------------- */
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

  /* --------------------------- Department & Items --------------------------- */
  try {
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    const items = await loadBillableItemsLite({ category: "delivery" }, true);
    setupSelectOptions(billableItemSelect, items, "id", "name", "-- Select Billable Item --");

    billableItemSelect?.addEventListener("change", () => {
      const selectedOption = billableItemSelect.options[billableItemSelect.selectedIndex];
      deliveryTypeInput.value = selectedOption ? selectedOption.text : "";
    });
  } catch (err) {
    console.error("❌ Department/Billable preload failed:", err);
    showToast("❌ Failed to load department or billable items");
  }

  /* --------------------------- Suggestion Inputs --------------------------- */
  try {
    setupSuggestionInputDynamic(
      document.getElementById("patientInput"),
      document.getElementById("patientSuggestions"),
      "/api/lite/patients",
      (selected) => {
        document.getElementById("patientId").value = selected?.id || "";
        document.getElementById("patientInput").value =
          selected?.label ||
          (selected?.pat_no && selected?.full_name
            ? `${selected.pat_no} - ${selected.full_name}`
            : selected?.full_name || selected?.pat_no || "");
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

    setupSuggestionInputDynamic(
      document.getElementById("midwifeInput"),
      document.getElementById("midwifeSuggestions"),
      "/api/lite/employees",
      (selected) => {
        document.getElementById("midwifeId").value = selected?.id || "";
        document.getElementById("midwifeInput").value =
          selected?.full_name ||
          `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
      },
      "full_name"
    );
  } catch (err) {
    console.error("❌ Suggestion setup failed:", err);
    showToast("❌ Failed to setup suggestion inputs");
  }

  /* -------------------- Form Setup & Submission -------------------- */
  setupDeliveryRecordFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode
  ============================================================ */
  const editId = sessionStorage.getItem("deliveryRecordEditId");
  const rawPayload = sessionStorage.getItem("deliveryRecordEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("deliveryDate").value =
      entry.delivery_date ? entry.delivery_date.split("T")[0] : "";
    document.getElementById("deliveryType").value = entry.delivery_type || "";
    document.getElementById("deliveryMode").value = entry.delivery_mode || "";
    document.getElementById("babyCount").value = entry.baby_count || "";
    document.getElementById("birthWeight").value = entry.birth_weight || "";
    document.getElementById("birthLength").value = entry.birth_length || "";
    document.getElementById("newbornWeight").value = entry.newborn_weight || "";
    document.getElementById("newbornGender").value = entry.newborn_gender || "";
    document.getElementById("apgarScore").value = entry.apgar_score || "";
    document.getElementById("complications").value = entry.complications || "";
    document.getElementById("notes").value = entry.notes || "";
    document.getElementById("isEmergency").checked = !!entry.is_emergency;

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      if (userRole.includes("super"))
        await setupFacilitiesForOrg(entry.organization.id);
    }

    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.department?.id && deptSelect) deptSelect.value = entry.department.id;
    if (entry.billableItem?.id && billableItemSelect)
      billableItemSelect.value = entry.billableItem.id;

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

    if (entry.midwife) {
      document.getElementById("midwifeId").value = entry.midwife.id;
      document.getElementById("midwifeInput").value =
        entry.midwife.full_name ||
        `${entry.midwife.first_name || ""} ${entry.midwife.last_name || ""}`.trim();
    }

    // Switch UI to edit mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Delivery Record";
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Delivery Record`;
  }

  async function setupFacilitiesForOrg(orgId) {
    const facs = await loadFacilitiesLite({ organization_id: orgId }, true);
    setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached delivery record for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/delivery-records/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch delivery record");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load record:", err);
        showToast(err.message || "❌ Failed to load delivery record for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("deliveryRecordEditId");
    sessionStorage.removeItem("deliveryRecordEditPayload");
    window.location.href = "/delivery-records-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("deliveryRecordEditId");
    sessionStorage.removeItem("deliveryRecordEditPayload");
    resetForm();
  });
});
