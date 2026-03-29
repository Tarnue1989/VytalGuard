// 📁 refund-form.js – Secure & Role-Aware Refund Form (ENTERPRISE MASTER–ALIGNED)
// ============================================================================
// 🧭 FULL parity with refundController.js (Payment / Deposit aligned)
// 🔹 Rule-driven validation (INLINE rules, no custom validator function)
// 🔹 Page guard + logout watcher enforced
// 🔹 Tenant inherited strictly from Payment (NO org/facility payload)
// 🔹 Patient → Payments dependency (completed, non-deposit only)
// 🔹 Refundable balance enforced (UX + backend)
// 🔹 Clean payload normalization (UUID | number | null)
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
  loadPaymentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🧩 Helpers (MASTER)
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeUUID(val) {
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

function normalizeNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
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

/* ============================================================
   📋 RULES (MASTER – INLINE)
============================================================ */
const REFUND_FORM_RULES = [
  { id: "patientId", message: "Patient is required" },
  { id: "paymentSelect", message: "Payment is required" },
  { id: "amount", message: "Refund amount is required" },
  { id: "reason", message: "Reason is required" },
];

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupRefundFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const sessionId = sessionStorage.getItem("refundEditId");
  const queryId = getQueryParam("id");
  const refundId = sessionId || queryId;
  const isEdit = Boolean(refundId);

  /* ============================================================
     🎨 UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent = mode === "edit" ? "Edit Refund" : "Add Refund";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Refund`
          : `<i class="ri-add-line me-1"></i> Add Refund`;
  };

  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const paymentSelect = document.getElementById("paymentSelect");
  const invoiceHidden = document.getElementById("invoiceId");

  const amountInput = document.getElementById("amount");
  const methodSelect = document.getElementById("methodSelect");
  const reasonInput = document.getElementById("reason");

  /* ============================================================
     🔐 TENANT UI LOCK (MASTER)
  ============================================================ */
  document
    .getElementById("organizationSelect")
    ?.closest(".form-group")
    ?.classList.add("hidden");

  document
    .getElementById("facilitySelect")
    ?.closest(".form-group")
    ?.classList.add("hidden");

  /* ============================================================
     🔎 Patient → Payments (ADD MODE ONLY)
  ============================================================ */
  if (!isEdit) {
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientHidden.value = selected?.id || "";
        paymentSelect.innerHTML = `<option value="">-- Select Payment --</option>`;
        invoiceHidden.value = "";
        amountInput.value = "";
        amountInput.removeAttribute("max");

        if (!selected) return;

        patientInput.value = selected.label || "";

        const payments = await loadPaymentsLite({
          patient_id: selected.id,
          status: "completed",
          is_deposit: "false",
        });

/* ===================== ✅ FIX START ===================== */
const formattedPayments = payments.map((p) => {
  const base =
    p.payment_number ||
    p.transaction_ref ||
    (p.label ? p.label.split(" - ")[0] : "") || // ✅ strip amount
    p.id;

  const amount = Number(p.amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const balance = Number(p.remaining_balance || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return {
    ...p,
    label: `${base} — LR$ ${amount} — Bal: LR$ ${balance}`,
  };
});
        /* ===================== ✅ FIX END ===================== */

        setupSelectOptions(
          paymentSelect,
          formattedPayments,
          "id",
          "label",
          "-- Select Payment --"
        );

        paymentSelect.onchange = () => {
          const p = payments.find((x) => x.id === paymentSelect.value);
          if (!p) return;

          methodSelect.value = p.method || "";
          invoiceHidden.value = p.invoice_id || "";

          const bal = Number(p.remaining_balance || 0);
          amountInput.value = bal.toFixed(2);
          amountInput.max = bal.toFixed(2);
        };
      },
      "label"
    );
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE — FIXED)
  ============================================================ */
  if (isEdit && refundId) {
    try {
      showLoading();

      let entry = null;
      const cached = sessionStorage.getItem("refundEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        const res = await authFetch(`/api/refunds/${refundId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            normalizeMessage(result, "Failed to load refund")
          );
        entry = result?.data;
      }

      if (!entry) return;

      patientHidden.value = entry.patient_id || "";
      patientInput.value = entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.first_name || ""} ${entry.patient.last_name || ""}`.trim()
        : "";

      setupSelectOptions(
        paymentSelect,
        [
          {
            id: entry.payment_id,
            label: entry.payment?.transaction_ref || "Payment",
          },
        ],
        "id",
        "label"
      );
      paymentSelect.value = entry.payment_id;

      invoiceHidden.value = entry.invoice_id || "";
      methodSelect.value = entry.method || "";

      amountInput.value = entry.amount ?? "";
      reasonInput.value = entry.reason ?? "";

      patientInput.disabled = true;
      paymentSelect.disabled = true;

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Failed to load refund");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT (CREATE + UPDATE SAFE)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of REFUND_FORM_RULES) {
      const el = document.getElementById(rule.id);
      if (!el || el.closest(".hidden")) continue;
      if (!el.value || el.value.trim() === "")
        errors.push({ field: rule.id, message: rule.message });
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      amount: normalizeNumber(amountInput.value),
      reason: reasonInput.value || null,
    };

    if (!isEdit) {
      payload.payment_id = normalizeUUID(paymentSelect.value);
    }

    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/refunds/${refundId}` : `/api/refunds`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, "Submission failed"));

      showToast(isEdit ? "✅ Refund updated" : "✅ Refund created");

      sessionStorage.removeItem("refundEditId");
      sessionStorage.removeItem("refundEditPayload");
      window.location.href = "/refunds-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     ⏮️ CANCEL / CLEAR
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/refunds-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.reload();
  });
}