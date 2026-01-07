// 📁 add-newborn-record.js – Init edit mode on add-newborn-record.html

import { setupNewbornRecordFormSubmission, loadDeliveriesForMother } from "./newborn-record-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
} from "../../utils/index.js";
import {
  loadFacilitiesLite,
  loadOrganizationsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – driven by backend permissions
const token = initPageGuard("newborn-records");
initLogoutWatcher();

// Shared ref
const sharedState = { currentEditIdRef: { value: null } };

// 🧹 Reset form helper
function resetForm() {
  const form = document.getElementById("newbornRecordForm");
  if (form) form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset selects
  ["organizationSelect", "facilitySelect", "deliveryRecordId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI to Add mode
  document.querySelector(".card-title").textContent = "Add Newborn Record";
  form.querySelector("button[type=submit]").innerHTML =
    `<i class="ri-add-line me-1"></i> Create Newborn Record`;
}

// 🚀 Init
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("newbornRecordForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facilitySelect = document.getElementById("facilitySelect");

  const userRole = (localStorage.getItem("userRole") || "").trim().toLowerCase();

  // ✅ Preload org/fac with cascading
  try {
    if (userRole === "superadmin") {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
      orgSelect.closest(".form-group").style.display = "";

      orgSelect.onchange = async () => {
        const orgId = orgSelect.value;
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {});
        setupSelectOptions(facilitySelect, facs, "id", "name", "-- Select Facility --");
      };

      facilitySelect.innerHTML = `<option value="">-- Select Facility --</option>`;
    } else {
      if (orgSelect) orgSelect.closest(".form-group").style.display = "none";
      const facs = await loadFacilitiesLite();
      setupSelectOptions(facilitySelect, facs, "id", "name", "-- Select Facility --");
    }
  } catch (err) {
    console.error("❌ Dropdown preload failed", err);
    showToast("❌ Failed to load reference lists");
  }

  // Hook submission
  setupNewbornRecordFormSubmission({ form, token, sharedState, resetForm, loadEntries: null });

  // --- Handle edit mode ---
  const editId = sessionStorage.getItem("newbornRecordEditId");
  const rawPayload = sessionStorage.getItem("newbornRecordEditPayload");

  async function applyPrefill(entry) {
    console.log("[Prefill] Newborn Entry:", entry);

    [
      "gender",
      "birth_weight",
      "birth_length",
      "head_circumference",
      "apgar_score_1min",
      "apgar_score_5min",
      "measurement_notes",
      "complications",
      "notes",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = entry[id] || "";
    });

    // ✅ Handle both flat IDs and nested objects
    const orgId = entry.organization_id || entry.organization?.id;
    const facId = entry.facility_id || entry.facility?.id;

    if (orgId && orgSelect) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
      orgSelect.value = orgId;
    }

    if (facId && facilitySelect) {
      const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {});
      setupSelectOptions(facilitySelect, facs, "id", "name", "-- Select Facility --");
      facilitySelect.value = facId;
    }

    // ✅ Prefill mother field
    const motherInput = document.getElementById("motherInput");
    const motherHidden = document.getElementById("motherId");
    if (motherInput && entry.mother) {
      motherInput.value = `${entry.mother.pat_no} – ${entry.mother.first_name} ${entry.mother.last_name}`;
      motherHidden.value = entry.mother.id;
    }

    // ✅ Prefill delivery record dropdown (depends on mother)
    const deliverySelect = document.getElementById("deliveryRecordId");
    if (deliverySelect && entry.deliveryRecord && entry.mother?.id) {
      await loadDeliveriesForMother(entry.mother.id, entry.deliveryRecord.id);
    }

    // Update UI to Edit mode
    document.querySelector(".card-title").textContent = "Edit Newborn Record";
    form.querySelector("button[type=submit]").innerHTML =
      `<i class="ri-save-3-line me-1"></i> Update Newborn Record`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached newborn payload:", err);
      showToast("❌ Could not load cached newborn record for editing");
    }
  }

  // 🚪 Cancel button
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("newbornRecordEditId");
    sessionStorage.removeItem("newbornRecordEditPayload");
    window.location.href = "/newborn-records-list.html";
  });

  // 🚪 Clear button
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("newbornRecordEditId");
    sessionStorage.removeItem("newbornRecordEditPayload");
    resetForm();
  });
});
