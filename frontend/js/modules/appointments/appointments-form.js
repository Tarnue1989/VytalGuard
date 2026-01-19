// 📁 appointment-form.js – Add/Edit Appointment (ENTERPRISE MASTER-ALIGNED)
// ============================================================================
// 🧭 Mirrors feature-access-form.js lifecycle + discipline
// 🔹 Rule-driven validation (no silent coercion)
// 🔹 Live validation + red fields
// 🔹 Superadmin-aware org/facility handling
// 🔹 Safe add/edit flow with payload parity
// 🔹 Controller-faithful submission
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
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

import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { APPOINTMENT_FORM_RULES } from "./appointment.form.rules.js";

/* ============================================================
   🧩 Helpers (MASTER parity)
============================================================ */
const qp = k => new URLSearchParams(location.search).get(k);
const uuid = v => (v && v.toString().trim() !== "" ? v : null);

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

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupAppointmentFormSubmission({ form }) {
  const id =
    sessionStorage.getItem("appointmentEditId") || qp("id");
  const isEdit = Boolean(id);

  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  enableLiveValidation(form);

  /* ================= UI ================= */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setTitle = (text, icon) => {
    if (titleEl) titleEl.textContent = text;
    if (submitBtn)
      submitBtn.innerHTML = `<i class="${icon} me-1"></i>${text}`;
  };

  setTitle(
    isEdit ? "Edit Appointment" : "Add Appointment",
    "ri-save-3-line"
  );

  /* ================= DOM ================= */
  const orgSel = document.getElementById("organizationSelect");
  const facSel = document.getElementById("facilitySelect");
  const deptSel = document.getElementById("departmentSelect");

  const patientIn = document.getElementById("patientInput");
  const patientId = document.getElementById("patientId");
  const patientSug = document.getElementById("patientSuggestions");

  const doctorIn = document.getElementById("doctorInput");
  const doctorId = document.getElementById("doctorId");
  const doctorSug = document.getElementById("doctorSuggestions");

  const dateEl = document.getElementById("dateTime");
  const notesEl = document.getElementById("notes");

  const role = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🔽 Dropdowns & Suggestions
  ============================================================ */
  try {
    const hide = el =>
      el?.closest(".form-group")?.classList.add("hidden");

    if (role.includes("super")) {
      setupSelectOptions(
        orgSel,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );

      const loadFacilities = async (orgId = null) =>
        setupSelectOptions(
          facSel,
          await loadFacilitiesLite(
            orgId ? { organization_id: orgId } : {},
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );

      await loadFacilities();
      orgSel?.addEventListener("change", () =>
        loadFacilities(orgSel.value || null)
      );
    } else if (role.includes("admin")) {
      hide(orgSel);
      setupSelectOptions(
        facSel,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    } else {
      hide(orgSel);
      hide(facSel);
    }

    setupSelectOptions(
      deptSel,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    setupSuggestionInputDynamic(
      patientIn,
      patientSug,
      "/api/lite/patients",
      s => {
        patientId.value = s?.id || "";
        patientIn.value = s?.label || "";
      },
      "label"
    );

    setupSuggestionInputDynamic(
      doctorIn,
      doctorSug,
      "/api/lite/employees",
      s => {
        doctorId.value = s?.id || "";
        doctorIn.value =
          s?.full_name ||
          `${s?.first_name || ""} ${s?.last_name || ""}`.trim();
      },
      "full_name"
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load form data");
  }

  /* ============================================================
     ✏️ Prefill (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry = JSON.parse(
        sessionStorage.getItem("appointmentEditPayload") || "null"
      );

      if (!entry) {
        const res = await authFetch(`/api/appointments/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok)
          throw new Error(
            normalizeMessage(json, "Failed to load appointment")
          );
        entry = json?.data;
      }

      patientId.value = entry.patient_id || "";
      doctorId.value = entry.doctor_id || "";
      dateEl.value = entry.date_time?.split("Z")[0] || "";
      notesEl.value = entry.notes || "";

      if (entry.patient)
        patientIn.value =
          `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim();

      if (entry.doctor)
        doctorIn.value =
          entry.doctor.full_name ||
          `${entry.doctor.first_name || ""} ${entry.doctor.last_name || ""}`.trim();

      if (entry.organization_id && orgSel) {
        orgSel.value = entry.organization_id;

        await setupSelectOptions(
          facSel,
          await loadFacilitiesLite(
            { organization_id: entry.organization_id },
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );
      }

      facSel && (facSel.value = entry.facility_id || "");
      deptSel && (deptSel.value = entry.department_id || "");
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load appointment");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     📤 Submit (RULE-DRIVEN)
  ============================================================ */
  form.onsubmit = async e => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of APPOINTMENT_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || el.value === null || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      organization_id: uuid(
        orgSel?.value || localStorage.getItem("organizationId")
      ),
      facility_id: uuid(
        facSel?.value || localStorage.getItem("facilityId")
      ),
      patient_id: uuid(patientId.value),
      doctor_id: uuid(doctorId.value),
      department_id: uuid(deptSel?.value),
      date_time: dateEl.value || null,
      notes: notesEl.value || null,
    };

    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/appointments/${id}` : `/api/appointments`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok)
        throw new Error(
          normalizeMessage(json, "Appointment submission failed")
        );

      showToast(
        isEdit
          ? "✅ Appointment updated successfully"
          : "✅ Appointment created successfully"
      );

      sessionStorage.clear();
      window.location.href = "/appointments-list.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚫 Cancel / Reset
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/appointments-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    clearFormErrors(form);
    form.reset();
    setTitle("Add Appointment", "ri-save-3-line");
  });
}
