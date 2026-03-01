// 📦 lab-result-form.js – Secure & Role-Aware Lab Result Form (ENTERPRISE MASTER)
// ============================================================================
// 🔹 Rule-driven validation (LAB_RESULT_FORM_RULES)
// 🔹 Role-aware org/fac handling (tenant safe)
// 🔹 Patient → Lab Request engine restored
// 🔹 Multi-result pill engine restored
// 🔹 Safe file upload + removal flags
// 🔹 Controller-faithful submission
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { LAB_RESULT_FORM_RULES } from "./lab-result.form.rules.js";

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
  return d.toISOString().slice(0, 10);
}

/* ============================================================
   💊 Pill Engine
============================================================ */
let selectedResults = [];
let pillsContainer;

function renderResultPills() {
  if (!pillsContainer) return;

  pillsContainer.innerHTML = "";

  if (!selectedResults.length) {
    pillsContainer.innerHTML =
      `<p class="text-muted">No lab results added yet.</p>`;
    return;
  }

  selectedResults.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "pill";
    div.innerHTML = `
      <strong>${item.test || "Test"}</strong> – ${item.result || "—"}
      <button type="button"
        class="btn btn-sm btn-link text-danger remove-pill"
        data-index="${index}">
        <i class="ri-close-line"></i>
      </button>
    `;
    pillsContainer.appendChild(div);
  });

  pillsContainer.querySelectorAll(".remove-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedResults.splice(btn.dataset.index, 1);
      renderResultPills();
    });
  });
}

export function getLabResultFormState() {
  return { selectedResults };
}

