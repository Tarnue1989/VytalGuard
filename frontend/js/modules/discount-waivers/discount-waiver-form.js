// 📁 discount-waiver-form.js – Secure & Role-Aware Discount Waiver Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 FULL parity with deposit-form.js MASTER
// 🔹 Rule-driven validation (DISCOUNT_WAIVER_FORM_RULES)
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
import { DISCOUNT_WAIVER_FORM_RULES } from "./discount-waiver.form.rules.js";

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
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

function normalizeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupDiscountWaiverFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["discount-waivers:create", "discount-waivers:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const waiverId =
    sessionStorage.getItem("discountWaiverEditId") || getQueryParam("id");
  const isEdit = Boolean(waiverId);

  /* ============================================================
     🎨 UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (mode = "add") => {
    if (titleEl) {
      titleEl.textContent =
        mode === "edit" ? "Edit Discount Waiver" : "Add Discount Waiver";
    }
    if (submitBtn) {
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Waiver`
          : `<i class="ri-add-line me-1"></i> Add Waiver`;
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const invoiceInput = document.getElementById("invoiceInput");
  const invoiceHidden = document.getElementById("invoiceId");
  const invoiceSuggestions = document.getElementById("invoiceSuggestions");

  const patientHidden = document.getElementById("patientId");

  const typeSelect = document.getElementById("typeSelect");
  const percentageInput = document.getElementById("percentage");
  const amountInput = document.getElementById("amount");
  const appliedTotalInput = document.getElementById("appliedTotal");
  const reasonInput = document.getElementById("reason");

  const percentageGroup = document.getElementById("percentageGroup");
  const amountGroup = document.getElementById("amountGroup");

  /* ============================================================
     👥 Role
  ============================================================ */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  let maxAllowed = null;
  let isSelectingInvoice = false; // 🔐 selection lock

  /* ============================================================
     🔄 Toggle Fields
  ============================================================ */
  function toggleWaiverFields() {
    const type = typeSelect.value;

    percentageGroup?.classList.toggle("hidden", type !== "percentage");
    amountGroup?.classList.toggle("hidden", type !== "fixed");

    if (type === "percentage") amountInput.value = "";
    if (type === "fixed") percentageInput.value = "";
  }

  typeSelect.addEventListener("change", toggleWaiverFields);
  toggleWaiverFields();

  /* ============================================================
     🌐 Dropdowns & Invoice Suggestions
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
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    setupSuggestionInputDynamic(
      invoiceInput,
      invoiceSuggestions,
      "/api/lite/invoices",
      (selected) => {
        const record = selected?.raw || selected;
        if (!record?.id || !record?.patient?.id) return;

        isSelectingInvoice = true;

        invoiceHidden.value = record.id;
        patientHidden.value = record.patient.id;

        maxAllowed = record.balance
          ? normalizeNumber(record.balance)
          : null;

        invoiceInput.value = selected.label;

        // release lock after browser settles events
        setTimeout(() => {
          isSelectingInvoice = false;
        }, 0);
      },
      "label"
    );

    // ❗ invalidate ONLY on real typing, never on selection
    invoiceInput.addEventListener("input", (e) => {
      if (isSelectingInvoice) return;
      if (!e.isTrusted) return;

      invoiceHidden.value = "";
      patientHidden.value = "";
      maxAllowed = null;
    });
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ Prefill (Edit Mode)
  ============================================================ */
  if (isEdit && waiverId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("discountWaiverEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/discount-waivers/${waiverId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            normalizeMessage(result, "Failed to load discount waiver")
          );
        }
        entry = result?.data;
      }

      if (!entry) return;

      if (entry.invoice) {
        invoiceHidden.value = entry.invoice.id;
        invoiceInput.value = `${entry.invoice.invoice_number} ${
          entry.invoice.patient?.full_name || ""
        }`.trim();
      }

      patientHidden.value = entry.patient?.id || "";

      typeSelect.value = entry.type || "";
      percentageInput.value = entry.percentage ?? "";
      amountInput.value = entry.amount ?? "";
      appliedTotalInput.value = entry.applied_total ?? "";
      reasonInput.value = entry.reason || "";

      if (isSuper) {
        if (entry.organization_id) orgSelect.value = entry.organization_id;
        if (entry.facility_id) facSelect.value = entry.facility_id;
      }

      toggleWaiverFields();
      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load discount waiver");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ Submit
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    if (!invoiceHidden.value || !patientHidden.value) {
      showToast("❌ Please select an invoice from the list");
      return;
    }

    const errors = [];

    for (const rule of DISCOUNT_WAIVER_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when({ isEdit })) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || el.closest(".hidden")) continue;

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
      invoice_id: normalizeUUID(invoiceHidden.value),
      patient_id: normalizeUUID(patientHidden.value),
      type: typeSelect.value || null,
      reason: reasonInput.value || null,
    };

    if (typeSelect.value === "percentage") {
      payload.percentage = normalizeNumber(percentageInput.value);
    }

    if (typeSelect.value === "fixed") {
      payload.amount = normalizeNumber(amountInput.value);
    }

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const url = isEdit
        ? `/api/discount-waivers/${waiverId}`
        : `/api/discount-waivers`;

      const res = await authFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );
      }

    showToast(isEdit ? "✅ Waiver updated" : "✅ Waiver created");

    // always clear edit state
    sessionStorage.removeItem("discountWaiverEditId");
    sessionStorage.removeItem("discountWaiverEditPayload");

    if (isEdit) {
      // ✅ EDIT → go back to list
      window.location.href = "/discount-waivers-list.html";
    } else {
      // ✅ CREATE → stay on form, reset safely
      clearFormErrors(form);
      form.reset();

      invoiceHidden.value = "";
      patientHidden.value = "";
      maxAllowed = null;

      setUI("add");
      toggleWaiverFields();
    }

    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/discount-waivers-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    invoiceHidden.value = "";
    patientHidden.value = "";
    maxAllowed = null;
    setUI("add");
    toggleWaiverFields();
  });
}
