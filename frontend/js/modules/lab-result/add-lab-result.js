// 📦 labresult-main.js – Lab Result Form Controller (Enterprise-Aligned, Master Pattern)
// ============================================================
// 🧭 Secure, Role-Aware Add/Edit Controller
// Aligned with consultation-main.js pattern
// ============================================================

import {
  setupLabResultFormSubmission,
  getLabResultFormState,
} from "./lab-result-form.js";

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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard (backend-driven)
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form → Back to Add Mode
============================================================ */
function resetForm() {
  const form = document.getElementById("labResultForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Reset dropdowns
  ["organizationSelect", "facilitySelect", "labRequestSelect", "labRequestItemSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = "";
        if (id === "labRequestSelect" || id === "labRequestItemSelect") {
          el.innerHTML = "";
          el.disabled = false;
          delete el.dataset.currentId;
          delete el.dataset.currentLabel;
        }
      }
    }
  );

  // Readonly department
  const deptField = document.getElementById("departmentField");
  const deptHidden = document.getElementById("departmentIdHidden");
  if (deptField) deptField.value = "—";
  if (deptHidden) deptHidden.value = "";

  // Clear pills + file preview
  document.getElementById("resultPillsContainer").innerHTML =
    `<p class="text-muted">No lab results added yet.</p>`;
  document.getElementById("attachmentPreview").innerHTML = "";
  document.getElementById("removeAttachmentBtn")?.classList.add("hidden");
  document.getElementById("attachmentInput").value = "";

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  if (titleEl) titleEl.textContent = "Add Lab Result";
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit All`;

  document.getElementById("addResultBtn")?.classList.remove("hidden");
  document.getElementById("resultPillsContainer")?.classList.remove("hidden");
}

/* ============================================================
   🚀 Init (Master Pattern Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("labResultForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptField = document.getElementById("departmentField");
  const deptHidden = document.getElementById("departmentIdHidden");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ------------------- Organization / Facility ------------------- */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite({}, true);
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      orgSelect?.addEventListener("change", async () => {
        const orgId = orgSelect.value;
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      });
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* -------------------- Hook Form Logic -------------------- */
  setupLabResultFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     🧩 Edit Mode Prefill Logic
  ============================================================ */
  const editId = sessionStorage.getItem("labResultEditId");
  const rawPayload = sessionStorage.getItem("labResultEditPayload");

  const safeSet = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };
  const formatDate = (v) =>
    v
      ? new Date(v).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

  async function applyPrefill(entry) {
    // Core fields
    safeSet("result", entry.result);
    safeSet("notes", entry.notes);
    safeSet("doctor_notes", entry.doctor_notes);
    if (entry.result_date) {
      const d = new Date(entry.result_date);
      if (!isNaN(d)) safeSet("result_date", d.toISOString().slice(0, 10));
    }

    // Patient / Doctor
    if (entry.patient) {
      safeSet("patientId", entry.patient.id);
      safeSet(
        "patientSearch",
        `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`
      );
    }
    if (entry.doctor) {
      safeSet("doctorId", entry.doctor.id);
      safeSet(
        "doctorSearch",
        `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim()
      );
    }

    // Consultation / Reg Log
    safeSet("consultationId", entry.consultation?.id || entry.consultation_id);
    safeSet("consultationField", entry.consultation?.consultation_date || "");
    safeSet("registrationLogId", entry.registrationLog?.id || entry.registration_log_id);
    safeSet("registrationLogField", entry.registrationLog?.log_status || "");

    // Lab Request dropdown
    const labReqSelect = document.getElementById("labRequestSelect");
    if (labReqSelect && entry.labRequest?.id) {
      const opt = document.createElement("option");
      opt.value = entry.labRequest.id;
      opt.textContent = `${
        entry.labRequest.labTest?.name || "Lab Test"
      } – ${formatDate(entry.labRequest.request_date)} [${entry.labRequest.status}]`;
      opt.selected = true;
      labReqSelect.innerHTML = "";
      labReqSelect.appendChild(opt);
      labReqSelect.disabled = true;
      labReqSelect.dataset.currentId = entry.labRequest.id;
      labReqSelect.dataset.currentLabel = opt.textContent;
    }

    // Lab Request Item dropdown
    const labReqItemSelect = document.getElementById("labRequestItemSelect");
    if (labReqItemSelect && entry.lab_request_item_id) {
      const opt = document.createElement("option");
      opt.value = entry.lab_request_item_id;
      opt.textContent = `${
        entry.labTest?.name || entry.test || "Lab Test Item"
      } (${entry.status || "pending"})`;
      opt.selected = true;
      labReqItemSelect.innerHTML = "";
      labReqItemSelect.appendChild(opt);
      labReqItemSelect.disabled = true;
      labReqItemSelect.dataset.currentId = entry.lab_request_item_id;
      labReqItemSelect.dataset.currentLabel = opt.textContent;
    }

    // Attachment
    if (entry.attachment_url) {
      const fname = entry.attachment_url.split("/").pop();
      const preview = document.getElementById("attachmentPreview");
      if (preview)
        preview.innerHTML = `<a href="${entry.attachment_url}" target="_blank">${fname}</a>`;
      document.getElementById("removeAttachmentBtn")?.classList.remove("hidden");
    }

    // 🏢 Org / Facility / Dept (fixed prefill timing)
    try {
      if (userRole.includes("super") && entry.organization?.id && orgSelect) {
        // Wait for orgs to load
        const orgs = await loadOrganizationsLite({}, true);
        setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

        // ⏳ Wait until options appear
        let attempts = 0;
        while (orgSelect.options.length <= 1 && attempts < 20) {
          await new Promise((r) => setTimeout(r, 150));
          attempts++;
        }

        orgSelect.value = entry.organization.id;

        // Load and select facility
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization.id },
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

        // ⏳ Wait until facilities populate
        attempts = 0;
        while (facSelect.options.length <= 1 && attempts < 20) {
          await new Promise((r) => setTimeout(r, 150));
          attempts++;
        }

        if (entry.facility?.id) facSelect.value = entry.facility.id;
      } else if (entry.facility?.id && facSelect) {
        // For admins or regular users
        const facs = await loadFacilitiesLite({}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
        facSelect.value = entry.facility.id;
      }
    } catch (err) {
      console.error("❌ Prefill org/facility failed:", err);
    }

    // Department
    if (entry.department?.id) {
      safeSet("departmentField", entry.department.name || "—");
      safeSet("departmentIdHidden", entry.department.id);
    }

    // Switch UI to Edit Mode
    const titleEl = document.querySelector(".card-title");
    const submitBtn = form.querySelector("button[type=submit]");
    if (titleEl) titleEl.textContent = "Edit Lab Result";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Lab Result`;

    document.getElementById("addResultBtn")?.classList.add("hidden");
    document.getElementById("resultPillsContainer")?.classList.add("hidden");
  }

  /* ----------------- Load from Session or API ----------------- */
  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      console.group("🧩 [LabResult Edit Prefill]");
      console.log("📦 Full entry payload from session:", entry);
      console.groupEnd();

      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Cached edit load failed:", err);
      showToast("❌ Could not load cached lab result");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/lab-results/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch lab result");

        console.group("🧩 [LabResult Edit Prefill]");
        console.log("📦 Full entry payload from API:", entry);
        console.groupEnd();

        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Fetch error:", err);
        showToast(err.message || "❌ Failed to load lab result for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("labResultEditId");
    sessionStorage.removeItem("labResultEditPayload");
    window.location.href = "/lab-results-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("labResultEditId");
    sessionStorage.removeItem("labResultEditPayload");
    resetForm();
  });
});
