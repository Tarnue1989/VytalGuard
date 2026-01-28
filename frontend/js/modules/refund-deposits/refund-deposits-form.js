// 📁 refundDeposit-form.js – Secure & Role-Aware Deposit Refund Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 FULL parity with deposit-form.js MASTER pattern
// 🔹 Rule-driven validation (refundDepositFormRules inline)
// 🔹 Role-aware org/fac handling (super / admin / staff)
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
  loadDepositsLite,
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
   📋 RULES (MASTER-STYLE, INLINE)
============================================================ */
const REFUND_DEPOSIT_FORM_RULES = [
  { id: "patientId", message: "Patient is required" },
  { id: "depositId", message: "Deposit is required" },
  { id: "refund_amount", message: "Refund amount is required" },
  { id: "methodSelect", message: "Refund method is required" },
  { id: "reason", message: "Reason is required" },
];

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
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Deposit Refund" : "Add Deposit Refund";
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
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const depositInput = document.getElementById("depositInput");
  const depositHidden = document.getElementById("depositId");

  const amountInput = document.getElementById("refund_amount");
  const methodSelect = document.getElementById("methodSelect");
  const reasonInput = document.getElementById("reason");

  /* ============================================================
     👥 Role
  ============================================================ */
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  const isSuper = userRole.includes("super");
  const isAdmin = userRole.includes("admin");

  /* ============================================================
     🌐 Org / Facility (MASTER)
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
    } else if (isAdmin) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch {
    showToast("❌ Failed to load organization/facility data");
  }

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

      const deposits = await loadDepositsLite({ patient_id: selected.id });

      const readable = deposits.map((d) => ({
        ...d,
        label: `Deposit ${d.label} — Amount ${d.amount} — Balance ${d.remaining_balance} — ${(
          d.method || ""
        ).toUpperCase()}`,
      }));

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

        const bal = Number(dep.remaining_balance || 0);
        amountInput.value = bal.toFixed(2);
        amountInput.max = bal.toFixed(2);
      };
    },
    "label"
  );

  /* ============================================================
     ✏️ EDIT MODE PREFILL
  ============================================================ */
  if (isEdit && refundId) {
    try {
      showLoading();

      let entry =
        JSON.parse(sessionStorage.getItem("refundDepositEditPayload") || "null");

      if (!entry) {
        const res = await authFetch(`/api/refund-deposits/${refundId}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(normalizeMessage(result));
        entry = result?.data;
      }

      if (!entry) return;

      patientHidden.value = entry.patient_id || "";
      patientInput.value =
        entry.patient?.label ||
        `${entry.patient?.pat_no || ""} ${
          entry.patient?.full_name || ""
        }`.trim();

      const deposits = await loadDepositsLite({
        patient_id: entry.patient_id,
      });

      const readable = deposits.map((d) => ({
        ...d,
        label: `Deposit ${d.label} — Amount ${d.amount} — Balance ${d.remaining_balance}`,
      }));

      setupSelectOptions(depositInput, readable, "id", "label");
      depositInput.value = entry.deposit_id;
      depositHidden.value = entry.deposit_id;

      amountInput.value = Number(entry.refund_amount || 0).toFixed(2);
      amountInput.max = Number(
        entry.deposit?.remaining_balance || entry.refund_amount || 0
      ).toFixed(2);

      methodSelect.value = entry.method || "";
      reasonInput.value = entry.reason || "";

      if (isSuper) {
        orgSelect.value = entry.organization_id || "";
        facSelect.value = entry.facility_id || "";
      }

      setUI("edit");
    } catch (err) {
      showToast(err.message || "❌ Failed to load refund");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT (MASTER RULE-DRIVEN)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of REFUND_DEPOSIT_FORM_RULES) {
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
      deposit_id: normalizeUUID(depositHidden.value),
      patient_id: normalizeUUID(patientHidden.value),
      refund_amount: normalizeNumber(amountInput.value),
      method: methodSelect.value || null,
      reason: reasonInput.value || null,
    };

    if (isSuper) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/refund-deposits/${refundId}` : `/api/refund-deposits`,
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
  document
    .getElementById("cancelRefundDepositBtn")
    ?.addEventListener("click", () => {
      sessionStorage.clear();
      window.location.href = "/refund-deposits-list.html";
    });

  document
    .getElementById("clearRefundDepositBtn")
    ?.addEventListener("click", () => {
      sessionStorage.clear();
      window.location.reload();
    });
}
