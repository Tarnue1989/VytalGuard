// 📦 lab-result-form.js – Secure & Role-Aware Lab Result Form (Enterprise-Aligned)
// ============================================================
// 💉 Follows Consultation Master Pattern
// Includes full permission handling, form safety, suggestion inputs,
// multi-result pill handling, and secure edit/add workflows.
// ============================================================

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

/* ============================================================
   🔧 Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}
function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  if (msg?.detail) return msg.detail;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}
function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}
function normalizeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* ============================================================
   📂 File Preview Helper
============================================================ */
function setupFilePreview(inputId, previewId, removeBtnId, fieldName) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const removeBtn = document.getElementById(removeBtnId);
  const flag = document.getElementById(`remove_${fieldName}`);

  if (!input || !preview || !removeBtn) return;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    preview.innerHTML = `<a href="${URL.createObjectURL(file)}" target="_blank">${file.name}</a>`;
    removeBtn.classList.remove("hidden");
    if (flag) flag.value = "false";
  });

  removeBtn.addEventListener("click", () => {
    input.value = "";
    preview.innerHTML = "";
    removeBtn.classList.add("hidden");
    if (flag) flag.value = "true";
  });
}

/* ============================================================
   💊 Pill System – Multi-Result Support
============================================================ */
let selectedResults = [];
let pillsContainer;

export function getLabResultFormState() {
  return { selectedResults, renderResultPills };
}

