// 📁 appointment-form.js – Secure & Role-Aware Appointment Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 FULL parity with consultation-form.js MASTER
// 🔹 Rule-driven validation (APPOINTMENT_FORM_RULES)
// 🔹 Role-aware org/fac handling (SUPER / ORG ADMIN / FACILITY)
// 🔹 Clean payload normalization (UUID | null | datetime)
// 🔹 Controller-faithful (no HTML validation, no silent rules)
// 🔹 Preserves ALL existing DOM IDs, API calls, and wiring
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
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
  loadDepartmentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { APPOINTMENT_FORM_RULES } from "./appointment.form.rules.js";

/* ============================================================
   🧩 Helpers (MASTER)
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
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

function normalizeDateTime(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function buildPersonName(obj) {
  if (!obj) return "";
  return [obj.first_name, obj.middle_name, obj.last_name]
    .filter(Boolean)
    .join(" ");
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupAppointmentFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const apptId =
    sessionStorage.getItem("appointmentEditId") || getQueryParam("id");
  const isEdit = Boolean(apptId);

  /* ============================================================
     🎨 UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Appointment" : "Add Appointment";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Appointment`
          : `<i class="ri-add-line me-1"></i> Add Appointment`;
  };

  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");
  const doctorFieldGroup = doctorInput?.closest(".form-group");

  const dateInput = document.getElementById("dateTime");
  const notesInput = document.getElementById("notes");

  /* ============================================================
     👥 Role
  ============================================================ */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ============================================================
    🌐 Dropdowns & Suggestions (MASTER – VERIFIED)
  ============================================================ */
  try {
    /* ================= ORGANIZATION / FACILITY ================= */
    if (isSuper) {
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
      // 🔒 Non-super users: org/fac fixed by backend scope
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    /* ================= DEPARTMENT ================= */
    setupSelectOptions(
      deptSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    /* ================= PATIENT SUGGESTION ================= */
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected?.label ||
          `${selected?.pat_no || ""} ${buildPersonName(selected)}`.trim();
      },
      "label"
    );

    // Clear patient ID if user edits text
    patientInput.addEventListener("input", () => {
      patientHidden.value = "";
    });

    /* ================= DOCTOR SUGGESTION (ALL ROLES) ================= */
    // ✅ Doctor search MUST be enabled for all roles
    doctorFieldGroup?.classList.remove("hidden");

    setupSuggestionInputDynamic(
      doctorInput,
      doctorSuggestions,
      "/api/lite/employees",
      (selected) => {
        doctorHidden.value = selected?.id || "";
        doctorInput.value =
          selected?.full_name || buildPersonName(selected);
      },
      "full_name"
    );

    // Clear doctor ID if user edits text
    doctorInput.addEventListener("input", () => {
      doctorHidden.value = "";
    });

  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
    ✏️ PREFILL (EDIT MODE) — MASTER FIXED
  ============================================================ */
  if (isEdit && apptId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("appointmentEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/appointments/${apptId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            normalizeMessage(result, "Failed to load appointment")
          );
        }
        entry = result?.data;
      }

      if (!entry) return;

      /* ---------------- Patient ---------------- */
      patientHidden.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no || ""} ${buildPersonName(entry.patient)}`.trim()
        : "";

      /* ---------------- Doctor (REQUIRED FOR ALL ROLES) ---------------- */
      if (entry.doctor) {
        doctorHidden.value = entry.doctor.id || "";
        doctorInput.value = buildPersonName(entry.doctor);
      } else {
        doctorHidden.value = "";
        doctorInput.value = "";
      }

      /* ---------------- Org / Facility (SUPER ONLY) ---------------- */
      if (isSuper) {
        if (orgSelect && entry.organization_id) {
          orgSelect.value = entry.organization_id;
        }
        if (facSelect && entry.facility_id) {
          facSelect.value = entry.facility_id;
        }
      }

      /* ---------------- Other Fields ---------------- */
      deptSelect.value = entry.department_id || "";
      dateInput.value = entry.date_time
        ? entry.date_time.replace("Z", "")
        : "";
      notesInput.value = entry.notes || "";

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load appointment");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT — RULE-DRIVEN (MASTER PARITY)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of APPOINTMENT_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el) continue;
      if (el.closest(".hidden")) continue;

      if (!el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      patient_id: normalizeUUID(patientHidden.value),

      // ✅ REQUIRED FOR ALL ROLES
      doctor_id: normalizeUUID(doctorHidden.value),

      department_id: normalizeUUID(deptSelect.value),
      date_time: normalizeDateTime(dateInput.value),
      notes: notesInput.value || null,
    };

    // 🔒 SUPERADMIN-ONLY SCOPE OVERRIDES
    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const url = isEdit
        ? `/api/appointments/${apptId}`
        : `/api/appointments`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );
      }

      showToast(
        isEdit ? "✅ Appointment updated" : "✅ Appointment created"
      );

      sessionStorage.removeItem("appointmentEditId");
      sessionStorage.removeItem("appointmentEditPayload");

      if (isEdit) {
        window.location.href = "/appointments-list.html";
      } else {
        clearFormErrors(form);
        form.reset();
        setUI("add");
      }
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ CANCEL / CLEAR
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/appointments-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
  });
}
