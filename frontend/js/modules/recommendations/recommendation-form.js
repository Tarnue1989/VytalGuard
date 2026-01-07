// 📁 recommendation-form.js – Handles add/edit form for Recommendation

import { showToast, showLoading, hideLoading } from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

// 🔎 Extract query param
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// 🛠 Normalize message
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

// 🛠 Normalize UUID values
function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}

// 🚀 Initialize Recommendation form
export async function setupRecommendationFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("recommendationEditId");
  const queryId = getQueryParam("id");
  const recId = sessionId || queryId;
  const isEdit = !!recId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  function setAddModeUI() {
    if (titleEl) titleEl.textContent = "Add Recommendation";
    if (submitBtn) {
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Recommendation`;
    }
  }
  function setEditModeUI() {
    if (titleEl) titleEl.textContent = "Edit Recommendation";
    if (submitBtn) {
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Recommendation`;
    }
  }
  isEdit ? setEditModeUI() : setAddModeUI();

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  // Doctor fields
  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");
  const doctorFieldGroup = document.getElementById("doctorFieldGroup");

  // Consultation field
  const consultationInput = document.getElementById("consultationInput");
  const consultationHidden = document.getElementById("consultationId");
  const consultationSuggestions = document.getElementById("consultationSuggestions");
  const consultationFieldGroup = document.getElementById("consultationFieldGroup");

  let role = "staff";
  try {
    const roleRaw = (localStorage.getItem("userRole") || "").toLowerCase();
    if (roleRaw.includes("super") && roleRaw.includes("admin")) role = "superadmin";
    else if (roleRaw.includes("admin")) role = "admin";

    // ✅ Superadmins → org + facility cascade
    if (role === "superadmin") {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId) {
        facSelect.innerHTML = `<option value="">-- Select Facility --</option>`;
        if (!orgId) return;
        const facs = await loadFacilitiesLite({ organization_id: orgId }, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facilities = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facilities, "id", "name", "-- Select Facility --");
    }

    // ✅ Patient suggestions
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        if (selected) {
          patientInput.value =
            selected.label ||
            (selected.pat_no && selected.full_name
              ? `${selected.pat_no} - ${selected.full_name}`
              : selected.full_name || selected.pat_no || "");
        }
      },
      "label"
    );

    // ✅ Doctor selection (only for admin/superadmin)
    if (role === "admin" || role === "superadmin") {
      doctorFieldGroup?.classList.remove("hidden");

      setupSuggestionInputDynamic(
        doctorInput,
        doctorSuggestions,
        "/api/lite/employees",
        (selected) => {
          doctorHidden.value = selected?.id || "";
          if (selected) {
            doctorInput.value =
              selected.full_name ||
              `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
          }
        },
        "full_name"
      );
    } else {
      doctorFieldGroup?.classList.add("hidden");
      const employeeId = localStorage.getItem("employeeId");
      doctorHidden.value = employeeId || "";
    }

    // ✅ Department
    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    // ✅ Consultation link (admin/superadmin only)
    if (role === "admin" || role === "superadmin") {
      consultationFieldGroup?.classList.remove("hidden");

      setupSuggestionInputDynamic(
        consultationInput,
        consultationSuggestions,
        "/api/lite/consultations",
        (selected) => {
          consultationHidden.value = selected?.id || "";
          if (selected) {
            consultationInput.value = `${selected.id} (${selected.status})`;
          }
        },
        "id"
      );
    } else {
      consultationFieldGroup?.classList.add("hidden");
      consultationHidden.value = "";
    }
  } catch (err) {
    console.error("❌ Failed to load dropdowns:", err);
    showToast("❌ Failed to load reference lists");
  }

  // 🔎 Prefill if editing
  if (isEdit) {
    try {
      let entry = null;
      const raw = sessionStorage.getItem("recommendationEditPayload");
      if (raw) entry = JSON.parse(raw);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/recommendations/${recId}`);
        let result = {};
        try {
          result = await res.json();
        } catch {}
        entry = result?.data;
        if (!res.ok || !entry) {
          throw new Error(
            normalizeMessage(result, `❌ Failed to load recommendation (${res.status})`)
          );
        }
      }

      // Prefill logic...
      patientHidden.value = entry.patient_id || "";
      if (entry.patient) {
        patientInput.value =
          entry.patient.label ||
          (entry.patient.pat_no && entry.patient.full_name
            ? `${entry.patient.pat_no} - ${entry.patient.full_name}`
            : entry.patient.full_name || entry.patient.pat_no || "");
      }
      doctorHidden.value = entry.doctor_id || doctorHidden.value;
      if (entry.doctor && !doctorFieldGroup?.classList.contains("hidden")) {
        doctorInput.value =
          entry.doctor.full_name ||
          `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();
      }
      if (entry.organization_id && orgSelect) {
        orgSelect.value = entry.organization_id;
        const facs = await loadFacilitiesLite({ organization_id: entry.organization_id }, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      if (entry.facility_id) facSelect.value = entry.facility_id;
      if (entry.department_id) deptSelect.value = entry.department_id;
      if (entry.consultation_id) consultationHidden.value = entry.consultation_id;
      if (entry.recommendation_date)
        document.getElementById("recommendationDate").value =
          entry.recommendation_date.split("T")[0];
      if (entry.reason)
        document.getElementById("recommendationReason").value = entry.reason;
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load recommendation");
    } finally {
      hideLoading();
    }
  }

  // 🚀 Submit handler
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      patient_id: normalizeUUID(patientHidden.value),
      doctor_id: normalizeUUID(doctorHidden.value),
      organization_id: normalizeUUID(orgSelect?.value),
      facility_id: normalizeUUID(facSelect?.value),
      department_id: normalizeUUID(deptSelect?.value),
      consultation_id: normalizeUUID(consultationHidden.value),
      recommendation_date: document.getElementById("recommendationDate")?.value || null,
      reason: document.getElementById("recommendationReason")?.value || null,
    };

    if (!payload.patient_id) {
      showToast("❌ Patient is required");
      patientInput?.focus();
      return;
    }
    if (!payload.doctor_id) {
      showToast("❌ Doctor could not be resolved");
      return;
    }

    // 🔒 Superadmin must select org + facility
    if (role === "superadmin") {
      if (!payload.organization_id) {
        showToast("❌ Organization is required for superadmin");
        orgSelect?.focus();
        return;
      }
      if (!payload.facility_id) {
        showToast("❌ Facility is required for superadmin");
        facSelect?.focus();
        return;
      }
    }

    const url = isEdit ? `/api/recommendations/${recId}` : `/api/recommendations`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let result = {};
      try {
        result = await res.json();
      } catch {}

      if (!res.ok) {
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));
      }

      if (isEdit) {
        showToast(`✅ Recommendation updated successfully`);
        sessionStorage.removeItem("recommendationEditId");
        sessionStorage.removeItem("recommendationEditPayload");
        window.location.href = "/recommendations-list.html";
      } else {
        showToast(`✅ Recommendation created successfully`);
        form.reset();
        setAddModeUI();
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  // 🚪 Clear
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("recommendationEditId");
    sessionStorage.removeItem("recommendationEditPayload");
    form.reset();
    setAddModeUI();
  });

  // 🚪 Cancel
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("recommendationEditId");
    sessionStorage.removeItem("recommendationEditPayload");
    window.location.href = "/recommendations-list.html";
  });
}
