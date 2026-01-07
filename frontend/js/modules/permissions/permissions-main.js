// 📦 permissions-main.js – Form-only loader for Permission

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupPermissionFormSubmission } from "./permissions-form.js";
import {
  FIELD_LABELS_PERMISSION,
  FIELD_ORDER_PERMISSION,
  FIELD_DEFAULTS_PERMISSION,
} from "./permissions-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth – allow users with create OR edit permission
const token = initPageGuard(["permissions:create", "permissions:edit"]);

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("permissionForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ------------------------- Helpers ------------------------- */

// 🧹 Reset form
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("permissionEditId");
  sessionStorage.removeItem("permissionEditPayload");

  // Explicitly clear fields
  ["key", "name", "description", "module", "category"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset checkbox
  const globalBox = document.getElementById("isGlobal");
  if (globalBox) globalBox.checked = false;

  // Clear dropdowns (org + facility)
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI
  const title = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  if (title) title.textContent = "Add Permission";
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Permission`;
}

// 🧭 Form show/hide
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("permissionFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("permissionFormVisible", "false");
}

// 🔗 Expose globally so action handlers can reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ------------------------- Wire Buttons ------------------------- */

if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/permissions-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Ensure stale edit data is gone
    sessionStorage.removeItem("permissionEditId");
    sessionStorage.removeItem("permissionEditPayload");

    // Reset form for clean Add mode
    resetForm();
    showForm();
  };
}

/* ------------------------- Loader ------------------------- */

// Stub – list page handles entries
async function loadEntries() {
  return;
}

/* ------------------------- Init ------------------------- */
export async function initPermissionModule() {
  showForm(); // open form by default

  // ✅ Preload dropdowns like appointments
  try {
    const orgSelect = document.getElementById("organizationSelect");
    const facSelect = document.getElementById("facilitySelect");
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    async function reloadFacilities(orgId = null) {
      const facs = await loadFacilitiesLite(
        orgId ? { organization_id: orgId } : {},
        true
      );
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }

    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      await reloadFacilities();
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load organization/facility lists");
  }

  // 🔑 Pass token + helpers to form submission
  setupPermissionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("permissionPanelVisible", "false");

  // 📌 Normalize role + permissions
  const roleRaw = localStorage.getItem("userRole") || "staff";
  const userRole = roleRaw.trim().toLowerCase();
  const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
  const user = { role: userRole, permissions: perms };

  // ✅ Use constants-driven defaults
  setupFieldSelector({
    module: "permission",
    fieldLabels: FIELD_LABELS_PERMISSION,
    fieldOrder: FIELD_ORDER_PERMISSION,
    defaultFields:
      FIELD_DEFAULTS_PERMISSION[userRole] ||
      FIELD_DEFAULTS_PERMISSION.staff,
  });
}

// (Optional)
export function syncRefsToState() {
  // no-op
}
