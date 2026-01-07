// ============================================================================
// 🏥 VytalGuard – Facility Form Controller (Enterprise Master Pattern Aligned)
// 🔹 Mirrors organization-main.js for unified add/edit lifecycle
// 🔹 Auth Guard + Logout Watcher + Prefill + Safe Reset
// 🔹 Preserves all IDs, fields, and existing dynamic behavior
// ============================================================================

import { setupFacilityFormSubmission } from "./facility-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";

// 🔐 Auth Guard – permission auto-resolved from backend ("facilities:create/edit")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference (consistent with other modules)
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form (Back to Add Mode)
============================================================ */
function resetForm() {
  const form = document.getElementById("facilityForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // 🩺 Reset org dynamic inputs
  const orgInput = document.getElementById("organizationInput");
  const orgHidden = document.getElementById("organization_id");
  if (orgInput) orgInput.value = "";
  if (orgHidden) orgHidden.value = "";

  // 🔄 Reset status
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // 🏷 UI back to Add mode
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Facility";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Facility`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("facilityForm");
  if (!form) return;

  // 🧩 Hook up unified form submission
  setupFacilityFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  // ============================================================
  // ✏️ Edit Mode Handling (Session or Query Param)
  // ============================================================
  const editId = sessionStorage.getItem("facilityEditId");
  const rawPayload = sessionStorage.getItem("facilityEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("name").value = entry.name || "";
    document.getElementById("code").value = entry.code || "";
    document.getElementById("address").value = entry.address || "";
    document.getElementById("phone").value = entry.phone || "";
    document.getElementById("email").value = entry.email || "";

    if (entry.status) {
      const statusEl = document.getElementById(
        `status_${entry.status.toLowerCase()}`
      );
      if (statusEl) statusEl.checked = true;
    }

    // 🧩 Prefill Organization
    const orgInput = document.getElementById("organizationInput");
    const orgHidden = document.getElementById("organization_id");
    if (orgInput && orgHidden) {
      orgInput.value = entry.organization?.name || "";
      orgHidden.value = entry.organization_id || entry.organization?.id || "";
    }

    // 🏷 Switch UI to Edit mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Facility";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Facility`;
  }

  /* ============================================================
     1️⃣ Cached Edit Session Payload
  ============================================================ */
  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached edit payload:", err);
      showToast("❌ Could not load cached facility for editing");
    }
  } else {
    /* ============================================================
       2️⃣ Fallback: ?id Query Parameter
    ============================================================ */
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/facilities/${id}`);
        const result = await res.json().catch(() => ({}));
        const entry = result?.data;

        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch facility");
        await applyPrefill(entry);
      } catch (err) {
        console.error("❌ Failed to load facility:", err);
        showToast(err.message || "❌ Failed to load facility for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🚪 Cancel / Clear Buttons (if any present)
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("facilityEditId");
    sessionStorage.removeItem("facilityEditPayload");
    window.location.href = "/facilities-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("facilityEditId");
    sessionStorage.removeItem("facilityEditPayload");
    resetForm();
  });
});

// ============================================================================
// ✅ Enterprise Master Pattern Summary:
//    • Uses autoPagePermissionKey() for permission-aware auth guard
//    • Safe unified Add/Edit lifecycle (sharedState tracking)
//    • Same structure as organization-main.js
//    • All field IDs, inputs, and behaviors preserved exactly
// ============================================================================
