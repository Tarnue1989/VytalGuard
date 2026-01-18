// 📦 facility-main.js – Form-only loader for Facility (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors role-main.js structure EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility + reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration
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
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

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
   🧹 Reset Form
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  form?.reset();

  sessionStorage.removeItem("facilityEditId");
  sessionStorage.removeItem("facilityEditPayload");

  ["name", "code", "address", "phone", "email"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("status_active")?.setAttribute("checked", true);

  const orgInput = document.getElementById("organizationInput");
  const orgHidden = document.getElementById("organization_id");
  if (orgInput) orgInput.value = "";
  if (orgHidden) orgHidden.value = "";

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

// 🔗 Expose for action handlers
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
cancelBtn &&
  (cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/facilities-list.html";
  });

clearBtn && (clearBtn.onclick = resetForm);

desktopAddBtn &&
  (desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("facilityEditId");
    sessionStorage.removeItem("facilityEditPayload");
    resetForm();
    showForm();
  });

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initFacilityModule() {
  localStorage.getItem("facilityFormVisible") === "true"
    ? showForm()
    : hideForm();

  form &&
    setupFacilityFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });

  localStorage.setItem("facilityPanelVisible", "false");

  /* -------- Prefill Edit Mode -------- */
  const editId = sessionStorage.getItem("facilityEditId");
  const rawPayload = sessionStorage.getItem("facilityEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";
    document.getElementById("address").value = entry.address || "";
    document.getElementById("phone").value = entry.phone || "";
    document.getElementById("email").value = entry.email || "";

    if (entry.status) {
      const radio = document.getElementById(
        `status_${entry.status.toLowerCase()}`
      );
      if (radio) radio.checked = true;
    }

    const orgInput = document.getElementById("organizationInput");
    const orgHidden = document.getElementById("organization_id");
    if (orgInput && orgHidden) {
      orgInput.value = entry.organization?.name || "";
      orgHidden.value =
        entry.organization_id || entry.organization?.id || "";
    }

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
  }

  /* -------- Normalize user role -------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "facility",
    fieldLabels: FIELD_LABELS_FACILITY,
    fieldOrder: FIELD_ORDER_FACILITY,
    defaultFields: FIELD_DEFAULTS_FACILITY[role],
  });
}

/* ============================================================
   (Optional) Sync Stub
============================================================ */
export function syncRefsToState() {}
