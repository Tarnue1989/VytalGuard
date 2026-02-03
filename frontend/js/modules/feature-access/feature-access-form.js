// 📁 feature-access-form.js – Secure & Rule-Driven Feature Access Form
// ============================================================================
// 🧭 Mirrors feature-module-form.js EXACTLY (structure + lifecycle)
// 🔹 Live validation + red fields
// 🔹 Single + Bulk replace (controller-faithful)
// 🔹 No silent coercion
// 🔹 Safe reset + preview lifecycle
// 🔹 Roles load ONLY after organization selection
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

import {
  loadFeatureModulesLite,
  loadRolesLite,
  loadFacilitiesLite,
  loadOrganizationsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { authFetch } from "../../authSession.js";

/* ============================================================
   🧩 Helpers
============================================================ */
function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

/* ============================================================
   📋 FORM RULES (mirrors module pattern)
============================================================ */
const FEATURE_ACCESS_FORM_RULES = [
  { id: "organization_id", message: "Organization is required" },
  { id: "role_id", message: "Role is required" },

  {
    id: "module_id",
    message: "Module is required",
    when: () => !window.__featureAccessBulkMode,
  },

  {
    id: "status",
    message: "Status is required",
    when: () => true,
  },
];

/* ============================================================
   🧠 Bulk State
============================================================ */
let bulkMode = false;
let selectedModuleIds = new Set();
let allModulesCache = [];

window.__featureAccessBulkMode = false;

/* ============================================================
   🔽 Dropdowns
============================================================ */
async function populateBaseDropdowns() {
  const [modules, facilities, organizations] = await Promise.all([
    loadFeatureModulesLite(true),
    loadFacilitiesLite({}, true),
    loadOrganizationsLite({}, true),
  ]);

  allModulesCache = modules || [];

  setupSelectOptions(
    document.getElementById("organization_id"),
    organizations,
    "id",
    "name",
    "-- Select Organization --"
  );

  setupSelectOptions(
    document.getElementById("module_id"),
    modules,
    "id",
    "name",
    "-- Select Module --"
  );

  setupSelectOptions(
    document.getElementById("facility_id"),
    facilities,
    "id",
    "name",
    "-- All Facilities (Org-wide) --"
  );

  // ⛔ roles intentionally NOT loaded here
  setupSelectOptions(
    document.getElementById("role_id"),
    [],
    "id",
    "name",
    "-- Select Organization First --"
  );
}

/* ============================================================
   🔁 Load Roles by Organization (STRICT)
============================================================ */
async function loadRolesForOrganization(orgId) {
  const roleSelect = document.getElementById("role_id");
  roleSelect.disabled = true;

  setupSelectOptions(
    roleSelect,
    [],
    "id",
    "name",
    "-- Loading roles... --"
  );

  if (!orgId) {
    setupSelectOptions(
      roleSelect,
      [],
      "id",
      "name",
      "-- Select Organization First --"
    );
    roleSelect.disabled = false;
    return;
  }

  const roles = await loadRolesLite({ organization_id: orgId }, true);

  setupSelectOptions(
    roleSelect,
    roles || [],
    "id",
    "name",
    "-- Select Role --"
  );

  roleSelect.disabled = false;
}

/* ============================================================
   🔄 Reset Bulk State
============================================================ */
function resetBulkState() {
  bulkMode = false;
  window.__featureAccessBulkMode = false;
  selectedModuleIds.clear();

  const list = document.getElementById("modulePreviewList");
  const container = document.getElementById("modulePreviewContainer");
  const moduleSelect = document.getElementById("module_id");
  const addAllBtn = document.getElementById("addAllModulesBtn");
  const fullAccessBtn = document.getElementById("grantFullAccessBtn");

  if (list) list.innerHTML = "";
  if (container) container.classList.add("d-none");
  if (moduleSelect) moduleSelect.disabled = false;
  if (addAllBtn) addAllBtn.disabled = false;
  if (fullAccessBtn) fullAccessBtn.disabled = false;
}

/* ============================================================
   📋 Preview Renderer (mirrors module card logic)
============================================================ */
function renderPreview() {
  const container = document.getElementById("modulePreviewContainer");
  const list = document.getElementById("modulePreviewList");

  list.innerHTML = "";

  if (!selectedModuleIds.size) {
    list.innerHTML = `<p class="text-muted mb-0">No modules selected</p>`;
    container.classList.remove("d-none");
    return;
  }

  for (const id of selectedModuleIds) {
    const mod = allModulesCache.find((m) => m.id === id);
    if (!mod) continue;

    const item = document.createElement("div");
    item.className = "form-check symptom-check";

    item.innerHTML = `
      <input class="form-check-input" type="checkbox" id="module_${id}" checked />
      <label class="form-check-label" for="module_${id}">
        <div class="fw-semibold">${mod.name}</div>
        <small class="text-muted">${mod.key}</small>
      </label>
    `;

    const checkbox = item.querySelector("input");
    checkbox.addEventListener("change", () => {
      checkbox.checked
        ? selectedModuleIds.add(id)
        : selectedModuleIds.delete(id);
    });

    list.appendChild(item);
  }

  container.classList.remove("d-none");
}

/* ============================================================
   🚀 Main Setup (MASTER-ALIGNED)
============================================================ */
export async function setupFeatureAccessFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  await populateBaseDropdowns();

  const orgSelect = document.getElementById("organization_id");
  const roleSelect = document.getElementById("role_id");
  const addAllBtn = document.getElementById("addAllModulesBtn");
  const fullAccessBtn = document.getElementById("grantFullAccessBtn");
  const moduleSelect = document.getElementById("module_id");

  /* ================= ORG → ROLE CHAIN ================= */

  orgSelect.addEventListener("change", async () => {
    roleSelect.value = "";
    await loadRolesForOrganization(orgSelect.value);
  });

  /* ================= BULK ACTIONS ================= */

  function enterBulkMode() {
    resetBulkState();
    bulkMode = true;
    window.__featureAccessBulkMode = true;

    allModulesCache.forEach((m) => selectedModuleIds.add(m.id));
    moduleSelect.disabled = true;
    addAllBtn.disabled = true;
    fullAccessBtn.disabled = true;

    renderPreview();
  }

  addAllBtn?.addEventListener("click", enterBulkMode);
  fullAccessBtn?.addEventListener("click", enterBulkMode);

  document.getElementById("selectAllPreview")?.addEventListener("click", () => {
    allModulesCache.forEach((m) => selectedModuleIds.add(m.id));
    renderPreview();
  });

  document
    .getElementById("deselectAllPreview")
    ?.addEventListener("click", () => {
      selectedModuleIds.clear();
      renderPreview();
    });

  /* ================= SUBMIT (RULE-DRIVEN) ================= */

  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of FEATURE_ACCESS_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

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

    const orgId = form.organization_id.value;
    const roleId = form.role_id.value;
    const facilityId = form.facility_id.value || null;
    const status =
      form.querySelector("input[name='status']:checked")?.value || "active";

    try {
      showLoading();

      if (bulkMode) {
        if (!selectedModuleIds.size)
          throw new Error("❌ No modules selected");

        const res = await authFetch(
          `/api/features/feature-access/by-role/${roleId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              organization_id: orgId,
              facility_id: facilityId,
              module_ids: Array.from(selectedModuleIds),
              status,
            }),
          }
        );

        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(
            normalizeMessage(result, "Bulk replace failed")
          );

        showToast("✅ Feature access replaced successfully");
      } else {
        const res = await authFetch(`/api/features/feature-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id: orgId,
            role_id: roleId,
            module_id: form.module_id.value,
            facility_id: facilityId,
            status,
          }),
        });

        const result = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(normalizeMessage(result, "Grant failed"));

        showToast("✅ Feature access granted");
      }

      resetBulkState();
      window.location.href = "/feature-access-list.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ================= CANCEL / RESET ================= */

  form.addEventListener("reset", () => {
    clearFormErrors(form);
    resetBulkState();
  });
}