function renderResultPills() {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedResults.length) {
    pillsContainer.innerHTML = `<p class="text-muted">No lab results added yet.</p>`;
  } else {
    selectedResults.forEach((res, idx) => {
      const pill = document.createElement("div");
      pill.className = "pill";
      const fileDisplay = res.file
        ? `<a href="${URL.createObjectURL(res.file)}" target="_blank" class="badge bg-light text-primary ms-1">📎 ${res.file.name}</a>`
        : res.attachment_url
        ? `<a href="${res.attachment_url}" target="_blank" class="badge bg-light text-primary ms-1">📎 ${res.attachment_url.split("/").pop()}</a>`
        : "";

      pill.innerHTML = `
        <strong>${res.test || "Test"}</strong> – ${res.result || "—"}
        | Date: ${res.result_date || "—"}
        | Patient: ${res.patient_label || "—"}
        ${fileDisplay}
        <button type="button" class="btn btn-sm btn-link pill-edit" data-idx="${idx}" title="Edit">
          <i class="ri-pencil-line"></i>
        </button>
        <button type="button" class="btn btn-sm btn-link text-danger pill-remove" data-idx="${idx}" title="Remove">
          <i class="ri-close-line"></i>
        </button>
      `;
      pillsContainer.appendChild(pill);
    });

    // ✏️ Edit pill
    pillsContainer.querySelectorAll(".pill-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = btn.dataset.idx;
        const item = selectedResults[idx];
        document.getElementById("result").value = item.result || "";
        document.getElementById("notes").value = item.notes || "";
        document.getElementById("doctor_notes").value = item.doctor_notes || "";
        document.getElementById("result_date").value = normalizeDate(item.result_date);

        const labReqItemSelect = document.getElementById("labRequestItemSelect");
        if (labReqItemSelect) labReqItemSelect.value = item.lab_request_item_id || "";

        selectedResults.splice(idx, 1);
        renderResultPills();

        const addBtn = document.getElementById("addResultBtn");
        addBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Result`;
        addBtn.dataset.mode = "edit";
      });
    });

    // ❌ Remove pill
    pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedResults.splice(btn.dataset.idx, 1);
        renderResultPills();
      });
    });
  }

  // Dynamic submit label
  const submitBtn = document.querySelector("button[type=submit]");
  if (submitBtn && !submitBtn.dataset.editMode) {
    submitBtn.innerHTML =
      selectedResults.length <= 1
        ? `<i class="ri-save-3-line me-1"></i> Submit`
        : `<i class="ri-save-3-line me-1"></i> Submit All`;
  }
}

/* ============================================================
   🚀 Setup Lab Result Form Submission
============================================================ */
export async function setupLabResultFormSubmission({ form }) {
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const itemId = getQueryParam("id") || sessionStorage.getItem("labResultEditId");
  const isEdit = !!itemId;
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Lab Result");
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Lab Result`;
    } else {
      titleEl && (titleEl.textContent = "Add Lab Result");
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Lab Result`;
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* -------------------- DOM Refs -------------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentIdHidden");
  const labReqSelect = document.getElementById("labRequestSelect");
  const labReqItemSelect = document.getElementById("labRequestItemSelect");
  const patientInput = document.getElementById("patientSearch");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSearchSuggestions");
  const doctorInput = document.getElementById("doctorSearch");
  const doctorHidden = document.getElementById("doctorId");
  const resultInput = document.getElementById("result");
  const notesInput = document.getElementById("notes");
  const doctorNotesInput = document.getElementById("doctor_notes");
  const resultDateInput = document.getElementById("result_date");
  const fileInput = document.getElementById("attachmentInput");
  const addResultBtn = document.getElementById("addResultBtn");
  pillsContainer = document.getElementById("resultPillsContainer");

  /* ============================================================
     Prefill Dropdowns & Suggestions
  ============================================================ */
  try {
    const orgs = await loadOrganizationsLite();
    setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
    const facs = await loadFacilitiesLite({}, true);
    setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    // Role-aware dropdown visibility
    if (userRole.includes("super")) {
      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (userRole.includes("admin")) {
      orgSelect.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect.closest(".form-group")?.classList.add("hidden");
      facSelect.closest(".form-group")?.classList.add("hidden");
    }

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected.label ||
          `${selected.pat_no || ""} - ${selected.full_name || ""}`.trim();
        await reloadLabRequests(selected.id);
      },
      "label"
    );
  } catch (err) {
    console.error("❌ Prefill error:", err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     🧩 Lab Request Reload + Item Handling (Full Prefill)
  ============================================================ */
  async function reloadLabRequests(patientId) {
    labReqSelect.innerHTML = `<option value="">Loading pending requests...</option>`;
    labReqItemSelect.innerHTML = `<option value="">-- Select Test Item --</option>`;

    try {
      const res = await authFetch(`/api/lite/lab-requests?patient_id=${patientId}&status=pending`);
      const data = await res.json().catch(() => ({}));
      const recs = data?.data?.records || [];

      if (!recs.length) {
        labReqSelect.innerHTML = `<option value="">— No pending lab requests —</option>`;
        return;
      }

      labReqSelect.innerHTML =
        `<option value="">— Select Pending Request —</option>` +
        recs
          .map(
            (r) =>
              `<option value="${r.id}">
                ${r.label || `Request on ${new Date(r.date).toLocaleDateString()} (${r.status})`}
              </option>`
          )
          .join("");

      labReqSelect.onchange = (e) => {
        const selectedId = e.target.value;
        labReqItemSelect.innerHTML = `<option value="">Loading test items...</option>`;

        if (!selectedId) {
          labReqItemSelect.innerHTML = `<option value="">-- Select Test Item --</option>`;
          return;
        }

        const selectedRequest = recs.find((r) => r.id === selectedId);
        const items = selectedRequest?.items || [];
        if (!items.length) {
          labReqItemSelect.innerHTML = `<option value="">— No test items —</option>`;
        } else {
          labReqItemSelect.innerHTML =
            `<option value="">-- Select Test Item --</option>` +
            items
              .map(
                (it) =>
                  `<option value="${it.id}" data-lab-test-id="${it.lab_test_id}">
                    ${it.test || "Unnamed Test"}
                  </option>`
              )
              .join("");
        }

        // ✅ Prefill standard fields
        document.getElementById("doctorSearch").value = selectedRequest.doctor_name || "";
        document.getElementById("doctorId").value = selectedRequest.doctor_id || "";
        document.getElementById("departmentField").value = selectedRequest.department_name || "";
        document.getElementById("departmentIdHidden").value = selectedRequest.department_id || "";
        document.getElementById("consultationField").value =
          selectedRequest.consultation_date
            ? new Date(selectedRequest.consultation_date).toLocaleDateString()
            : "—";
        document.getElementById("consultationId").value = selectedRequest.consultation_id || "";
        document.getElementById("registrationLogField").value =
          selectedRequest.registration_log_code || "";
        document.getElementById("registrationLogId").value = selectedRequest.registration_log_id || "";

        // ✅ Prefill Doctor Notes (readonly) from lab request notes
        const doctorNotesInput = document.getElementById("doctor_notes");
        if (doctorNotesInput) {
          doctorNotesInput.value = selectedRequest?.notes || "";
        }

        // ✅ Clear Technician Notes (editable)
        const techNotesInput = document.getElementById("notes");
        if (techNotesInput) techNotesInput.value = "";
      };
    } catch (err) {
      console.error("❌ Error loading lab requests:", err);
      labReqSelect.innerHTML = `<option value="">— Error loading lab requests —</option>`;
    }
  }

  /* ============================================================
     ➕ Add / Update Result → Pills
  ============================================================ */
  addResultBtn?.addEventListener("click", () => {
    const mode = addResultBtn.dataset.mode || "add";
    const patientId = patientHidden.value?.trim();
    const labReqId = labReqSelect.value?.trim();
    const labReqItemId = labReqItemSelect.value?.trim();
    const doctorId = doctorHidden.value?.trim();
    const result = resultInput.value?.trim();
    const notes = notesInput.value?.trim();
    const doctorNotes = doctorNotesInput.value?.trim();
    const resultDate = resultDateInput.value || new Date().toISOString().split("T")[0];
    const file = fileInput.files?.[0] || null;

    if (!patientId) return showToast("❌ Please select a patient first");
    if (!labReqId) return showToast("❌ Please select a pending request");
    if (!labReqItemId) return showToast("❌ Please select a test item");

    // ✅ prevent duplicate items
    if (mode === "add" && selectedResults.some((r) => r.lab_request_item_id === labReqItemId)) {
      return showToast("⚠️ This test item has already been added");
    }

    const labReqLabel = labReqSelect.options[labReqSelect.selectedIndex]?.text || "";
    const labItemLabel = labReqItemSelect.options[labReqItemSelect.selectedIndex]?.text || "";

    const newResult = {
      patient_id: patientId,
      lab_request_id: labReqId,
      lab_request_item_id: labReqItemId,
      doctor_id: doctorId || null,
      result: result || "",
      notes: notes || "",
      doctor_notes: doctorNotes || "",
      result_date: resultDate,
      organization_id: orgSelect?.value || null,
      facility_id: facSelect?.value || null,
      department_id: deptSelect?.value || null,
      patient_label: patientInput.value,
      test: labItemLabel,
      request_label: labReqLabel,
      file,
    };

    selectedResults.push(newResult);

    // reset inputs
    resultInput.value = "";
    notesInput.value = "";
    doctorNotesInput.value = "";
    labReqItemSelect.value = "";
    fileInput.value = "";
    document.getElementById("attachmentPreview").innerHTML = "";
    document.getElementById("removeAttachmentBtn").classList.add("hidden");

    addResultBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Result`;
    addResultBtn.dataset.mode = "add";

    renderResultPills();
    showToast(mode === "edit" ? "✅ Updated result" : `✅ Added ${labItemLabel} to results`);
  });

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;
    try {
      showLoading();
      let url = "/api/lab-results";
      let method = "POST";
      let payload;

      if (isEdit && itemId) {
        url = `/api/lab-results/${itemId}`;
        method = "PUT";
        payload = {
          patient_id: normalizeUUID(patientHidden.value),
          lab_request_id: normalizeUUID(labReqSelect.value),
          lab_request_item_id: normalizeUUID(labReqItemSelect.value),
          doctor_id: normalizeUUID(doctorHidden.value),
          result: resultInput.value || "",
          notes: notesInput.value || "",
          doctor_notes: doctorNotesInput.value || "",
          result_date: normalizeDate(resultDateInput.value) || new Date().toISOString(),
          organization_id: normalizeUUID(orgSelect?.value),
          facility_id: normalizeUUID(facSelect?.value),
          department_id: normalizeUUID(deptSelect?.value),
        };
      } else {
        if (!selectedResults.length)
          return showToast("❌ Add at least one lab result before submitting");
        payload = selectedResults.length === 1 ? selectedResults[0] : selectedResults;
      }

      const formData = new FormData();
      if (Array.isArray(payload)) {
        payload.forEach((item, i) => {
          Object.entries(item).forEach(([k, v]) => {
            if (k !== "file" && v != null) formData.append(`results[${i}][${k}]`, v);
          });
          if (item.file) formData.append(`results[${i}][attachment]`, item.file);
        });
      } else {
        Object.entries(payload).forEach(([k, v]) => {
          if (k !== "file" && v != null) formData.append(k, v);
        });
        if (fileInput.files[0]) formData.append("attachment", fileInput.files[0]);
      }

      const res = await authFetch(url, { method, body: formData });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(isEdit ? "✅ Lab result updated" : "✅ Lab results added");

      if (isEdit) {
        sessionStorage.removeItem("labResultEditId");
        sessionStorage.removeItem("labResultEditPayload");
        window.location.href = "/lab-results-list.html";
      } else {
        selectedResults = [];
        renderResultPills();
        form.reset();
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Failed to submit lab result");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    window.location.href = "/lab-results-list.html";
  });
  clearBtn?.addEventListener("click", () => {
    form.reset();
    selectedResults = [];
    renderResultPills();
    addResultBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Result`;
    addResultBtn.dataset.mode = "add";
    setUI("add");
  });

  setupFilePreview("attachmentInput", "attachmentPreview", "removeAttachmentBtn", "attachment");
}
