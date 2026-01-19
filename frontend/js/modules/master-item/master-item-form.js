// 📁 master-item-form.js – Secure & Role-Aware Master Item Form (ENTERPRISE PARITY)
// ============================================================================
// 🧭 FULL PARITY WITH department-form.js
// 🔹 Rule-driven validation (NO silent rules, NO HTML validation)
// 🔹 Role-aware org / facility handling
// 🔹 Clean payload normalization (UUID | null)
// 🔹 Feature Module dynamic search (UUID-safe)
// 🔹 Smart field toggling by item type (SAFE – no auto-hide on load)
// 🔹 Controller-faithful submission flow
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
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
  loadDepartmentsLite,
  loadMasterItemCategoriesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { MASTER_ITEM_FORM_RULES } from "./master-item.form.rules.js";

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
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

/* ============================================================
   ⚙️ Item-Type Driven Field Rules
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

/* ============================================================
   🧠 SAFE TOGGLER (NO AUTO-HIDE ON LOAD)
============================================================ */
function toggleFieldsByItemType(type) {
  if (!type) return; // 🔒 CRITICAL FIX — do not collapse form on load

  const all = [
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

  const show = ITEM_TYPE_FIELD_RULES[type] || [];

  all.forEach((id) => {
    const wrap = document
      .getElementById(id)
      ?.closest(".col-xxl-3, .col-xxl-4, .col-xxl-6, .col-sm-6, .col-sm-12");

    if (wrap) wrap.classList.toggle("d-none", !show.includes(id));
  });
}

/* ============================================================
   🚀 Main Setup
============================================================ */
export async function setupMasterItemFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  const itemId =
    sessionStorage.getItem("masterItemEditId") || getQueryParam("id");
  const isEdit = Boolean(itemId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (titleEl)
      titleEl.textContent =
        mode === "edit" ? "Edit Master Item" : "Add Master Item";
    if (submitBtn)
      submitBtn.innerHTML =
        mode === "edit"
          ? `<i class="ri-save-3-line me-1"></i> Update Item`
          : `<i class="ri-add-line me-1"></i> Add Item`;
  };
  setUI(isEdit ? "edit" : "add");

  /* ---------------- DOM ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const deptSelect = document.getElementById("departmentSelect");
  const catSelect = document.getElementById("categorySelect");
  const itemTypeSelect = document.getElementById("itemType");
  const codeInput = document.getElementById("code");

  const featureModuleInput = document.getElementById("featureModuleInput");
  const featureModuleId = document.getElementById("featureModuleId");
  const featureModuleSuggestions = document.getElementById(
    "featureModuleSuggestions"
  );

  const role = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🌐 Dropdowns
  ============================================================ */
  try {
    setupSelectOptions(
      catSelect,
      await loadMasterItemCategoriesLite({ status: "active" }, true),
      "id",
      "name",
      "-- Select Category --"
    );

    catSelect?.addEventListener("change", () => {
      const opt = catSelect.options[catSelect.selectedIndex];
      codeInput.value = opt?.dataset?.code || "";
    });

    if (role.includes("super")) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );

      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility --"
      );

      setupSelectOptions(
        deptSelect,
        await loadDepartmentsLite({}, true),
        "id",
        "name",
        "-- Select Department --"
      );

      orgSelect?.addEventListener("change", async () => {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            orgSelect.value ? { organization_id: orgSelect.value } : {},
            true
          ),
          "id",
          "name",
          "-- Select Facility --"
        );
      });
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");

      setupSelectOptions(
        deptSelect,
        await loadDepartmentsLite({}, true),
        "id",
        "name",
        "-- Select Department --"
      );
    }

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
  } catch {
    showToast("❌ Failed to load reference data");
  }

  itemTypeSelect?.addEventListener("change", (e) =>
    toggleFieldsByItemType(e.target.value)
  );

  /* ============================================================
     ✏️ Prefill
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();
      const res = await authFetch(`/api/master-items/${itemId}`);
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, "Failed to load item"));

      const e = result?.data?.records?.[0];
      if (!e) return;

      [
        "name",
        "generic_group",
        "strength",
        "dosage_form",
        "unit",
        "currency",
        "test_method",
      ].forEach((f) => {
        const el = document.getElementById(f);
        if (el) el.value = e[f] || "";
      });

      codeInput.value = e.code || "";
      document.getElementById("reorder_level").value = e.reorder_level || 0;
      document.getElementById("reference_price").value =
        e.reference_price || 0;

      document.getElementById("is_controlled").checked = !!e.is_controlled;
      document.getElementById("sample_required").checked =
        !!e.sample_required;

      orgSelect.value = e.organization_id || "";
      facSelect.value = e.facility_id || "";
      deptSelect.value = e.department_id || "";
      catSelect.value = e.category_id || "";
      itemTypeSelect.value = e.item_type || "";

      featureModuleInput.value = e.feature_module?.name || "";
      featureModuleId.value = e.feature_module_id || "";

      document
        .getElementById(`status_${e.status}`)
        ?.setAttribute("checked", true);

      toggleFieldsByItemType(e.item_type);
      setUI("edit");
    } catch (err) {
      showToast(err.message);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ Submit (RULE-DRIVEN)
  ============================================================ */
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    clearFormErrors(form);

    const errors = [];
    for (const rule of MASTER_ITEM_FORM_RULES) {
      if (rule.when && !rule.when()) continue;
      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);
      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    const payload = {
      name: document.getElementById("name").value.trim(),
      code: codeInput.value.trim(),
      generic_group: document.getElementById("generic_group")?.value || "",
      strength: document.getElementById("strength")?.value || "",
      dosage_form: document.getElementById("dosage_form")?.value || "",
      unit: document.getElementById("unit")?.value || "",
      reorder_level: +document.getElementById("reorder_level")?.value || 0,
      reference_price:
        +document.getElementById("reference_price")?.value || 0,
      currency: document.getElementById("currency")?.value || "",
      test_method: document.getElementById("test_method")?.value || "",
      is_controlled: !!document.getElementById("is_controlled")?.checked,
      sample_required:
        !!document.getElementById("sample_required")?.checked,
      item_type: itemTypeSelect.value,
      category_id: normalizeUUID(catSelect.value),
      department_id: normalizeUUID(deptSelect.value),
      organization_id: normalizeUUID(orgSelect?.value),
      facility_id: normalizeUUID(facSelect?.value),
      feature_module_id: normalizeUUID(featureModuleId.value),
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
    };

    try {
      showLoading();
      const res = await authFetch(
        isEdit ? `/api/master-items/${itemId}` : "/api/master-items",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(
        isEdit ? "✅ Item updated successfully" : "✅ Item created successfully"
      );
      sessionStorage.clear();
      window.location.href = "/master-items-list.html";
    } catch (err) {
      showToast(err.message);
    } finally {
      hideLoading();
    }
  };

  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/master-items-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI("add");
    document
      .getElementById("status_active")
      ?.setAttribute("checked", true);
    // ⛔ no toggleFieldsByItemType("") — intentional
  });
}
