// ============================================================================
// 🏥 VytalGuard – Facility Main (Enterprise Master Pattern Aligned)
// 🔹 Mirrors organization-main.js for unified form lifecycle & permissions
// 🔹 Keeps all IDs, dynamic org logic, and bindings intact
// 🔹 Integrates permission-aware guard, field selector, and reset/show/hide flow
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
  showToast,
} from "../../utils/index.js";
import { setupFacilityFormSubmission } from "./facility-form.js";
import {
  FIELD_LABELS_FACILITY,
  FIELD_ORDER_FACILITY,
  FIELD_DEFAULTS_FACILITY,
} from "./facility-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";
import { authFetch } from "../../authSession.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
// Automatically resolve correct permission ("facilities:create" / "facilities:edit")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("facilityForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit session
  sessionStorage.removeItem("facilityEditId");
  sessionStorage.removeItem("facilityEditPayload");

  // Reset text inputs
  ["name", "code", "address", "phone", "email"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset status
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Reset dynamic org input
  const orgInput = document.getElementById("organizationInput");
  const orgHidden = document.getElementById("organization_id");
  if (orgInput) orgInput.value = "";
  if (orgHidden) orgHidden.value = "";

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Facility";
  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Facility`;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("facilityFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("facilityFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/facilities-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("facilityEditId");
    sessionStorage.removeItem("facilityEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op placeholder)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initFacilityModule() {
  showForm(); // auto-open form on dedicated add page

  setupFacilityFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("facilityPanelVisible", "false");

  // Prefill when editing (cached or query)
  const editId = sessionStorage.getItem("facilityEditId");
  const rawPayload = sessionStorage.getItem("facilityEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";
    document.getElementById("address").value = entry.address || "";
    document.getElementById("phone").value = entry.phone || "";
    document.getElementById("email").value = entry.email || "";

    if (entry.status) {
      const radio = document.getElementById(`status_${entry.status.toLowerCase()}`);
      if (radio) radio.checked = true;
    }

    // Prefill org dynamic input
    const orgInput = document.getElementById("organizationInput");
    const orgHidden = document.getElementById("organization_id");
    if (orgInput && orgHidden) {
      orgInput.value = entry.organization?.name || "";
      orgHidden.value = entry.organization_id || entry.organization?.id || "";
    }

    // Switch UI to Edit mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Facility";
    const submitBtn = form?.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Facility`;

    form?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  try {
    if (editId && rawPayload) {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } else {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");
      if (id) {
        sharedState.currentEditIdRef.value = id;
        const res = await authFetch(`/api/facilities/${id}`);
        const data = await res.json().catch(() => ({}));
        const entry = data?.data;
        if (entry) await applyPrefill(entry);
      }
    }
  } catch (err) {
    console.error("❌ Facility prefill failed:", err);
    showToast("❌ Failed to load facility for editing");
  } finally {
    sessionStorage.removeItem("facilityEditId");
    sessionStorage.removeItem("facilityEditPayload");
    sessionStorage.removeItem("facilityEditFrom");
  }

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector
  setupFieldSelector({
    module: "facility",
    fieldLabels: FIELD_LABELS_FACILITY,
    fieldOrder: FIELD_ORDER_FACILITY,
    defaultFields: FIELD_DEFAULTS_FACILITY[role],
  });
}

/* ============================================================
   🔁 Sync Helper (Reserved for reactive integrations)
============================================================ */
export function syncRefsToState() {
  // reserved
}

// ============================================================================
// ✅ Enterprise Pattern Summary:
//    • Auth Guard via autoPagePermissionKey()
//    • Full resetForm & show/hideForm parity with organization-main.js
//    • Safe fieldSelector + role-based visibility
//    • Consistent Add/Edit lifecycle + cached prefill support
// ============================================================================
