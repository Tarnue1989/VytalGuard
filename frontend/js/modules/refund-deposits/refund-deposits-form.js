// 📁 refundDeposit-form.js – Secure & Role-Aware Deposit Refund Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL parity with refund-form.js MASTER (Deposit-adapted)
// 🔹 Rule-driven validation (RULE FILE – NO inline rules)
// 🔹 Page guard + logout watcher enforced
// 🔹 Tenant inherited strictly from Deposit (NO org/fac/patient payload)
// 🔹 Patient → Deposits dependency
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
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadDepositsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   📋 RULES (MASTER – IMPORTED)
============================================================ */
import { REFUND_DEPOSIT_FORM_RULES } from "./refund-deposits-form-rules.js";

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
   🚀 Main Setup
============================================================ */
export async function setupRefundDepositFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const sessionId = sessionStorage.getItem("refundDepositEditId");
  const queryId = getQueryParam("id");
  const refundId = sessionId || queryId;
  const isEdit = Boolean(refundId);

  /* ============================================================
     🎨 UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (mode = "add") => {
    if (titleEl) {
      titleEl.textContent =
        mode === "edit" ? "Edit Deposit Refund" : "Add Deposit Refund";
    }
    if (submitBtn) {
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Refund`
          : `<i class="ri-add-line me-1"></i> Add Refund`;
    }
  };

  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const depositInput = document.getElementById("depositInput");
  const depositHidden = document.getElementById("depositId");

  const amountInput = document.getElementById("refund_amount");
  const methodSelect = document.getElementById("methodSelect");
  const reasonInput = document.getElementById("reason");

  /* ============================================================
     🔐 TENANT UI LOCK (MASTER)
     Refund Deposit NEVER selects org/fac
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
     🔎 Patient → Deposits (MASTER)
  ============================================================ */
  setupSuggestionInputDynamic(
    patientInput,
    patientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      patientHidden.value = selected?.id || "";
      depositHidden.value = "";
      amountInput.value = "";
      amountInput.removeAttribute("max");

      if (!selected) {
        setupSelectOptions(depositInput, [], "id", "label");
        return;
      }

      patientInput.value =
        selected.label ||
        `${selected.pat_no || ""} ${selected.full_name || ""}`.trim();

      const deposits = await loadDepositsLite({
        patient_id: selected.id,
      });

const readable = deposits.map((d) => {
  const base =
    d.deposit_number ||
    d.transaction_ref ||
    (d.label ? d.label.split(" - ")[0] : "") ||
    d.id;

  const amount = Number(d.amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const balance = Number(d.remaining_balance || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const symbol = getCurrencySymbol(d.currency);

  return {
    ...d,
    label: `${base} — ${symbol} ${amount} — Bal: ${symbol} ${balance}`,
  };
});

      setupSelectOptions(
        depositInput,
        readable,
        "id",
        "label",
        "-- Select Deposit --"
      );

      depositInput.onchange = () => {
        const dep = readable.find((d) => d.id === depositInput.value);
        if (!dep) return;

        depositHidden.value = dep.id;
        methodSelect.value = dep.method || "";

        // 🔥 ADD THIS (currency symbol sync)
        const symbolEl = document.getElementById("currencySymbol");
        if (symbolEl) {
          symbolEl.textContent = getCurrencySymbol(dep.currency);
        }

        const bal = Number(dep.remaining_balance || 0);
        amountInput.value = bal.toFixed(2);
        amountInput.max = bal.toFixed(2);
      };
    },
    "label"
  );

  /* ============================================================
     ✏️ PREFILL (EDIT MODE — MASTER SAFE)
  ============================================================ */
  if (isEdit && refundId) {
    try {
      showLoading();

      let entry = JSON.parse(
        sessionStorage.getItem("refundDepositEditPayload") || "null"
      );

      if (!entry) {
        const res = await authFetch(`/api/refund-deposits/${refundId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            normalizeMessage(result, "Failed to load refund")
          );
        }
        entry = result?.data;
      }

      if (!entry) return;

      patientHidden.value = entry.patient_id || "";
      patientInput.value =
        entry.patient?.label ||
        `${entry.patient?.pat_no || ""} ${
          entry.patient?.full_name || ""
        }`.trim();

      setupSelectOptions(
        depositInput,
        [
          {
            id: entry.deposit_id,
            label:
              entry.deposit?.transaction_ref ||
              entry.deposit?.deposit_ref ||
              "Deposit",
          },
        ],
        "id",
        "label"
      );

      depositInput.value = entry.deposit_id;
      depositHidden.value = entry.deposit_id;

      amountInput.value = Number(entry.refund_amount || 0).toFixed(2);
      amountInput.max = Number(
        entry.deposit?.remaining_balance ??
          entry.refund_amount ??
          0
      ).toFixed(2);

      methodSelect.value = entry.method || "";
      reasonInput.value = entry.reason || "";

      patientInput.disabled = true;
      depositInput.disabled = true;

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Failed to load refund");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT (RULE FILE DRIVEN – MASTER)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of REFUND_DEPOSIT_FORM_RULES) {
      const el = document.getElementById(rule.id);
      if (!el || el.closest(".hidden")) continue;
      if (!el.value || el.value.trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      refund_amount: normalizeNumber(amountInput.value),
      method: methodSelect.value || null,
      reason: reasonInput.value || null,
    };

    if (!isEdit) {
      payload.deposit_id = normalizeUUID(depositHidden.value);
    }

    // 🔒 HARD STRIP TENANT (Refund inherits from Deposit)
    delete payload.organization_id;
    delete payload.facility_id;
    delete payload.patient_id;

    try {
      showLoading();

      const res = await authFetch(
        isEdit
          ? `/api/refund-deposits/${refundId}`
          : `/api/refund-deposits`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          normalizeMessage(result, "Submission failed")
        );
      }

      showToast(isEdit ? "✅ Refund updated" : "✅ Refund created");

      sessionStorage.removeItem("refundDepositEditId");
      sessionStorage.removeItem("refundDepositEditPayload");
      window.location.href = "/refund-deposits-list.html";
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
    window.location.href = "/refund-deposits-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.reload();
  });
}
