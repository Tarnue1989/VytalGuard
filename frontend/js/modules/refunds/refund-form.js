// 📁 refund-form.js – Enterprise Master Pattern Aligned (Add/Edit Refund)
// ============================================================================
// 🔹 Mirrors deposit-form.js for unified enterprise behavior
// 🔹 Adds permission-driven org/facility cascade & scoped visibility
// 🔹 UPDATED to use real refundable_balance from backend
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
  loadPaymentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   Helpers
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
  return val && val.trim() !== "" ? val : null;
}

function validateRefundForm(payload, isEdit, userRole) {
  const errors = [];

  if (!payload.payment_id) errors.push("Payment is required");
  if (!payload.invoice_id) errors.push("Invoice is required");
  if (!payload.amount || payload.amount <= 0) errors.push("Valid amount is required");
  if (!payload.method) errors.push("Refund Method is required");
  if (!payload.reason || payload.reason.trim().length < 3)
    errors.push("Reason (min 3 chars) is required");

  if (userRole.includes("super")) {
    if (!payload.organization_id) errors.push("Organization is required");
    if (!payload.facility_id) errors.push("Facility is required");
  } else if (userRole.includes("org_owner")) {
    if (!payload.facility_id) errors.push("Facility is required");
  }

  return errors;
}

/* ============================================================
   Main Setup
============================================================ */
export async function setupRefundFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("refundEditId");
  const queryId = getQueryParam("id");
  const refundId = sessionId || queryId;
  const isEdit = !!refundId;

  const token = initPageGuard(autoPagePermissionKey(["refunds:create", "refunds:edit"]));

  /* ============================================================
     UI Mode
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  const setAddModeUI = () => {
    if (titleEl) titleEl.textContent = "Add Refund";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Refund`;
  };

  const setEditModeUI = () => {
    if (titleEl) titleEl.textContent = "Edit Refund";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Refund`;
  };

  isEdit ? setEditModeUI() : setAddModeUI();

  /* ============================================================
     DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");
  const paymentSelect = document.getElementById("paymentSelect");
  const invoiceHidden = document.getElementById("invoiceId");
  const amountInput = document.getElementById("amount");
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
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });

    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facilities = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facilities, "id", "name", "-- Select Facility --");
      facSelect.value = localStorage.getItem("facilityId") || "";

    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    /* ============================================================
       Patient Suggestions + Payments
    ============================================================ */
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientHidden.value = selected?.id || "";

        if (selected) {
          patientInput.value =
            selected.label ||
            `${selected.pat_no || ""} ${selected.full_name || ""}`.trim();

          const payments = await loadPaymentsLite({
            patient_id: selected.id,
            status: "completed",
            is_deposit: "false",
          });

          setupSelectOptions(paymentSelect, payments, "id", "label", "-- Select Payment --");

          /* ============================================================
             UPDATED — STRICT USE OF refundable_balance
          ============================================================ */
          paymentSelect.onchange = () => {
            const chosen = payments.find((p) => p.id === paymentSelect.value);

            if (chosen) {
              methodSelect.value = chosen.method || "";
              invoiceHidden.value = chosen.invoice_id || "";

              const balance = Number(chosen.refundable_balance);
              amountInput.value = balance.toFixed(2);
              amountInput.max = balance.toFixed(2);

            } else {
              methodSelect.value = "";
              amountInput.value = "";
              invoiceHidden.value = "";
              amountInput.removeAttribute("max");
            }
          };

        } else {
          setupSelectOptions(paymentSelect, [], "id", "label", "-- Select Payment --");
          methodSelect.value = "";
          amountInput.value = "";
          invoiceHidden.value = "";
          amountInput.removeAttribute("max");
        }
      },
      "label"
    );

  } catch (err) {
    console.error("❌ Dropdown load failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     Prefill (Edit Mode)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      let entry = null;

      const raw = sessionStorage.getItem("refundEditPayload");
      if (raw) entry = JSON.parse(raw);

      if (!entry) {
        const res = await authFetch(`/api/refunds/${refundId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        entry = result?.data;

        if (!res.ok || !entry)
          throw new Error(
            normalizeMessage(result, `❌ Failed to load refund (${res.status})`)
          );
      }

      if (entry.patient) {
        patientHidden.value = entry.patient.id;
        patientInput.value =
          entry.patient.label ||
          `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim();

        const payments = await loadPaymentsLite({
          patient_id: entry.patient.id,
          status: "completed",
          is_deposit: "false",
        });

        setupSelectOptions(paymentSelect, payments, "id", "label", "-- Select Payment --");

        if (entry.payment) paymentSelect.value = entry.payment.id;
      }

      invoiceHidden.value = entry.invoice_id || "";

      if (entry.payment) {
        methodSelect.value = entry.payment.method || "";

        // UPDATE: always use refundable_balance in edit mode
        const refundBal = Number(entry.payment.refundable_balance || entry.amount);
        amountInput.value = refundBal.toFixed(2);
        amountInput.max = refundBal.toFixed(2);
      }

      reasonInput.value = entry.reason || "";

      if (entry.organization_id && orgSelect) orgSelect.value = entry.organization_id;
      if (entry.facility_id && facSelect) facSelect.value = entry.facility_id;

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
      payment_id: normalizeUUID(paymentSelect?.value || null),
      invoice_id: normalizeUUID(invoiceHidden?.value || null),
      patient_id: normalizeUUID(patientHidden.value || null),
      amount: parseFloat(amountInput?.value || 0) || null,
      method: methodSelect?.value || null,
      reason: reasonInput?.value || null,
      organization_id: normalizeUUID(
        orgSelect?.value || localStorage.getItem("organizationId")
      ),
      facility_id: normalizeUUID(
        facSelect?.value || localStorage.getItem("facilityId")
      ),
    };

    const errors = validateRefundForm(payload, isEdit, userRole);
    if (errors.length > 0) {
      showToast("❌ " + errors.join("\n"));
      return;
    }

    const url = isEdit ? `/api/refunds/${refundId}` : `/api/refunds`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
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
        showToast("✅ Refund updated successfully");
        sessionStorage.removeItem("refundEditId");
        sessionStorage.removeItem("refundEditPayload");
        window.location.href = "/refunds-list.html";

      } else {
        showToast("✅ Refund created successfully");
        form.reset();
        paymentSelect.value = "";
        invoiceHidden.value = "";
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
     Clear / Cancel Buttons
  ============================================================ */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    // Clear edit state
    sessionStorage.removeItem("refundEditId");
    sessionStorage.removeItem("refundEditPayload");

    // Full form reset
    form.reset();
    setAddModeUI();

    // 🔥 Completely clear payment dropdown (remove stale options)
    if (paymentSelect) {
      paymentSelect.innerHTML = `<option value="">-- Select Payment --</option>`;
    }

    // 🔥 Remove invoice reference
    if (invoiceHidden) invoiceHidden.value = "";

    // 🔥 Clear patient selection
    if (patientHidden) patientHidden.value = "";
    if (patientInput) patientInput.value = "";

    // 🔥 Clear method select
    if (methodSelect) methodSelect.value = "";

    // 🔥 Remove max attribute from amount (prevents stale refund limits)
    if (amountInput) amountInput.removeAttribute("max");

    // 🔥 Also clear amount value
    if (amountInput) amountInput.value = "";
  });


  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("refundEditId");
    sessionStorage.removeItem("refundEditPayload");
    window.location.href = "/refunds-list.html";
  });
}
