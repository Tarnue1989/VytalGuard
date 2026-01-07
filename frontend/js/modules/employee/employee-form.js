// 📦 employee-form.js – Secure & Role-Aware Employee Form (Enterprise Master Pattern)
// ============================================================================
// 🔹 Controller-faithful validation (NO silent failures)
// 🔹 FULL Form UX util integration
// 🔹 Role-aware org/fac handling
// 🔹 Submit ALWAYS enabled (user sees feedback on click)
// 🔹 Facility OPTIONAL for all roles (backend enforces position rules)
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
  loadEmployeePositionsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";
import { setupFilePreview } from "../../utils/file-preview.js";
import { EMPLOYEE_FORM_RULES } from "./employee.form.rules.js";

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
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

function normalizeDate(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupEmployeeFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const empId = sessionStorage.getItem("employeeEditId") || getQueryParam("id");
  const isEdit = Boolean(empId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setFormTitle = (txt, icon) => {
    if (titleEl) titleEl.textContent = txt;
    if (submitBtn) submitBtn.innerHTML = `<i class="${icon} me-1"></i> ${txt}`;
  };

  setFormTitle(isEdit ? "Update Employee" : "Add Employee", "ri-save-3-line");

  /* ---------------- DOM Refs ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const depSelect = document.getElementById("departmentSelect");
  const posSelect = document.getElementById("position");
  const genderSelect = document.getElementById("gender");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🔐 ROLE-AWARE DROPDOWNS
  ============================================================ */
  try {
    const hideOrg = () =>
      orgSelect?.closest(".form-group")?.classList.add("hidden");
    const hideFac = () =>
      facSelect?.closest(".form-group")?.classList.add("hidden");

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
    } else if (userRole.includes("admin")) {
      hideOrg();
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    } else {
      hideOrg();
      hideFac();
    }

    setupSelectOptions(
      depSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    setupSelectOptions(
      posSelect,
      await loadEmployeePositionsLite({}, true),
      "id",
      "name",
      "-- Select Position --"
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load dropdown data");
  }

  /* ============================================================
     📎 FILE PREVIEWS
  ============================================================ */
  setupFilePreview("photoInput", "photoPreview", "removePhotoBtn", "photo_path");
  setupFilePreview("resumeInput", "resumePreview", "removeResumeBtn", "resume_url");
  setupFilePreview("documentInput", "documentPreview", "removeDocumentBtn", "document_url");

  /* ============================================================
    ✏️ PREFILL (EDIT MODE) — FULL & CORRECT
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      const res = await authFetch(`/api/employees/${empId}`);
      const { data: entry } = await res.json();
      if (!entry) throw new Error("Employee not found");

      /* ---------------- BASIC FIELDS ---------------- */
      [
        "first_name","middle_name","last_name","phone","email","address",
        "employee_no","license_no","specialty","certifications",
        "emergency_contact_name","emergency_contact_phone"
      ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = entry[id] || "";
      });

      /* ---------------- DATE FIELDS ---------------- */
      ["dob","hire_date","termination_date"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = normalizeDate(entry[id]);
      });

      /* ---------------- SIMPLE SELECTS ---------------- */
      if (posSelect) posSelect.value = entry.position || "";
      if (genderSelect) genderSelect.value = entry.gender || "";

      /* =================================================
        🏢 TENANT SELECTS (ORDER MATTERS)
      ================================================= */

      const orgId = entry.organization_id || entry.organization?.id || null;
      const facId = entry.facility_id || entry.facility?.id || null;
      const depId = entry.department_id || entry.department?.id || null;

      /* -------- Organization -------- */
      if (orgSelect && orgId) {
        const orgs = await loadOrganizationsLite();
        setupSelectOptions(
          orgSelect,
          orgs,
          "id",
          "name",
          "-- Select Organization --"
        );
        orgSelect.value = orgId;
        orgSelect.dispatchEvent(new Event("change"));
      }

      /* -------- Facility (optional) -------- */
      if (facSelect) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(
          facSelect,
          facs,
          "id",
          "name",
          "-- Select Facility --"
        );
        if (facId) facSelect.value = facId;
      }

      /* -------- Department (FIXED BUG) -------- */
      if (depSelect) {
        const depts = await loadDepartmentsLite({}, true);
        setupSelectOptions(
          depSelect,
          depts,
          "id",
          "name",
          "-- Select Department --"
        );
        if (depId) depSelect.value = depId;
      }

      /* ---------------- UI STATE ---------------- */
      setFormTitle("Update Employee", "ri-save-3-line");

    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load employee");
    } finally {
      hideLoading();
    }
  }


  /* ============================================================
    🛡️ SUBMIT — ALWAYS ENABLED, RULE-DRIVEN, ALL ERRORS SHOWN
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    // ✅ RULE-DRIVEN VALIDATION (single source of truth)
    for (const rule of EMPLOYEE_FORM_RULES) {
      // skip rule if conditional and not active
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({
          field: rule.id,
          message: rule.message,
        });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const method = isEdit ? "PUT" : "POST";
    const url = isEdit ? `/api/employees/${empId}` : `/api/employees`;
    const formData = new FormData(form);

    // 🔐 Only send user-controlled tenant fields
    if (!userRole.includes("super")) formData.delete("organization_id");
    if (!userRole.includes("super") && !userRole.includes("admin")) {
      formData.delete("facility_id");
    }

    try {
      showLoading();
      const res = await authFetch(url, { method, body: formData });
      const result = await res.json();

      if (!res.ok) {
        applyServerErrors(form, result?.errors);
        throw new Error(normalizeMessage(result, "Submission failed"));
      }

      showToast(isEdit ? "✅ Employee updated" : "✅ Employee created");
      sessionStorage.clear();
      window.location.href = "/employees-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ CANCEL / CLEAR
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/employees-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setFormTitle("Add Employee", "ri-save-3-line");
  });
}
