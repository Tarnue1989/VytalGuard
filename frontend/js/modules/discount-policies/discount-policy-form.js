// 📁 discount-policy-form.js
import { showToast, showLoading, hideLoading } from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ----------------------------- helpers ----------------------------- */
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

function validatePolicyForm(payload, isEdit, userRole) {
  const errors = [];

  if (!payload.code || payload.code.trim().length < 2)
    errors.push("Policy code is required");
  if (!payload.name || payload.name.trim().length < 3)
    errors.push("Policy name is required");
  if (!payload.discount_type) errors.push("Discount type is required");
  if (!payload.discount_value || payload.discount_value <= 0)
    errors.push("Valid discount value is required");
  if (payload.discount_type === "percentage" && payload.discount_value > 100)
    errors.push("Percentage policy cannot exceed 100%");

  // Role-based scope checks
  const role = userRole.toLowerCase();
  if (role.includes("super")) {
    if (!payload.organization_id) errors.push("Organization is required");
    if (!payload.facility_id) errors.push("Facility is required");
  } else if (role.includes("org_owner")) {
    if (!payload.facility_id) errors.push("Facility is required");
  }

  // Valid dates
  if (payload.effective_from && payload.effective_to) {
    if (new Date(payload.effective_to) < new Date(payload.effective_from)) {
      errors.push("Effective To date cannot be before Effective From");
    }
  }

  return errors;
}

/* ----------------------------- main init ----------------------------- */
export async function setupDiscountPolicyFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("discountPolicyEditId");
  const queryId = getQueryParam("id");
  const policyId = sessionId || queryId;
  const isEdit = !!policyId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  function setAddModeUI() {
    if (titleEl) titleEl.textContent = "Add Discount Policy";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Policy`;
  }
  function setEditModeUI() {
    if (titleEl) titleEl.textContent = "Edit Discount Policy";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Policy`;
  }
  isEdit ? setEditModeUI() : setAddModeUI();

  // 🔗 Form fields
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const codeInput = document.getElementById("code");
  const nameInput = document.getElementById("name");
  const descInput = document.getElementById("description");
  const typeSelect = document.getElementById("typeSelect");
  const valueInput = document.getElementById("value");
  const appliesToSelect = document.getElementById("appliesToSelect");
  const conditionJsonInput = document.getElementById("conditionJson");
  const effectiveFromInput = document.getElementById("effectiveFrom");
  const effectiveToInput = document.getElementById("effectiveTo");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    // ✅ Superadmins → org + facility cascade
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );

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
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");

      const facilities = await loadFacilitiesLite({}, true);
      if (facilities.length && facSelect) {
        setupSelectOptions(
          facSelect,
          facilities,
          "id",
          "name",
          "-- Select Facility --"
        );
        facSelect.value = localStorage.getItem("facilityId") || "";
      }
    }

    // ✅ Prefill if editing
    if (isEdit) {
      try {
        showLoading();
        const raw = sessionStorage.getItem("discountPolicyEditPayload");
        let entry = raw ? JSON.parse(raw) : null;

        if (!entry) {
          const res = await authFetch(`/api/discount-policies/${policyId}`);
          const result = await res.json();
          entry = result?.data;
          if (!res.ok || !entry)
            throw new Error(
              normalizeMessage(result, `❌ Failed to load policy`)
            );
        }

        // Prefill fields
        if (entry.code) codeInput.value = entry.code;
        if (entry.name) nameInput.value = entry.name;
        if (entry.description) descInput.value = entry.description;
        if (entry.discount_type) typeSelect.value = entry.discount_type;
        if (entry.discount_value) valueInput.value = entry.discount_value;
        if (entry.applies_to) appliesToSelect.value = entry.applies_to;
        if (entry.condition_json)
          conditionJsonInput.value = JSON.stringify(entry.condition_json, null, 2);
        if (entry.effective_from)
          effectiveFromInput.value = entry.effective_from.split("T")[0];
        if (entry.effective_to)
          effectiveToInput.value = entry.effective_to.split("T")[0];

        if (entry.organization_id && orgSelect)
          orgSelect.value = entry.organization_id;
        if (entry.facility_id && facSelect)
          facSelect.value = entry.facility_id;

        setEditModeUI();
      } catch (err) {
        console.error("❌ Prefill error:", err);
        showToast(err.message || "❌ Could not load policy");
      } finally {
        hideLoading();
      }
    }
  } catch (err) {
    console.error("❌ Failed to load dropdowns:", err);
    showToast("❌ Failed to load reference lists");
  }

  // 🚀 Submit handler
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    let parsedCondition = null;
    if (conditionJsonInput?.value) {
      try {
        parsedCondition = JSON.parse(conditionJsonInput.value);
      } catch {
        showToast("❌ Invalid JSON in Conditions field");
        return;
      }
    }

    const payload = {
      code: codeInput?.value || null,
      name: nameInput?.value || null,
      description: descInput?.value || null,
      discount_type: typeSelect?.value || null,
      discount_value: parseFloat(valueInput?.value || 0) || null,
      applies_to: appliesToSelect?.value || "all",
      condition_json: parsedCondition,
      effective_from: effectiveFromInput?.value || null,
      effective_to: effectiveToInput?.value || null,
      // 🚫 status removed – backend handles it
      organization_id: normalizeUUID(
        orgSelect?.value || localStorage.getItem("organizationId")
      ),
      facility_id: normalizeUUID(
        facSelect?.value || localStorage.getItem("facilityId")
      ),
    };

    const errors = validatePolicyForm(payload, isEdit, userRole);
    if (errors.length > 0) {
      showToast("❌ " + errors.join("\n"));
      return;
    }

    const url = isEdit
      ? `/api/discount-policies/${policyId}`
      : `/api/discount-policies`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let result = {};
      try {
        result = await res.json();
      } catch {}
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      if (isEdit) {
        showToast("✅ Policy updated successfully");
        sessionStorage.removeItem("discountPolicyEditId");
        sessionStorage.removeItem("discountPolicyEditPayload");
        window.location.href = "/discount-policies-list.html";
      } else {
        showToast("✅ Policy created successfully");
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

  // Clear
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountPolicyEditId");
    sessionStorage.removeItem("discountPolicyEditPayload");
    form.reset();
    setAddModeUI();
  });

  // Cancel
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountPolicyEditId");
    sessionStorage.removeItem("discountPolicyEditPayload");
    form.reset();
    setAddModeUI();
    window.location.href = "/discount-policies-list.html";
  });
}
