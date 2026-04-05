// 📁 deposit-form.js – Secure & Role-Aware Deposit Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 FULL parity with consultation-form.js MASTER
// 🔹 Rule-driven validation (DEPOSIT_FORM_RULES)
// 🔹 Role-aware org/fac handling (SUPER ONLY)
// 🔹 Clean payload normalization (UUID | number | null)
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { DEPOSIT_FORM_RULES } from "./deposit.form.rules.js";

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

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupDepositFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const depositId =
    sessionStorage.getItem("depositEditId") || getQueryParam("id");
  const isEdit = Boolean(depositId);

  /* ============================================================
     🎨 UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");
  const reasonGroup = document.getElementById("reasonGroup");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent = mode === "edit" ? "Edit Deposit" : "Add Deposit";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Deposit`
          : `<i class="ri-add-line me-1"></i> Add Deposit`;
    if (reasonGroup)
      reasonGroup.classList.toggle("hidden", mode !== "edit");
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const appliedInvoiceHidden = document.getElementById("appliedInvoiceId");
  const amountInput = document.getElementById("amount");
  const currencySelect = document.getElementById("currencySelect");
  const methodSelect = document.getElementById("methodSelect");
  const transactionRefInput = document.getElementById("transactionRef");
  const notesInput = document.getElementById("notes");
  const reasonInput = document.getElementById("reason");

  /* ============================================================
     👥 Role
  ============================================================ */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ============================================================
     🌐 Dropdowns & Suggestions (MASTER)
  ============================================================ */
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
      // 🔒 Org Admin / Facility / Staff
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected?.label ||
          `${selected?.pat_no || ""} ${selected?.full_name || ""}`.trim();
      },
      "label"
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit && depositId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("depositEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/deposits/${depositId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            normalizeMessage(result, "Failed to load deposit")
          );
        entry = result?.data;
      }

      if (!entry) return;

      patientHidden.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim()
        : "";

      appliedInvoiceHidden.value = entry.applied_invoice_id || "";
      currencySelect.value = entry.currency || "";
      amountInput.value = entry.amount ?? "";
      methodSelect.value = entry.method || "";
      transactionRefInput.value = entry.transaction_ref || "";
      notesInput.value = entry.notes || "";
      reasonInput.value = entry.reason || "";

      if (isSuper) {
        if (orgSelect && entry.organization_id)
          orgSelect.value = entry.organization_id;
        if (facSelect && entry.facility_id)
          facSelect.value = entry.facility_id;
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load deposit");
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

    for (const rule of DEPOSIT_FORM_RULES) {
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
      currency: currencySelect.value || null,
      applied_invoice_id: normalizeUUID(appliedInvoiceHidden?.value),
      amount: normalizeNumber(amountInput.value),
      method: methodSelect.value || null,
      transaction_ref: transactionRefInput.value || null,
      notes: notesInput.value || null,
      reason: reasonInput.value || null,
    };

    // ✅ SUPER ADMIN ONLY may declare tenancy
    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const url = isEdit
        ? `/api/deposits/${depositId}`
        : `/api/deposits`;
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

      showToast(isEdit ? "✅ Deposit updated" : "✅ Deposit created");

      sessionStorage.removeItem("depositEditId");
      sessionStorage.removeItem("depositEditPayload");

      window.location.href = "/deposits-list.html";
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
    window.location.href = "/deposits-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    appliedInvoiceHidden.value = "";
    setUI("add");
  });
}
