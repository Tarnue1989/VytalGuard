// 📁 expense-form.js – Secure & Role-Aware Expense Form (ENTERPRISE MASTER)
// ============================================================================
// 🔹 FULL parity with deposit-form.js MASTER
// 🔹 Rule-driven validation (EXPENSE_FORM_RULES)
// 🔹 Role-aware org/fac handling
// 🔹 Clean payload normalization
// 🔹 Controller-faithful (NO hidden logic)
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
  loadAccountsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { EXPENSE_FORM_RULES } from "./expense-form-rules.js";

/* ============================================================ */
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
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

function normalizeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================ */
export async function setupExpenseFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const expenseId =
    sessionStorage.getItem("expenseEditId") || getQueryParam("id");
  const isEdit = Boolean(expenseId);

  /* ================= UI ================= */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent = mode === "edit" ? "Edit Expense" : "Add Expense";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Expense`
          : `<i class="ri-add-line me-1"></i> Add Expense`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ================= DOM ================= */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const accountSelect = document.getElementById("accountSelect");
  const categorySelect = document.getElementById("categorySelect");

  const expenseNumberInput = document.getElementById("expenseNumber");
  const dateInput = document.getElementById("date");
  const amountInput = document.getElementById("amount");
  const currencySelect = document.getElementById("currencySelect");
  const paymentMethodSelect = document.getElementById("paymentMethodSelect");
  const descriptionInput = document.getElementById("description");

  /* ================= ROLE ================= */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ================= DROPDOWNS ================= */
  try {
    /* 🔥 Accounts (DataLoader SAFE) */
    const accounts = await loadAccountsLite();
    setupSelectOptions(
      accountSelect,
      accounts,
      "id",
      "name",
      "-- Select Account --"
    );

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
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ================= PREFILL ================= */
  if (isEdit && expenseId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("expenseEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/expenses/${expenseId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            normalizeMessage(result, "Failed to load expense")
          );
        entry = result?.data;
      }

      if (!entry) return;

      expenseNumberInput.value = entry.expense_number || "";
      dateInput.value = entry.date || "";
      amountInput.value = entry.amount ?? "";
      currencySelect.value = entry.currency || "";
      categorySelect.value = entry.category || "";
      paymentMethodSelect.value = entry.payment_method || "";
      descriptionInput.value = entry.description || "";

      if (accountSelect) accountSelect.value = entry.account_id || "";

      if (isSuper) {
        if (orgSelect && entry.organization_id)
          orgSelect.value = entry.organization_id;
        if (facSelect && entry.facility_id)
          facSelect.value = entry.facility_id;
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load expense");
    } finally {
      hideLoading();
    }
  }

  /* ================= SUBMIT ================= */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of EXPENSE_FORM_RULES) {
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
      date: dateInput.value || null,
      amount: normalizeNumber(amountInput.value),
      currency: currencySelect.value || null,
      category: categorySelect.value || null,
      payment_method: paymentMethodSelect.value || null,
      account_id: normalizeUUID(accountSelect.value),
      description: descriptionInput.value || null,
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const url = isEdit
        ? `/api/expenses/${expenseId}`
        : `/api/expenses`;
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

      showToast(isEdit ? "✅ Expense updated" : "✅ Expense created");

      sessionStorage.removeItem("expenseEditId");
      sessionStorage.removeItem("expenseEditPayload");

      window.location.href = "/expenses-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ================= CANCEL / CLEAR ================= */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/expenses-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
  });
}