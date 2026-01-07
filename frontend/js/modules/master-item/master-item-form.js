// 📁 master-item-form.js – Secure & Role-Aware Master Item Form (Enterprise-Aligned + Dynamic Module Support)
// ============================================================================
// 🧭 Master Pattern: master-item-category-form.js / autoBillingRule-form.js
// 🔹 Adds dynamic Feature Module search (UUID-safe)
// 🔹 Enterprise submission flow, permission logic, and UI behavior
// 🔹 Smart field toggling by item type (drug, consumable, service)
// 🔹 100% ID & DOM consistency with linked backend + HTML
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadMasterItemCategoriesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic, // ✅ for Feature Module dynamic search
} from "../../utils/data-loaders.js";

/* ============================================================
   🔧 Helpers
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

/* ============================================================
   ⚙️ Smart Field Visibility (Driven by Item Type)
============================================================ */
const ITEM_TYPE_FIELD_RULES = {
  drug: [
    "generic_group",
    "strength",
    "dosage_form",
    "unit",
    "reorder_level",
    "is_controlled",
    "sample_required",
  ],
  consumable: ["unit", "reorder_level", "sample_required"],
  service: ["test_method", "sample_required"],
};

function toggleFieldsByItemType(itemType) {
  const allFields = [
    "generic_group",
    "strength",
    "dosage_form",
    "unit",
    "reorder_level",
    "reference_price",
    "currency",
    "is_controlled",
    "sample_required",
    "test_method",
  ];
  const fieldsToShow = ITEM_TYPE_FIELD_RULES[itemType] || [];

  allFields.forEach((fid) => {
    const wrapper = document
      .getElementById(fid)
      ?.closest(".col-xxl-3, .col-xxl-4, .col-xxl-6, .col-sm-6, .col-sm-12");
    if (!wrapper) return;
    wrapper.classList.toggle("d-none", !fieldsToShow.includes(fid));
  });
}

