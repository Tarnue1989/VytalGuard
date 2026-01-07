// 📁 feature-access-form.js – Feature Access Form (Single + Bulk + Preview)

import {
  showToast,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import {
  loadFeatureModulesLite,
  loadRolesLite,
  loadFacilitiesLite,
  loadOrganizationsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { authFetch } from "../../authSession.js";

/* ============================================================
   🔧 Helpers
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
   🧠 Bulk State
============================================================ */
let bulkMode = false;
let selectedModuleIds = new Set();
let allModulesCache = [];

/* ============================================================
   🔽 Dropdowns
============================================================ */
async function populateDropdowns() {
  const [
    modules,
    roles,
    facilities,
    organizations,
  ] = await Promise.all([
    loadFeatureModulesLite(true),
    loadRolesLite({}, true),
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
    document.getElementById("role_id"),
    roles,
    "id",
    "name",
    "-- Select Role --"
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
}

/* ============================================================
   🔄 Reset Bulk State
============================================================ */
function resetBulkState() {
  bulkMode = false;
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
   📋 Preview Renderer (Multi-Column)
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
    const mod = allModulesCache.find(m => m.id === id);
    if (!mod) continue;

    const item = document.createElement("div");
    item.className = "form-check symptom-check"; // 👈 SAME class as triage

    item.innerHTML = `
      <input
        class="form-check-input"
        type="checkbox"
        id="module_${id}"
        checked
      />
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
   🚀 Main Setup
============================================================ */
export async function setupFeatureAccessFormSubmission({ form }) {
  await populateDropdowns();

  const addAllBtn = document.getElementById("addAllModulesBtn");
  const fullAccessBtn = document.getElementById("grantFullAccessBtn");
  const moduleSelect = document.getElementById("module_id");

  /* ---------------- Bulk Buttons ---------------- */

  addAllBtn?.addEventListener("click", () => {
    resetBulkState();
    bulkMode = true;

    allModulesCache.forEach((m) => selectedModuleIds.add(m.id));
    moduleSelect.disabled = true;
    addAllBtn.disabled = true;
    fullAccessBtn.disabled = true;

    renderPreview();
  });

  fullAccessBtn?.addEventListener("click", () => {
    resetBulkState();
    bulkMode = true;

    allModulesCache.forEach((m) => selectedModuleIds.add(m.id));
    moduleSelect.disabled = true;
    addAllBtn.disabled = true;
    fullAccessBtn.disabled = true;

    renderPreview();
  });

  document.getElementById("selectAllPreview")?.addEventListener("click", () => {
    allModulesCache.forEach((m) => selectedModuleIds.add(m.id));
    renderPreview();
  });

  document.getElementById("deselectAllPreview")?.addEventListener("click", () => {
    selectedModuleIds.clear();
    renderPreview();
  });

  /* ---------------- Submit ---------------- */

  form.onsubmit = async (e) => {
    e.preventDefault();

    const orgId = document.getElementById("organization_id")?.value;
    const roleId = document.getElementById("role_id")?.value;
    const facilityId = document.getElementById("facility_id")?.value || null;
    const status =
      document.querySelector("input[name='status']:checked")?.value || "active";

    if (!orgId) return showToast("❌ Organization is required");
    if (!roleId) return showToast("❌ Role is required");

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
          throw new Error(normalizeMessage(result, "Bulk grant failed"));

        showToast("✅ Feature access replaced successfully");
      } else {
        const moduleId = moduleSelect.value;
        if (!moduleId) return showToast("❌ Module is required");

        const res = await authFetch(`/api/features/feature-access`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id: orgId,
            role_id: roleId,
            module_id: moduleId,
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
      console.error("❌ Feature access submit error:", err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ---------------- Clear / Reset ---------------- */

  form.addEventListener("reset", () => {
    resetBulkState();
  });
}
