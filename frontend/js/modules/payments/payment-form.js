// 📁 payment-form.js – Enterprise Master Pattern Aligned (Add/Edit Payment)
// ============================================================================
// 🔹 Mirrors deposit-form.js for unified enterprise behavior
// 🔹 Adds permission-driven org/facility visibility & cascade logic
// 🔹 Fixes: patient name display + invoice prefill during edit
// 🔹 Adds invoice balance restriction (cannot exceed invoice.balance)
// 🔹 Preserves all existing DOM IDs, API calls, and event wiring
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

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
  try { return JSON.stringify(msg); } 
  catch { return fallback; }
}
function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}
function validatePaymentForm(payload, isEdit, userRole) {
  const errors = [];
  if (!payload.patient_id) errors.push("Patient is required");
  if (!payload.invoice_id) errors.push("Invoice is required");
  if (!payload.amount || payload.amount <= 0) errors.push("Valid amount is required");
  if (!payload.method) errors.push("Payment Method is required");
  if (!payload.transaction_ref) errors.push("Transaction Ref is required");

  if (isEdit && (!payload.reason || payload.reason.trim().length < 5))
    errors.push("Reason (min 5 chars) is required when editing");

  if (userRole.includes("super")) {
    if (!payload.organization_id) errors.push("Organization is required");
    if (!payload.facility_id) errors.push("Facility is required");
  } else if (userRole.includes("org_owner")) {
    if (!payload.facility_id) errors.push("Facility is required");
  }

  return errors;
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupPaymentFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("paymentEditId");
  const queryId = getQueryParam("id");
  const paymentId = sessionId || queryId;
  const isEdit = !!paymentId;

  const token = initPageGuard(autoPagePermissionKey(["payments:create", "payments:edit"]));

  /* ============================================================
     🎨 UI Setup
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const reasonGroup = document.getElementById("reasonGroup");

  const setAddModeUI = () => {
    if (titleEl) titleEl.textContent = "Add Payment";
    if (submitBtn) submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Payment`;
    reasonGroup?.classList.add("hidden");
  };
  const setEditModeUI = () => {
    if (titleEl) titleEl.textContent = "Edit Payment";
    if (submitBtn) submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Payment`;
    reasonGroup?.classList.remove("hidden");
  };
  isEdit ? setEditModeUI() : setAddModeUI();

  /* ============================================================
     📋 DOM Refs
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const invoiceSelect = document.getElementById("invoiceSelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");
  const amountInput = document.getElementById("amount");
  const methodSelect = document.getElementById("methodSelect");
  const transactionRef = document.getElementById("transactionRef");
  const isDeposit = document.getElementById("isDeposit");
  const reasonInput = document.getElementById("reason");

  // 🔥 NEW: store invoice balance
  let selectedInvoiceBalance = null;

  /* ============================================================
     🔽 Prefill Dropdowns + Suggestions
  ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      await reloadFacilities();

      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });

    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facilities = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facilities, "id", "name");

    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // Patient → Invoice auto-load
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      async (selected) => {
        patientHidden.value = selected?.id || "";
        if (selected?.id) {
          const res = await authFetch(`/api/lite/invoices?patient_id=${selected.id}`);
          const data = await res.json().catch(() => ({}));
          const invoices = data?.data?.records || [];
          const opts = invoices.map((inv) => ({
            id: inv.id,
            label: `${inv.invoice_number} | ${inv.status} | Balance: ${inv.balance}`,
            balance: inv.balance,
          }));
          setupSelectOptions(invoiceSelect, opts, "id", "label", "-- Select Invoice --");
        }
      },
      "label"
    );
  } catch (err) {
    console.error("❌ Dropdown load failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     🔥 NEW — Fetch invoice balance when selected
  ============================================================ */
  invoiceSelect?.addEventListener("change", async () => {
    selectedInvoiceBalance = null;
    const invoiceId = invoiceSelect.value;
    if (!invoiceId) return;

    try {
      const res = await authFetch(`/api/lite/invoices/${invoiceId}`);
      const data = await res.json().catch(() => ({}));
      const inv = data?.data;

      selectedInvoiceBalance = inv?.balance ?? null;

      if (selectedInvoiceBalance != null) {
        amountInput.max = selectedInvoiceBalance;
      }
    } catch (err) {
      console.error("❌ Failed to load invoice:", err);
    }
  });

  /* ============================================================
     🔥 NEW — Prevent typing above balance
  ============================================================ */
  amountInput?.addEventListener("input", () => {
    const amt = parseFloat(amountInput.value);
    if (!selectedInvoiceBalance || isNaN(amt)) return;

    if (amt > selectedInvoiceBalance) {
      amountInput.value = selectedInvoiceBalance;
      showToast(`⚠️ Amount cannot exceed invoice balance of $${selectedInvoiceBalance}`);
    }
  });

  /* ============================================================
     🧩 Prefill If Editing
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      const raw = sessionStorage.getItem("paymentEditPayload");
      let entry = raw ? JSON.parse(raw) : null;

      if (!entry) {
        const res = await authFetch(`/api/payments/${paymentId}`);
        const result = await res.json().catch(() => ({}));
        entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(normalizeMessage(result, "❌ Failed to load payment"));
      }

      if (entry.patient) {
        const pat = entry.patient;
        const label =
          pat.pat_no && pat.full_name
            ? `${pat.pat_no} - ${pat.full_name}`
            : pat.full_name || pat.pat_no || "";
        patientHidden.value = pat.id || "";
        patientInput.value = label;
      }

      if (entry.invoice) {
        const inv = entry.invoice;
        setupSelectOptions(invoiceSelect, [inv], "id", "invoice_number");
        invoiceSelect.value = inv.id || entry.invoice_id || "";

        // preload invoice balance
        selectedInvoiceBalance = inv.balance ?? null;
        if (selectedInvoiceBalance) amountInput.max = selectedInvoiceBalance;

      } else if (entry.invoice_id) {
        invoiceSelect.value = entry.invoice_id;
      }

      amountInput.value = entry.amount || "";
      methodSelect.value = entry.method || "";
      transactionRef.value = entry.transaction_ref || "";
      isDeposit.checked = entry.is_deposit || false;
      reasonInput.value = entry.reason || "";

      if (entry.organization_id && orgSelect) orgSelect.value = entry.organization_id;
      if (entry.facility_id && facSelect) facSelect.value = entry.facility_id;

      setEditModeUI();
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load payment");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit Handler
============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
    const payload = {
      invoice_id: normalizeUUID(invoiceSelect?.value),
      patient_id: normalizeUUID(patientHidden.value),
      amount: parseFloat(amountInput?.value || 0) || null,
      method: methodSelect?.value || null,
      transaction_ref: transactionRef?.value || null,
      organization_id: normalizeUUID(
        orgSelect?.value || localStorage.getItem("organizationId")
      ),
      facility_id: normalizeUUID(
        facSelect?.value || localStorage.getItem("facilityId")
      ),
      is_deposit: isDeposit?.checked || false,
      reason: reasonInput?.value || null,
    };

    const errors = validatePaymentForm(payload, isEdit, userRole);
    if (errors.length > 0) {
      showToast("❌ " + errors.join("\n"));
      return;
    }

    // 🔥 NEW: Block submitting above balance
    if (
      selectedInvoiceBalance != null &&
      payload.amount > selectedInvoiceBalance
    ) {
      showToast(
        `❌ Amount cannot exceed invoice balance ($${selectedInvoiceBalance})`
      );
      return;
    }

    const url = isEdit ? `/api/payments/${paymentId}` : `/api/payments`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Payment updated successfully");
        sessionStorage.removeItem("paymentEditId");
        sessionStorage.removeItem("paymentEditPayload");
        window.location.href = "/payments-list.html";
      } else {
        showToast("✅ Payment created successfully");
        form.reset();
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
     🚪 Clear / Cancel Buttons
============================================================ */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("paymentEditId");
    sessionStorage.removeItem("paymentEditPayload");
    form.reset();
    patientHidden.value = "";
    invoiceSelect.value = "";
    selectedInvoiceBalance = null;
    setAddModeUI();
  });

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("paymentEditId");
    sessionStorage.removeItem("paymentEditPayload");
    window.location.href = "/payments-list.html";
  });
}