/* ============================================================
   🚀 MAIN SETUP
============================================================ */
export async function setupLabResultFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const itemId =
    sessionStorage.getItem("labResultEditId") || getQueryParam("id");
  const isEdit = Boolean(itemId);
  if (isEdit) {
    // Change title
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Lab Result";

    // Change submit button text
    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Lab Result`;
    }

    // Hide multi-result section
    document.getElementById("addResultBtn")?.classList.add("hidden");
    document.getElementById("resultPillsContainer")?.classList.add("hidden");
  }
  const userRole =
    (localStorage.getItem("userRole") || "").toLowerCase();

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  /* ============================================================
     🔐 Org / Facility
  ============================================================ */
  try {
    if (userRole.includes("super")) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );

      const reloadFacilities = async (orgId = null) => {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            orgId ? { organization_id: orgId } : {},
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load organization/facility data");
  }

  /* ============================================================
     🧩 Patient → Lab Request Engine
  ============================================================ */
  const patientInput = document.getElementById("patientSearch");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById(
    "patientSearchSuggestions"
  );
  const labReqSelect = document.getElementById("labRequestSelect");
  const labReqItemSelect = document.getElementById(
    "labRequestItemSelect"
  );
  const resultInput = document.getElementById("result");
  const notesInput = document.getElementById("notes");
  const doctorNotesInput =
    document.getElementById("doctor_notes");
  const resultDateInput =
    document.getElementById("result_date");
  const fileInput = document.getElementById("attachmentInput");
  const addResultBtn =
    document.getElementById("addResultBtn");

  async function reloadLabRequests(patientId) {
    labReqSelect.innerHTML =
      `<option value="">Loading pending requests...</option>`;
    labReqItemSelect.innerHTML =
      `<option value="">-- Select Test Item --</option>`;

    try {
      const orgId =
        document.getElementById("organizationSelect")?.value || "";
      const facId =
        document.getElementById("facilitySelect")?.value || "";

      // 🔒 Tenant safety guard
      if (!orgId || !facId) {
        labReqSelect.innerHTML =
          `<option value="">— Select organization & facility first —</option>`;
        return;
      }

      const queryParams = new URLSearchParams({
        patient_id: patientId,
        organization_id: orgId,
        facility_id: facId,
      });

      // Only restrict to pending in CREATE mode
      if (!isEdit) {
        queryParams.append("status", "pending");
      }

      const res = await authFetch(
        `/api/lite/lab-requests?${queryParams.toString()}`
      );

      const data = await res.json().catch(() => ({}));
      const records = data?.data?.records || [];

      if (!records.length) {
        labReqSelect.innerHTML =
          `<option value="">— No pending lab requests —</option>`;
        return;
      }

      labReqSelect.innerHTML =
        `<option value="">— Select Pending Request —</option>` +
        records
          .map(
            (r) =>
              `<option value="${r.id}">
                ${r.label ||
                  `Request on ${new Date(r.date).toLocaleDateString()} (${r.status})`}
              </option>`
          )
          .join("");
  labReqSelect.onchange = async (e) => {
    await loadLabRequestItems(e.target.value);
  };
    } catch (err) {
      console.error("❌ Lab request load failed:", err);
      labReqSelect.innerHTML =
        `<option value="">— Error loading lab requests —</option>`;
    }
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
  // 🔁 PREFILL (EDIT MODE)
  if (isEdit && itemId) {
    await loadExistingLabResult(itemId);
  }
  // Attach validation AFTER prefill is complete
  enableLiveValidation(form);
  /* ============================================================
     ➕ Add Result Button
  ============================================================ */
  pillsContainer =
    document.getElementById("resultPillsContainer");

  addResultBtn?.addEventListener("click", () => {
    const labReqItemId = labReqItemSelect.value?.trim();
    const resultVal = resultInput.value?.trim();

    if (!patientHidden.value)
      return showToast("❌ Select a patient first");
    if (!labReqSelect.value)
      return showToast("❌ Select a lab request");
    if (!labReqItemId)
      return showToast("❌ Select a test item");
    if (!resultVal)
      return showToast("❌ Enter result value");

    if (
      selectedResults.some(
        (r) => r.lab_request_item_id === labReqItemId
      )
    ) {
      return showToast("⚠️ This test item already added");
    }

    selectedResults.push({
      patient_id: patientHidden.value,
      lab_request_id: labReqSelect.value,
      lab_request_item_id: labReqItemId,
      doctor_id:
        document.getElementById("doctorId").value || null,
      result: resultVal,
      notes: notesInput.value || "",
      doctor_notes: doctorNotesInput.value || "",
      result_date:
        resultDateInput.value ||
        new Date().toISOString().slice(0, 10),
      file: fileInput.files?.[0] || null,
      test:
        labReqItemSelect.options[
          labReqItemSelect.selectedIndex
        ]?.text || "",
    });

    resultInput.value = "";
    notesInput.value = "";
    doctorNotesInput.value = "";
    fileInput.value = "";

    renderResultPills();
    showToast("✅ Result added");
  });
  async function loadLabRequestItems(labRequestId) {
    labReqItemSelect.innerHTML =
      `<option value="">Loading test items...</option>`;

    if (!labRequestId) {
      labReqItemSelect.innerHTML =
        `<option value="">-- Select Test Item --</option>`;
      return;
    }

    try {
      const orgId =
        document.getElementById("organizationSelect")?.value || "";
      const facId =
        document.getElementById("facilitySelect")?.value || "";

      const res = await authFetch(
        `/api/lite/lab-request-items?lab_request_id=${labRequestId}&organization_id=${orgId}&facility_id=${facId}`
      );

      const data = await res.json().catch(() => ({}));
      const items = data?.data?.records || [];

      if (!items.length) {
        labReqItemSelect.innerHTML =
          `<option value="">— No test items —</option>`;
        return;
      }

      labReqItemSelect.innerHTML =
        `<option value="">-- Select Test Item --</option>` +
        items
          .map(
            (it) =>
              `<option value="${it.id}">
                ${it.test || "Unnamed Test"}
              </option>`
          )
          .join("");

    } catch (err) {
      console.error("❌ Failed loading test items:", err);
      labReqItemSelect.innerHTML =
        `<option value="">— Error loading items —</option>`;
    }
  }
  async function loadExistingLabResult(id) {
    try {
      showLoading();

      const res = await authFetch(`/api/lab-results/${id}`);
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.message || "Failed to load lab result");
      }

      const record = json?.data || json;
      if (!record) throw new Error("Lab result not found");

      /* =====================================================
        🔐 ORG / FAC PREFILL (SUPERADMIN SAFE)
      ===================================================== */
      if (record.organization_id && orgSelect) {
        orgSelect.value = record.organization_id;

        if (userRole.includes("super")) {
          const facilities = await loadFacilitiesLite(
            { organization_id: record.organization_id },
            true
          );

          setupSelectOptions(
            facSelect,
            facilities,
            "id",
            "name",
            "-- Select Facility --"
          );
        }
      }

      if (record.facility_id && facSelect) {
        facSelect.value = record.facility_id;
      }

      /* =====================================================
        👤 PATIENT PREFILL
      ===================================================== */
      if (record.patient) {
        patientHidden.value = record.patient.id;
        patientInput.value =
          `${record.patient.pat_no} - ${record.patient.first_name} ${record.patient.last_name}`;
      }

      /* =====================================================
        🧪 LOAD LAB REQUESTS FOR PATIENT
      ===================================================== */
      // Ensure current lab request exists in dropdown (even if not returned by lite endpoint)
      if (record.lab_request_id) {
        const exists = Array.from(labReqSelect.options).some(
          (opt) => opt.value === record.lab_request_id
        );

        if (!exists) {
          const option = document.createElement("option");
          option.value = record.lab_request_id;

          // Use readable values from record
          const readableLabel =
            record.lab_request?.label ||
            record.lab_request?.test ||
            `Request on ${new Date(record.created_at).toLocaleDateString()}`;

          option.textContent = readableLabel;

          labReqSelect.appendChild(option);
        }
      }
      /* =====================================================
        🧾 SELECT LAB REQUEST
      ===================================================== */
      if (record.lab_request_id) {

        // Wait one tick to ensure options are fully rendered
        await new Promise(resolve => setTimeout(resolve, 0));

        labReqSelect.value = record.lab_request_id;

        // Force change event so DOM locks selection
        labReqSelect.dispatchEvent(new Event("change"));

        await loadLabRequestItems(record.lab_request_id);
      }
      /* =====================================================
        🧬 SELECT LAB REQUEST ITEM
      ===================================================== */
      if (record.lab_request_item_id) {
        labReqItemSelect.value = record.lab_request_item_id;
      }

      /* =====================================================
        📝 RESULT FIELDS
      ===================================================== */
      resultInput.value = record.result || "";
      notesInput.value = record.notes || "";
      doctorNotesInput.value = record.doctor_notes || "";

      if (record.result_date) {
        resultDateInput.value = record.result_date.slice(0, 10);
      }

    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to prefill lab result");
    } finally {
      hideLoading();
    }
  }
  /* ============================================================
     🛡️ Validation + Submit
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of LAB_RESULT_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when())
        continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (rule.id === "resultPillsContainer") continue;

      if (!el || !el.value || el.value.trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (!isEdit && !selectedResults.length) {
      errors.push({
        field: "resultPillsContainer",
        message:
          "Add at least one lab result before submitting",
      });
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix highlighted fields");
      return;
    }

    try {
      showLoading();

      const method = isEdit ? "PUT" : "POST";
      const url = isEdit
        ? `/api/lab-results/${itemId}`
        : `/api/lab-results`;

      const formData = new FormData();

      if (isEdit) {
        formData.append(
          "patient_id",
          normalizeUUID(patientHidden.value)
        );
        formData.append(
          "lab_request_id",
          normalizeUUID(labReqSelect.value)
        );
        formData.append(
          "lab_request_item_id",
          normalizeUUID(labReqItemSelect.value)
        );
        const doctorVal = normalizeUUID(
          document.getElementById("doctorId").value
        );

        if (doctorVal) {
          formData.append("doctor_id", doctorVal);
        }
        formData.append("result", resultInput.value);
        formData.append("notes", notesInput.value);
        formData.append(
          "doctor_notes",
          doctorNotesInput.value
        );
        formData.append(
          "result_date",
          normalizeDate(resultDateInput.value)
        );
      } else {
      selectedResults.forEach((item, i) => {
        const orgId = orgSelect?.value || null;
        const facId = facSelect?.value || null;

        Object.entries(item).forEach(([k, v]) => {
          if (k !== "file" && v != null) {
            formData.append(`results[${i}][${k}]`, v);
          }
        });

        // 🔐 REQUIRED FOR SUPERADMIN
        if (orgId) {
          formData.append(`results[${i}][organization_id]`, orgId);
        }

        if (facId) {
          formData.append(`results[${i}][facility_id]`, facId);
        }

        if (item.file) {
          formData.append(`results[${i}][attachment]`, item.file);
        }
      });
      }

      const res = await authFetch(url, {
        method,
        body: formData,
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        applyServerErrors(form, result?.errors);
        throw new Error(
          normalizeMessage(result, "Submission failed")
        );
      }

      showToast(
        isEdit
          ? "✅ Lab result updated"
          : "✅ Lab results added"
      );

      window.location.href = "/lab-results-list.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };
} 