// 📁 payment-form.js – Secure & Role-Aware Payment Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 FULL parity with deposit-form.js / consultation-form.js MASTER
// 🔹 Rule-driven validation (PAYMENT_FORM_RULES)
// 🔹 Role-aware tenant handling (super only)
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
import { PAYMENT_FORM_RULES } from "./payment.form.rules.js";

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
export async function setupPaymentFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const paymentId =
    sessionStorage.getItem("paymentEditId") || getQueryParam("id");
  const isEdit = Boolean(paymentId);

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
      titleEl.textContent = mode === "edit" ? "Edit Payment" : "Add Payment";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Payment`
          : `<i class="ri-add-line me-1"></i> Add Payment`;
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

  const invoiceSelect = document.getElementById("invoiceSelect");

  const amountInput = document.getElementById("amount");
  const currencySelect = document.getElementById("currencySelect"); 
  const methodSelect = document.getElementById("methodSelect");
  const transactionRefInput = document.getElementById("transactionRef");
  const reasonInput = document.getElementById("reason");

  let selectedInvoiceBalance = null;

  /* ============================================================
     👥 Role
  ============================================================ */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";

  /* ============================================================
    🌐 Dropdowns & Suggestions
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
      // 🔒 org / facility resolved by backend
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value = selected?.label || "";

        // 🧼 Reset invoice + currency state
        invoiceSelect.innerHTML = "";
        invoiceSelect.disabled = false;
        selectedInvoiceBalance = null;
        amountInput.removeAttribute("max");

        if (currencySelect) {
          currencySelect.value = "";
          currencySelect.disabled = false;
        }

        if (!selected?.id) return;

        const res = await authFetch(
          `/api/lite/invoices?patient_id=${selected.id}`
        );
        const data = await res.json().catch(() => ({}));
        const invoices = data?.data?.records || [];

        // 🚫 NO PAYABLE INVOICES
        if (!invoices.length) {
          setupSelectOptions(
            invoiceSelect,
            [
              {
                id: "",
                label: "No outstanding invoices for this patient",
                disabled: true,
              },
            ],
            "id",
            "label"
          );

          invoiceSelect.disabled = true;

          showToast(
            "ℹ️ This patient has no invoices with outstanding balance",
            "info"
          );
          return;
        }

        // ✅ PAYABLE INVOICES (USE BACKEND LABEL)
        const opts = invoices.map((inv) => ({
          id: inv.id,
          label: inv.label, // ✅ backend formatted (includes currency)
          balance: inv.balance,
        }));

        setupSelectOptions(
          invoiceSelect,
          opts,
          "id",
          "label",
          "-- Select Invoice --"
        );

        // 🔥 ATTACH CURRENCY TO EACH OPTION (CORRECT SCOPE)
        Array.from(invoiceSelect.options).forEach((opt) => {
          const inv = invoices.find((i) => i.id === opt.value);
          if (inv) {
            opt.dataset.currency = inv.currency;
          }
        });
      },
      "label"
    );
  } catch {
    showToast("❌ Failed to load reference data");
  }
  invoiceSelect?.addEventListener("change", async () => {
    selectedInvoiceBalance = null;

    const selectedOption =
      invoiceSelect.options[invoiceSelect.selectedIndex];

    const invoiceId = invoiceSelect.value;
    if (!invoiceId) return;

    // ✅ AUTO SET CURRENCY
    const selectedCurrency = selectedOption?.dataset?.currency;
    if (selectedCurrency && currencySelect) {
      currencySelect.value = selectedCurrency;

      // 🔒 lock currency to invoice
      currencySelect.disabled = true;
    }

    try {
      const res = await authFetch(`/api/invoices/${invoiceId}`);
      const data = await res.json().catch(() => ({}));
      selectedInvoiceBalance = data?.data?.balance ?? null;

      if (selectedInvoiceBalance != null) {
        amountInput.max = selectedInvoiceBalance;
      }
    } catch {}
  });

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit && paymentId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("paymentEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/payments/${paymentId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(normalizeMessage(result, "Failed to load payment"));
        entry = result?.data;
      }

      if (!entry) return;

      patientHidden.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim()
        : "";

      if (entry.invoice) {
        setupSelectOptions(
          invoiceSelect,
          [entry.invoice],
          "id",
          "invoice_number"
        );
        invoiceSelect.value = entry.invoice.id;
        selectedInvoiceBalance = entry.invoice.balance ?? null;
      }

      amountInput.value = entry.amount ?? "";
      methodSelect.value = entry.method || "";
      currencySelect.value = entry.currency || "";
      transactionRefInput.value = entry.transaction_ref || "";
      reasonInput.value = entry.reason || "";

      if (isSuper) {
        if (orgSelect && entry.organization_id)
          orgSelect.value = entry.organization_id;
        if (facSelect && entry.facility_id)
          facSelect.value = entry.facility_id;
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Could not load payment");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT — CONTROLLER FAITHFUL
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of PAYMENT_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;
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
      patient_id: normalizeUUID(patientHidden.value),
      invoice_id: normalizeUUID(invoiceSelect.value),
      currency: currencySelect.value || null,
      amount: normalizeNumber(amountInput.value),
      method: methodSelect.value || null,
      transaction_ref: transactionRefInput.value || null,
      ...(isEdit && { reason: reasonInput.value || null }),
    };

    // 🔒 ONLY superadmin may send tenant keys (NULLS STRIPPED)
    // 🧹 HARD STRIP — payment schema forbids tenant keys unless superadmin
    delete payload.facility_id;
    delete payload.organization_id;

    // ✅ Re-add ONLY when allowed and non-null
    if (isSuper) {
      const orgId = normalizeUUID(orgSelect?.value);
      const facId = normalizeUUID(facSelect?.value);

      if (orgId) payload.organization_id = orgId;
      if (facId) payload.facility_id = facId;
    }


    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/payments/${paymentId}` : `/api/payments`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(isEdit ? "✅ Payment updated" : "✅ Payment created");

      sessionStorage.removeItem("paymentEditId");
      sessionStorage.removeItem("paymentEditPayload");
      window.location.href = "/payments-list.html";
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
    window.location.href = "/payments-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    patientHidden.value = "";
    selectedInvoiceBalance = null;
    setUI("add");
  });
}
