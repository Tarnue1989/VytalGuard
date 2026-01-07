// 📦 lab-result-main.js – Form-only Loader for Lab Results (Enterprise-Aligned)
// ============================================================
// 🧭 Secure, Role-Aware Form Loader (Aligned with Consultation Master Pattern)
// ============================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupLabResultFormSubmission } from "./lab-result-form.js";
import {
  FIELD_LABELS_LAB_RESULT,
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
} from "./lab-result-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";
import {
  loadFacilitiesLite,
  loadOrganizationsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth + Guards
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
   📎 DOM References
============================================================ */
const form = document.getElementById("labResultForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  sessionStorage.removeItem("labResultEditId");
  sessionStorage.removeItem("labResultEditPayload");

  ["result", "notes", "doctor_notes", "result_date"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organizationSelect", "facilitySelect", "labRequestSelect", "labRequestItemSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = "";
        if (el.tagName === "SELECT") {
          el.innerHTML = `<option value="">-- Select --</option>`;
          el.disabled = false;
        }
        if (id === "labRequestSelect" || id === "labRequestItemSelect") {
          delete el.dataset.currentId;
          delete el.dataset.currentLabel;
        }
      }
    }
  );

  const deptField = document.getElementById("departmentField");
  const deptHidden = document.getElementById("departmentIdHidden");
  if (deptField) deptField.value = "—";
  if (deptHidden) deptHidden.value = "";

  const preview = document.getElementById("attachmentPreview");
  const removeBtn = document.getElementById("removeAttachmentBtn");
  const input = document.getElementById("attachmentInput");
  const flag = document.getElementById("remove_attachment");
  if (preview) preview.innerHTML = "";
  if (removeBtn) removeBtn.classList.add("hidden");
  if (input) input.value = "";
  if (flag) flag.value = "false";

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Lab Result";
  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit All`;

  document.getElementById("addResultBtn")?.classList.remove("hidden");
  document.getElementById("resultPillsContainer")?.classList.remove("hidden");
}

/* ============================================================
   🧭 Form Visibility Controls
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("labResultFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("labResultFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/lab-results-list.html";
  };
}
if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("labResultEditId");
    sessionStorage.removeItem("labResultEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initLabResultModule() {
  showForm();

  setupLabResultFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  localStorage.setItem("labResultPanelVisible", "false");

  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("org") && role.includes("owner")) role = "orgowner";
  else if (role.includes("facility") && role.includes("head")) role = "facilityhead";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "lab_result",
    fieldLabels: FIELD_LABELS_LAB_RESULT,
    fieldOrder: FIELD_ORDER_LAB_RESULT,
    defaultFields: FIELD_DEFAULTS_LAB_RESULT[role],
  });

  const doctorNotesEl = document.getElementById("doctor_notes");
  if (doctorNotesEl && role === "staff") doctorNotesEl.readOnly = true;
}

/* ============================================================
   ✏️ Edit Prefill (API or Cached)
============================================================ */
export async function applyLabResultPrefill(entry) {
  const safeSet = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || "";
  };

  const formatDate = (val) => {
    if (!val) return "";
    const d = new Date(val);
    return isNaN(d)
      ? val
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  safeSet("result", entry.result);
  safeSet("notes", entry.notes);
  safeSet("doctor_notes", entry.doctor_notes);
  if (entry.result_date) {
    const d = new Date(entry.result_date);
    if (!isNaN(d)) safeSet("result_date", d.toISOString().slice(0, 10));
  }

  if (entry.patient) {
    safeSet("patientId", entry.patient.id);
    safeSet(
      "patientSearch",
      `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`
    );
  }

  safeSet("doctorId", entry.doctor?.id || entry.doctor_id);
  safeSet(
    "doctorSearch",
    entry.doctor ? `${entry.doctor.first_name} ${entry.doctor.last_name}` : ""
  );

  safeSet("consultationId", entry.consultation?.id || entry.consultation_id);
  safeSet("consultationField", entry.consultation?.consultation_date);
  safeSet("registrationLogId", entry.registrationLog?.id || entry.registration_log_id);
  safeSet("registrationLogField", entry.registrationLog?.log_status);

  const labReqSelect = document.getElementById("labRequestSelect");
  if (entry.labRequest?.id && labReqSelect) {
    labReqSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = entry.labRequest.id;
    const testName = entry.labRequest.labTest?.name || "Lab Test";
    const reqDate = formatDate(entry.labRequest.request_date);
    const status = entry.labRequest.status || "pending";
    opt.textContent = `${testName} – ${reqDate} [${status}]`;
    opt.selected = true;
    labReqSelect.appendChild(opt);
    labReqSelect.dataset.currentId = entry.labRequest.id;
    labReqSelect.dataset.currentLabel = opt.textContent;
    labReqSelect.disabled = true;
  }

  const labReqItemSelect = document.getElementById("labRequestItemSelect");
  if (entry.lab_request_item_id && labReqItemSelect) {
    labReqItemSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = entry.lab_request_item_id;
    opt.textContent = `${entry.labTest?.name || entry.test || "Lab Test Item"} (${entry.status || "pending"})`;
    opt.selected = true;
    labReqItemSelect.appendChild(opt);
    labReqItemSelect.dataset.currentId = entry.lab_request_item_id;
    labReqItemSelect.dataset.currentLabel = opt.textContent;
    labReqItemSelect.disabled = true;
  }

  if (entry.attachment_url) {
    const fname = entry.attachment_url.split("/").pop();
    document.getElementById("attachmentPreview").innerHTML =
      `<a href="${entry.attachment_url}" target="_blank">${fname}</a>`;
    document.getElementById("removeAttachmentBtn")?.classList.remove("hidden");
  }

  // 🏢 Org + Facility Prefill (safe preload identical to Consultation)
  const organizationSelect = document.getElementById("organizationSelect");
  const facilitySelect = document.getElementById("facilitySelect");

  try {
    const orgs = await loadOrganizationsLite({}, true);
    setupSelectOptions(organizationSelect, orgs, "id", "name", "-- Select Organization --");

    let attempts = 0;
    while (organizationSelect.options.length <= 1 && attempts < 20) {
      await new Promise((r) => setTimeout(r, 150));
      attempts++;
    }

    if (entry.organization?.id) {
      organizationSelect.value = entry.organization.id;

      const facs = await loadFacilitiesLite(
        { organization_id: entry.organization.id },
        true
      );
      setupSelectOptions(facilitySelect, facs, "id", "name", "-- Select Facility --");

      if (entry.facility?.id) {
        facilitySelect.value = entry.facility.id;
      }
    } else {
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facilitySelect, facs, "id", "name", "-- Select Facility --");
      if (entry.facility?.id) facilitySelect.value = entry.facility.id;
    }
  } catch (err) {
    console.error("❌ Prefill org/facility failed:", err);
  }

  if (entry.department?.id) {
    safeSet("departmentField", entry.department.name || "—");
    safeSet("departmentIdHidden", entry.department.id);
  }

  document.getElementById("addResultBtn")?.classList.add("hidden");
  document.getElementById("resultPillsContainer")?.classList.add("hidden");

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Edit Lab Result";
  const submitBtn = document.querySelector("#labResultForm button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Lab Result`;
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // reserved for reactive integrations
}
