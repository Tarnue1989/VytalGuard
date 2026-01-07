// 📦 role-permissions-main.js – Form-only loader for Role Permission (Suggestion + Pills)

import {
  initPageGuard,
  initLogoutWatcher,
  showToast,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { setupPermissionFormSubmission } from "./permission-form.js";
import {
  FIELD_LABELS_ROLE_PERMISSION,
  FIELD_ORDER_ROLE_PERMISSION,
  FIELD_DEFAULTS_ROLE_PERMISSION,
} from "./role-permissions-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard (create OR edit)
const token = initPageGuard(["role_permissions:create", "role_permissions:edit"]);
initLogoutWatcher();

// 🌐 Shared State
const sharedState = { currentEditIdRef: { value: null } };

// 📎 DOM Refs
const form = document.getElementById("rolePermissionForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🔧 Helpers
============================================================ */

// 🧹 Reset form
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // clear hidden + suggestion
  const permInput = document.getElementById("permissionSearch");
  const permHidden = document.getElementById("permission_id");
  if (permInput) permInput.value = "";
  if (permHidden) permHidden.value = "";

  // clear cached edit state
  sessionStorage.removeItem("rolePermissionEditId");
  sessionStorage.removeItem("rolePermissionEditPayload");

  // reset selects
  ["organizationSelect", "facilitySelect", "roleSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // reset pills
  const pillsContainer = document.getElementById("permissionPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML = `<p class="text-muted">No permissions added yet.</p>`;

  // reset title/button
  const title = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  if (title) title.textContent = "Add Role Permission";
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Role Permission`;
}

// 🧭 Show/hide form
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("rolePermissionFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("rolePermissionFormVisible", "false");
}

// 🔗 Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Button Wiring
============================================================ */

if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/role-permissions-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("rolePermissionEditId");
    sessionStorage.removeItem("rolePermissionEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🚀 Main Module Init
============================================================ */
export async function initRolePermissionModule() {
  showForm(); // open by default

  // ✅ Preload dropdowns
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

  // 🔑 Setup form logic
  setupPermissionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: () => {},
  });

  // 🧩 Constants-driven field selector
  const roleRaw = localStorage.getItem("userRole") || "staff";
  const normalizedRole = roleRaw.trim().toLowerCase();
  const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
  const user = { role: normalizedRole, permissions: perms };

  setupFieldSelector({
    module: "rolePermission",
    fieldLabels: FIELD_LABELS_ROLE_PERMISSION,
    fieldOrder: FIELD_ORDER_ROLE_PERMISSION,
    defaultFields:
      FIELD_DEFAULTS_ROLE_PERMISSION[normalizedRole] ||
      FIELD_DEFAULTS_ROLE_PERMISSION.staff,
  });
}

// optional (future)
export function syncRefsToState() {
  // no-op
}
