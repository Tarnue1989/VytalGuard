// 📁 refundDeposit-form.js – Enterprise Master Pattern (Add/Edit Deposit Refund)
// ============================================================================
// 🔹 Mirrors refund-form.js but for DEPOSIT REFUNDS
// 🔹 Uses refundable deposit balance (remaining_balance from backend)
// 🔹 Supports Add + Edit Mode with session caching
// 🔹 Fully aligned with refundDepositController + refundDepositService
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadPatientsLite,
  loadDepositsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
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

function validateDepositRefundForm(payload, isEdit, userRole) {
  const errors = [];

  if (!payload.deposit_id) errors.push("Deposit is required");
  if (!payload.patient_id) errors.push("Patient is required");
  if (!payload.refund_amount || payload.refund_amount <= 0)
    errors.push("Valid refund amount is required");
  if (!payload.method) errors.push("Refund Method is required");
  if (!payload.reason || payload.reason.trim().length < 3)
    errors.push("Reason (min 3 chars) is required");

  if (userRole.includes("super")) {
    if (!payload.organization_id) errors.push("Organization is required");
    if (!payload.facility_id) errors.push("Facility is required");
  } else if (userRole.includes("admin")) {
    if (!payload.facility_id) errors.push("Facility is required");
  }

  return errors;
}

/* ============================================================
   Main Setup
============================================================ */
export async function setupRefundDepositFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("refundDepositEditId");
  const queryId = getQueryParam("id");
  const refundId = sessionId || queryId;
  const isEdit = !!refundId;

  const token = initPageGuard(
    autoPagePermissionKey(["refund-deposits:create", "refund-deposits:edit"])
  );

  /* ============================================================
     UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setAddModeUI = () => {
    if (titleEl) titleEl.textContent = "Add Deposit Refund";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Refund`;
  };

  const setEditModeUI = () => {
    if (titleEl) titleEl.textContent = "Edit Deposit Refund";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Refund`;
  };

  isEdit ? setEditModeUI() : setAddModeUI();

  /* ============================================================
     DOM Elements
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
     Load Orgs / Facilities
  ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
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
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });

    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Failed to load org/facility lists:", err);
    showToast("❌ Failed to load organization or facility");
  }

  /* ============================================================
     Patient → Deposits loader
  ============================================================ */
  setupSuggestionInputDynamic(
    patientInput,
    patientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      patientHidden.value = selected?.id || "";
      depositHidden.value = "";

      if (!selected) {
        depositInput.value = "";
        setupSelectOptions(depositInput, [], "id", "label");
        return;
      }

      patientInput.value =
        selected.label ||
        `${selected.pat_no || ""} ${selected.full_name || ""}`.trim();

      // Load deposits
      const deposits = await loadDepositsLite({
        patient_id: selected.id,
      });

      // Make readable labels (FORMAT C)
      const readableDeposits = deposits.map((d) => {
        const depositNo = d.label?.split(" - ")[0] ?? d.label;
        return {
          ...d,
          label: `Deposit ${depositNo} — Amount ${d.amount} — Balance ${d.remaining_balance} — ${d.method?.toUpperCase() ?? ""}`
        };
      });

      setupSelectOptions(
        depositInput,
        readableDeposits,
        "id",
        "label",
        "-- Select Deposit --"
      );

      /* Handle onchange */
      depositInput.onchange = () => {
        const dep = readableDeposits.find((d) => d.id === depositInput.value);

        if (!dep) {
          amountInput.value = "";
          amountInput.removeAttribute("max");
          methodSelect.value = "";
          depositHidden.value = "";
          return;
        }

        depositHidden.value = dep.id;
        methodSelect.value = dep.method || "";

        const bal = Number(dep.remaining_balance ?? dep.balance ?? 0);
        amountInput.value = bal.toFixed(2);
        amountInput.max = bal.toFixed(2);
      };
    },
    "label"
  );

  /* ============================================================
     Edit Mode
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry = null;
      const raw = sessionStorage.getItem("refundDepositEditPayload");
      if (raw) entry = JSON.parse(raw);

      if (!entry) {
        const res = await authFetch(`/api/refund-deposits/${refundId}`);
        const result = await res.json().catch(() => ({}));
        entry = result?.data;

        if (!res.ok || !entry)
          throw new Error(normalizeMessage(result, "❌ Refund not found"));
      }

      // Prefill patient
      if (entry.patient) {
        patientInput.value = entry.patient.full_name || "";
        patientHidden.value = entry.patient.id;

        // Load deposits for that patient
        const deposits = await loadDepositsLite({
          patient_id: entry.patient.id,
        });

        const readableDeposits = deposits.map((d) => {
          const depositNo = d.label?.split(" - ")[0] ?? d.label;
          return {
            ...d,
            label: `Deposit ${depositNo} — Amount ${d.amount} — Balance ${d.remaining_balance} — ${d.method?.toUpperCase() ?? ""}`
          };
        });

        setupSelectOptions(
          depositInput,
          readableDeposits,
          "id",
          "label",
          "-- Select Deposit --"
        );

        if (entry.deposit_id) {
          depositInput.value = entry.deposit_id;
          depositHidden.value = entry.deposit_id;
        }
      }

      // Refund amount
      amountInput.value = Number(entry.refund_amount).toFixed(2);

      amountInput.max = Number(
        entry.deposit?.remaining_balance ??
        entry.deposit?.balance ??
        entry.refund_amount
      ).toFixed(2);

      methodSelect.value = entry.method || "";
      reasonInput.value = entry.reason || "";

      if (entry.organization_id && orgSelect)
        orgSelect.value = entry.organization_id;
      if (entry.facility_id && facSelect)
        facSelect.value = entry.facility_id;

      setEditModeUI();

    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load refund");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    const payload = {
      deposit_id: normalizeUUID(depositHidden.value),
      patient_id: normalizeUUID(patientHidden.value),
      refund_amount: parseFloat(amountInput.value || 0) || null,
      method: methodSelect.value || null,
      reason: reasonInput.value || null,
      organization_id:
        normalizeUUID(orgSelect?.value) ||
        localStorage.getItem("organizationId"),
      facility_id:
        normalizeUUID(facSelect?.value) ||
        localStorage.getItem("facilityId"),
    };

    const errors = validateDepositRefundForm(payload, isEdit, userRole);
    if (errors.length > 0) {
      showToast("❌ " + errors.join("\n"));
      return;
    }

    const url = isEdit
      ? `/api/refund-deposits/${refundId}`
      : `/api/refund-deposits`;

    try {
      showLoading();

      const res = await authFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      if (isEdit) {
        showToast("✅ Deposit refund updated successfully");
        sessionStorage.removeItem("refundDepositEditId");
        sessionStorage.removeItem("refundDepositEditPayload");
        window.location.href = "/refund-deposits-list.html";
      } else {
        showToast("✅ Deposit refund created successfully");
        form.reset();
        depositHidden.value = "";
        patientHidden.value = "";
        amountInput.removeAttribute("max");
        setAddModeUI();
      }

    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     Clear Button
  ============================================================ */
  document.getElementById("clearRefundDepositBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("refundDepositEditId");
    sessionStorage.removeItem("refundDepositEditPayload");

    form.reset();
    amountInput.removeAttribute("max");
    patientHidden.value = "";
    depositHidden.value = "";
    setAddModeUI();
  });

  /* ============================================================
     Cancel Button
  ============================================================ */
  document.getElementById("cancelRefundDepositBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("refundDepositEditId");
    sessionStorage.removeItem("refundDepositEditPayload");
    window.location.href = "/refund-deposits-list.html";
  });
}
