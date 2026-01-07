// 📁 appointment-form.js – Handles Add/Edit Appointment Form (permission-driven)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
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
   🧩 Helpers
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

/* ============================================================
   🚀 Main setup
   ============================================================ */
export async function setupAppointmentFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("appointmentEditId");
  const queryId = getQueryParam("id");
  const appointmentId = sessionId || queryId;
  const isEdit = !!appointmentId;

  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey(["appointments:create", "appointments:edit"]));

  // 🧾 Debug snapshot
  console.groupCollapsed("📋 [setupAppointmentFormSubmission] State Snapshot");
  console.log("appointmentId:", appointmentId);
  console.log("isEdit:", isEdit);
  console.groupEnd();

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  const setAddModeUI = () => {
    if (titleEl) titleEl.textContent = "Add Appointment";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Appointment`;
  };
  const setEditModeUI = () => {
    if (titleEl) titleEl.textContent = "Edit Appointment";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Appointment`;
  };
  isEdit ? setEditModeUI() : setAddModeUI();

  // 📋 DOM Refs
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");
  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");

  /* ============================================================
     🔽 Prefill dropdowns + suggestion inputs
     ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      // 🏢 Superadmin → org + facility cascade
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
      // 🧑‍💼 Admin → Only facilities
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facilities = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facilities, "id", "name", "-- Select Facility --");
    } else {
      // 🧑‍⚕️ Staff / Doctor / Facility Head
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

    // ✅ Patient
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected?.label ||
          (selected?.pat_no && selected?.full_name
            ? `${selected.pat_no} - ${selected.full_name}`
            : selected?.full_name || selected?.pat_no || "");
      },
      "label"
    );

    // ✅ Doctor
    setupSuggestionInputDynamic(
      doctorInput,
      doctorSuggestions,
      "/api/lite/employees",
      (selected) => {
        doctorHidden.value = selected?.id || "";
        doctorInput.value =
          selected?.full_name ||
          `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
      },
      "full_name"
    );
  } catch (err) {
    console.error("❌ Dropdown load failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     🧩 Prefill if editing
     ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      let entry = null;
      const raw = sessionStorage.getItem("appointmentEditPayload");
      if (raw) entry = JSON.parse(raw);

      if (!entry) {
        const res = await authFetch(`/api/appointments/${appointmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(
            normalizeMessage(result, `❌ Failed to load appointment (${res.status})`)
          );
      }

      // 🧾 Populate fields
      patientHidden.value = entry.patient_id || "";
      doctorHidden.value = entry.doctor_id || "";
      document.getElementById("dateTime").value =
        entry.date_time?.split("Z")[0] || "";
      document.getElementById("notes").value = entry.notes || "";

      if (entry.patient)
        patientInput.value =
          entry.patient.label ||
          `${entry.patient.pat_no || ""} - ${entry.patient.full_name || ""}`.trim();

      if (entry.doctor)
        doctorInput.value =
          entry.doctor.full_name ||
          `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();

      if (entry.organization_id && orgSelect) {
        orgSelect.value = entry.organization_id;
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization_id },
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      if (entry.facility_id) facSelect.value = entry.facility_id;
      if (entry.department_id) deptSelect.value = entry.department_id;
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load appointment");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit Handler
     ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const organizationId =
      orgSelect?.value || localStorage.getItem("organizationId");
    const facilityId =
      facSelect?.value || localStorage.getItem("facilityId");

    const payload = {
      organization_id: normalizeUUID(organizationId),
      facility_id: normalizeUUID(facilityId),
      patient_id: normalizeUUID(patientHidden.value),
      doctor_id: normalizeUUID(doctorHidden.value),
      department_id: normalizeUUID(deptSelect?.value),
      date_time: document.getElementById("dateTime")?.value || null,
      notes: document.getElementById("notes")?.value || null,
    };

    console.groupCollapsed("🧾 [Appointment Submit Payload]");
    console.log(payload);
    console.groupEnd();

    // 🧩 Validation
    if (!payload.organization_id) return showToast("❌ Organization is required");
    if (!payload.facility_id) return showToast("❌ Facility is required");
    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.doctor_id) return showToast("❌ Doctor is required");
    if (!payload.date_time) return showToast("❌ Date/Time is required");

    const url = isEdit
      ? `/api/appointments/${appointmentId}`
      : `/api/appointments`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Appointment updated successfully");
        sessionStorage.removeItem("appointmentEditId");
        sessionStorage.removeItem("appointmentEditPayload");
        window.location.href = "/appointments-list.html";
      } else {
        showToast("✅ Appointment created successfully");
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

  /* ============================================================
     🚪 Clear / Cancel Buttons
     ============================================================ */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("appointmentEditId");
    sessionStorage.removeItem("appointmentEditPayload");
    form.reset();
    setAddModeUI();
  });

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("appointmentEditId");
    sessionStorage.removeItem("appointmentEditPayload");
    window.location.href = "/appointments-list.html";
  });
}