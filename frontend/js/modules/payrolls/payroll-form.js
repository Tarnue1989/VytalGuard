// 📁 payroll-form.js – FULLY UPDATED (Controller-Aligned + Payment Config)

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
  loadAccountsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { PAYROLL_FORM_RULES } from "./payroll.form.rules.js";

/* ============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  try { return JSON.stringify(msg); } catch { return fallback; }
}

function normalizeUUID(val) {
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

function normalizeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================ */
export async function setupPayrollFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const payrollId =
    sessionStorage.getItem("payrollEditId") || getQueryParam("id");
  const isEdit = Boolean(payrollId);

  /* ================= UI ================= */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  if (titleEl)
    titleEl.textContent = isEdit ? "Edit Payroll" : "Add Payroll";

  if (submitBtn)
    submitBtn.innerHTML = isEdit
      ? `<i class="ri-save-3-line me-1"></i> Update Payroll`
      : `<i class="ri-add-line me-1"></i> Add Payroll`;

  /* ================= DOM ================= */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const employeeInput = document.getElementById("employeeInput");
  const employeeHidden = document.getElementById("employeeId");
  const employeeSuggestions = document.getElementById("employeeSuggestions");

  const payrollNumberInput = document.getElementById("payrollNumber");
  const periodInput = document.getElementById("period");

  const currencySelect = document.getElementById("currencySelect");

  const basicSalaryInput = document.getElementById("basicSalary");
  const allowancesInput = document.getElementById("allowances");
  const deductionsInput = document.getElementById("deductions");

  const accountSelect = document.getElementById("accountSelect");
  const paymentMethodSelect = document.getElementById("paymentMethodSelect");
  const categorySelect = document.getElementById("categorySelect");

  const descriptionInput = document.getElementById("description");

  /* ================= ROLE ================= */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ================= LOAD DROPDOWNS ================= */
  try {
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
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // ✅ Accounts (REQUIRED)
    setupSelectOptions(
      accountSelect,
      await loadAccountsLite({}, true),
      "id",
      "name",
      "-- Select Account --"
    );

    // 👤 Employee suggestion
    setupSuggestionInputDynamic(
      employeeInput,
      employeeSuggestions,
      "/api/lite/employees",
      (selected) => {
        employeeHidden.value = selected?.id || "";
        employeeInput.value =
          selected?.label ||
          `${selected?.first_name || ""} ${selected?.last_name || ""}`.trim();
      },
      "label"
    );
  } catch {
    showToast("❌ Failed to load reference data");
  }

  /* ================= PREFILL ================= */
  if (isEdit && payrollId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("payrollEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/payrolls/${payrollId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(normalizeMessage(result, "Failed to load payroll"));
        entry = result?.data;
      }

      if (!entry) return;

      employeeHidden.value = entry.employee_id || "";
      employeeInput.value = entry.employee
        ? `${entry.employee.first_name} ${entry.employee.last_name}`
        : "";

      payrollNumberInput.value = entry.payroll_number || "";
      periodInput.value = entry.period || "";
      currencySelect.value = entry.currency || "";

      basicSalaryInput.value = entry.basic_salary ?? "";
      allowancesInput.value = entry.allowances ?? "";
      deductionsInput.value = entry.deductions ?? "";

      accountSelect.value = entry.account_id || "";
      paymentMethodSelect.value = entry.payment_method || "";
      categorySelect.value = entry.category || "salary";

      descriptionInput.value = entry.description || "";

      if (isSuper) {
        orgSelect.value = entry.organization_id || "";
        facSelect.value = entry.facility_id || "";
      }
    } catch (err) {
      showToast(err.message || "❌ Could not load payroll");
    } finally {
      hideLoading();
    }
  }

  /* ================= SUBMIT ================= */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of PAYROLL_FORM_RULES) {
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
      payroll_number: payrollNumberInput.value,
      employee_id: normalizeUUID(employeeHidden.value),
      period: periodInput.value,
      currency: currencySelect.value,

      basic_salary: normalizeNumber(basicSalaryInput.value),
      allowances: normalizeNumber(allowancesInput.value) || 0,
      deductions: normalizeNumber(deductionsInput.value) || 0,

      // ✅ REQUIRED BY CONTROLLER
      account_id: normalizeUUID(accountSelect.value),
      payment_method: paymentMethodSelect.value,
      category: categorySelect.value || "salary",

      description: descriptionInput.value || null,
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const url = isEdit
        ? `/api/payrolls/${payrollId}`
        : `/api/payrolls`;

      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(isEdit ? "✅ Payroll updated" : "✅ Payroll created");

      sessionStorage.removeItem("payrollEditId");
      sessionStorage.removeItem("payrollEditPayload");

      window.location.href = "/payrolls-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };
}