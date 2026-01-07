// 📁 deposit-form.js – Enterprise Master Pattern Aligned (Add/Edit Deposit)
// ============================================================================
// 🔹 Mirrors appointment-form.js for unified enterprise behavior
// 🔹 Adds permission-driven org/facility visibility & cascade logic
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
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}

function validateDepositForm(payload, isEdit, userRole) {
  const errors = [];

  if (!payload.patient_id) errors.push("Patient is required");
  if (!payload.amount || payload.amount <= 0) errors.push("Valid amount is required");
  if (!payload.method) errors.push("Method is required");
  if (!payload.transaction_ref) errors.push("Transaction Ref is required");

  if (isEdit && (!payload.reason || payload.reason.trim().length < 5)) {
    errors.push("Reason (min 5 chars) is required when editing");
  }

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
export async function setupDepositFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("depositEditId");
  const queryId = getQueryParam("id");
  const depositId = sessionId || queryId;
  const isEdit = !!depositId;

  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey(["deposits:create", "deposits:edit"]));

  // 🧾 Debug Snapshot
  console.groupCollapsed("📋 [setupDepositFormSubmission] State Snapshot");
  console.log("depositId:", depositId);
  console.log("isEdit:", isEdit);
  console.groupEnd();

  /* ============================================================
     🎨 UI Mode Setup
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const reasonGroup = document.getElementById("reasonGroup");

  const setAddModeUI = () => {
    if (titleEl) titleEl.textContent = "Add Deposit";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Deposit`;
    if (reasonGroup) reasonGroup.classList.add("hidden");
  };

  const setEditModeUI = () => {
    if (titleEl) titleEl.textContent = "Edit Deposit";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Deposit`;
    if (reasonGroup) reasonGroup.classList.remove("hidden");
  };

  isEdit ? setEditModeUI() : setAddModeUI();

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
  const methodSelect = document.getElementById("methodSelect");
  const transactionRefInput = document.getElementById("transactionRef");
  const notesInput = document.getElementById("notes");
  const reasonInput = document.getElementById("reason");

  /* ============================================================
     🔽 Prefill Dropdowns + Suggestions
  ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      // 🏢 Superadmin → Org + Facility cascade
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
      // 🧑‍💼 Admin → Only facility
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facilities = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facilities, "id", "name", "-- Select Facility --");
    } else {
      // 👷 Staff → Auto-hidden org/facility
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // ✅ Patient suggestion input
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected?.label ||
          (selected?.pat_no && selected?.full_name
            ? `${selected.pat_no} - ${selected.full_name}`
            : selected?.full_name || selected?.pat_no || "");
      },
      "label"
    );
  } catch (err) {
    console.error("❌ Dropdown load failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     🧩 Prefill If Editing
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      let entry = null;
      const raw = sessionStorage.getItem("depositEditPayload");
      if (raw) entry = JSON.parse(raw);

      if (!entry) {
        const res = await authFetch(`/api/deposits/${depositId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(
            normalizeMessage(result, `❌ Failed to load deposit (${res.status})`)
          );
      }

      // 🧾 Populate Fields
      if (entry.patient) {
        patientHidden.value = entry.patient.id;
        patientInput.value =
          entry.patient.label ||
          `${entry.patient.pat_no || ""} - ${entry.patient.full_name || ""}`.trim();
      }
      appliedInvoiceHidden.value = entry.applied_invoice_id || "";
      amountInput.value = entry.amount || "";
      methodSelect.value = entry.method || "";
      transactionRefInput.value = entry.transaction_ref || "";
      notesInput.value = entry.notes || "";
      reasonInput.value = entry.reason || "";

      if (entry.organization_id && orgSelect) {
        orgSelect.value = entry.organization_id;
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization_id },
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      if (entry.facility_id) facSelect.value = entry.facility_id;

      setEditModeUI();
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load deposit");
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
      patient_id: normalizeUUID(patientHidden.value),
      applied_invoice_id: normalizeUUID(appliedInvoiceHidden?.value || null),
      amount: parseFloat(amountInput?.value || 0) || null,
      method: methodSelect?.value || null,
      transaction_ref: transactionRefInput?.value || null,
      notes: notesInput?.value || null,
      reason: reasonInput?.value || null,
      organization_id: normalizeUUID(
        orgSelect?.value || localStorage.getItem("organizationId")
      ),
      facility_id: normalizeUUID(
        facSelect?.value || localStorage.getItem("facilityId")
      ),
    };

    console.groupCollapsed("🧾 [Deposit Submit Payload]");
    console.log(payload);
    console.groupEnd();

    const errors = validateDepositForm(payload, isEdit, userRole);
    if (errors.length > 0) {
      showToast("❌ " + errors.join("\n"));
      return;
    }

    const url = isEdit ? `/api/deposits/${depositId}` : `/api/deposits`;
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
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Deposit updated successfully");
        sessionStorage.removeItem("depositEditId");
        sessionStorage.removeItem("depositEditPayload");
        window.location.href = "/deposits-list.html";
      } else {
        showToast("✅ Deposit created successfully");
        form.reset();
        appliedInvoiceHidden.value = "";
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
    sessionStorage.removeItem("depositEditId");
    sessionStorage.removeItem("depositEditPayload");
    form.reset();
    appliedInvoiceHidden.value = "";
    setAddModeUI();
  });

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("depositEditId");
    sessionStorage.removeItem("depositEditPayload");
    window.location.href = "/deposits-list.html";
  });
}
