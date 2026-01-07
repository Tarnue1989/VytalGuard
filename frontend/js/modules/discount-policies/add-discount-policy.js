// 📁 discount-policy-main.js
import { setupDiscountPolicyFormSubmission } from "./discount-policy-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – driven by backend permissions
const token = initPageGuard("discount-policies");
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

// 🧹 Reset form helper → back to Add mode
function resetForm() {
  const form = document.getElementById("discountPolicyForm");
  if (!form) return;
  form.reset();
  sharedState.currentEditIdRef.value = null;

  // reset hidden IDs
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  document.querySelector(".card-title").textContent = "Add Discount Policy";
  form.querySelector("button[type=submit]").innerHTML =
    `<i class="ri-add-line me-1"></i> Add Policy`;
}

// 🚀 Init
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("discountPolicyForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  // ✅ Organizations (super admins only)
  if (userRole.includes("super")) {
    try {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );
    } catch (err) {
      console.error("❌ Organizations preload failed", err);
    }
  } else {
    orgSelect?.closest(".form-group")?.classList.add("hidden");
  }

  // ✅ Facilities
  async function reloadFacilities(orgId = null) {
    try {
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
    } catch (err) {
      console.error("❌ Facilities preload failed", err);
      showToast("❌ Could not load facilities");
    }
  }

  if (userRole.includes("super")) {
    orgSelect?.addEventListener("change", async () => {
      await reloadFacilities(orgSelect.value || null);
    });
  } else if (userRole.includes("admin")) {
    await reloadFacilities();
  } else {
    facSelect?.closest(".form-group")?.classList.add("hidden");
  }

  // Hook submission
  setupDiscountPolicyFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  // --- Handle edit mode ---
  const editId = sessionStorage.getItem("discountPolicyEditId");
  const rawPayload = sessionStorage.getItem("discountPolicyEditPayload");

  async function applyPrefill(entry) {
    if (entry.code) document.getElementById("code").value = entry.code;
    if (entry.name) document.getElementById("name").value = entry.name;
    if (entry.description)
      document.getElementById("description").value = entry.description;
    if (entry.discount_type)
      document.getElementById("typeSelect").value = entry.discount_type;
    if (entry.discount_value)
      document.getElementById("value").value = entry.discount_value;

    // 🔹 New fields
    if (entry.applies_to)
      document.getElementById("appliesToSelect").value = entry.applies_to;
    if (entry.condition_json)
      document.getElementById("conditionJson").value =
        JSON.stringify(entry.condition_json, null, 2);

    if (entry.effective_from)
      document.getElementById("effectiveFrom").value =
        entry.effective_from.split("T")[0];
    if (entry.effective_to)
      document.getElementById("effectiveTo").value =
        entry.effective_to.split("T")[0];

    // ✅ Handle org + facility prefill
    const orgId = entry.organization?.id || entry.organization_id;
    const facId = entry.facility?.id || entry.facility_id;

    if (orgId && orgSelect) {
      orgSelect.value = orgId;
      await reloadFacilities(orgId);
    }
    if (facId && facSelect) {
      facSelect.value = facId;
    }

    // ✅ Update UI
    document.querySelector(".card-title").textContent = "Edit Discount Policy";
    form.querySelector("button[type=submit]").innerHTML =
      `<i class="ri-save-3-line me-1"></i> Update Policy`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached policy for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/discount-policies/${id}`);
        const result = await res.json();
        const entry = result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch policy");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load policy:", err);
        showToast(err.message || "❌ Failed to load policy for editing");
      } finally {
        hideLoading();
      }
    }
  }

  // 🚪 Cancel
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountPolicyEditId");
    sessionStorage.removeItem("discountPolicyEditPayload");
    window.location.href = "/discount-policies-list.html";
  });

  // 🚪 Clear
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("discountPolicyEditId");
    sessionStorage.removeItem("discountPolicyEditPayload");
    resetForm();
  });
});