/* ============================================================
   🚀 Setup Master Item Form Submission
============================================================ */
export async function setupMasterItemFormSubmission({ form }) {
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("masterItemEditId");
  const queryId = getQueryParam("id");
  const itemId = sessionId || queryId;
  const isEdit = !!itemId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Master Item");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Item`);
    } else {
      titleEl && (titleEl.textContent = "Add Master Item");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Item`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🌐 DOM References
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const catSelect = document.getElementById("categorySelect");
  const itemTypeSelect = document.getElementById("itemType");
  const codeInput = document.getElementById("code");

  // ✅ New Feature Module field
  const featureModuleInput = document.getElementById("featureModuleInput");
  const featureModuleId = document.getElementById("featureModuleId");
  const featureModuleSuggestions = document.getElementById("featureModuleSuggestions");

  /* ============================================================
     🧭 Prefill Dropdowns (Org/Facility/Dept/Category)
  ============================================================ */
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    // Categories
    try {
      const cats = await loadMasterItemCategoriesLite({ status: "active" }, true);
      setupSelectOptions(catSelect, cats, "id", "name", "-- Select Category --");
    } catch (err) {
      console.warn("⚠️ Could not load categories:", err);
    }

    // Auto-fill code from selected category
    catSelect?.addEventListener("change", () => {
      const selectedOption = catSelect.options[catSelect.selectedIndex];
      const catCode = selectedOption?.dataset.code;
      codeInput.value = catCode ? catCode.trim().toLowerCase() : "";
    });

    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

      const depts = await loadDepartmentsLite({}, true);
      setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");

      orgSelect?.addEventListener("change", async () => {
        try {
          const orgId = orgSelect.value;
          const facs = await loadFacilitiesLite(
            orgId ? { organization_id: orgId } : {},
            true
          );
          setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
        } catch (err) {
          console.error("❌ Facilities reload failed:", err);
          showToast("❌ Could not load facilities for organization");
        }
      });
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

      const depts = await loadDepartmentsLite({}, true);
      setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");

      try {
        const depts = await loadDepartmentsLite({}, true);
        setupSelectOptions(deptSelect, depts, "id", "name", "-- Select Department --");
      } catch (err) {
        console.warn("⚠️ Could not load departments:", err);
      }
    }
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     🔍 Dynamic Feature Module Search (same as autoBillingRule)
  ============================================================ */
  try {
    setupSuggestionInputDynamic(
      featureModuleInput,
      featureModuleSuggestions,
      "/api/lite/feature-modules",
      (item) => {
        featureModuleInput.value = item.name;
        featureModuleId.value = item.id;
      },
      "name"
    );
  } catch (err) {
    console.error("⚠️ Feature Module search initialization failed:", err);
  }

  /* ============================================================
     🧩 Dynamic Toggle by Item Type
  ============================================================ */
  itemTypeSelect?.addEventListener("change", (e) => {
    const selectedType = e.target.value;
    toggleFieldsByItemType(selectedType);
  });

  /* ============================================================
     ✏️ Prefill if Editing
  ============================================================ */
  if (isEdit && itemId) {
    try {
      showLoading();
      const res = await authFetch(`/api/master-items/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load item"));
      const entry = result?.data;
      if (!entry) return;

      // Populate fields
      document.getElementById("name").value = entry.name || "";
      codeInput.value = entry.code || "";
      document.getElementById("generic_group").value = entry.generic_group || "";
      document.getElementById("strength").value = entry.strength || "";
      document.getElementById("dosage_form").value = entry.dosage_form || "";
      document.getElementById("unit").value = entry.unit || "";
      document.getElementById("reorder_level").value = entry.reorder_level || 0;
      document.getElementById("reference_price").value = entry.reference_price || 0;
      document.getElementById("currency").value = entry.currency || "";
      document.getElementById("test_method").value = entry.test_method || "";
      document.getElementById("is_controlled").checked = !!entry.is_controlled;
      document.getElementById("sample_required").checked = !!entry.sample_required;

      orgSelect.value = entry.organization_id || "";
      facSelect.value = entry.facility_id || "";
      deptSelect.value = entry.department_id || "";
      catSelect.value = entry.category_id || "";
      itemTypeSelect.value = entry.item_type || "";

      // ✅ Prefill Feature Module
      featureModuleInput.value = entry.feature_module?.name || "";
      featureModuleId.value = entry.feature_module_id || "";

      if (entry.status) {
        const radio = document.getElementById(`status_${entry.status.toLowerCase()}`);
        if (radio) radio.checked = true;
      }

      toggleFieldsByItemType(entry.item_type);
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load item");
    }
  } else {
    toggleFieldsByItemType("");
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      name: (document.getElementById("name")?.value || "").trim(),
      code: (codeInput?.value || "").trim(),
      generic_group: (document.getElementById("generic_group")?.value || "").trim(),
      strength: (document.getElementById("strength")?.value || "").trim(),
      dosage_form: (document.getElementById("dosage_form")?.value || "").trim(),
      unit: (document.getElementById("unit")?.value || "").trim(),
      reorder_level: +document.getElementById("reorder_level")?.value || 0,
      reference_price: +document.getElementById("reference_price")?.value || 0,
      currency: (document.getElementById("currency")?.value || "").trim(),
      test_method: (document.getElementById("test_method")?.value || "").trim(),
      is_controlled: !!document.getElementById("is_controlled")?.checked,
      sample_required: !!document.getElementById("sample_required")?.checked,
      item_type: itemTypeSelect?.value || null,
      category_id: normalizeUUID(catSelect?.value),
      department_id: normalizeUUID(deptSelect?.value),
      organization_id: normalizeUUID(orgSelect?.value),
      facility_id: normalizeUUID(facSelect?.value),
      feature_module_id: normalizeUUID(featureModuleId?.value), // ✅ Send as UUID
      status:
        document.querySelector("input[name='status']:checked")?.value || "active",
    };

    if (!payload.name) return showToast("❌ Item Name is required");
    if (!payload.code) return showToast("❌ Item Code is required");

    try {
      showLoading();
      const url = isEdit ? `/api/master-items/${itemId}` : `/api/master-items`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(
        isEdit
          ? "✅ Item updated successfully"
          : "✅ Item created successfully"
      );

      sessionStorage.removeItem("masterItemEditId");
      sessionStorage.removeItem("masterItemEditPayload");

      if (isEdit) window.location.href = "/master-items-list.html";
      else {
        form.reset();
        setUI("add");
        document.getElementById("status_active")?.setAttribute("checked", true);
        toggleFieldsByItemType("");
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemEditId");
    sessionStorage.removeItem("masterItemEditPayload");
    window.location.href = "/master-items-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemEditId");
    sessionStorage.removeItem("masterItemEditPayload");
    form.reset();
    setUI("add");
    document.getElementById("status_active")?.setAttribute("checked", true);
    toggleFieldsByItemType("");
  });
}
