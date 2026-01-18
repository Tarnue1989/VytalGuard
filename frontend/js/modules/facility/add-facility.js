// ============================================================================
// 🏥 VytalGuard – Facility Form Controller (Enterprise Master Pattern UPGRADED)
// 🔹 Mirrors add-role.js / organization-main.js lifecycle
// 🔹 Auth Guard + Logout Watcher + Prefill + Safe Reset
// 🔹 MATCHES CURRENT FACILITY HTML (name-based fields)
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
import {
  loadOrganizationsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard – permission auto-resolved from backend
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// Shared reference (master parity)
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

  // Reset organization select
  const orgSelect = document.getElementById("organizationSelect");
  if (orgSelect) orgSelect.value = "";

  // Reset status → active
  form
    .querySelector(`input[name="status"][value="active"]`)
    ?.setAttribute("checked", true);

  // UI → Add mode
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Facility";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Facility`;
  }
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("facilityForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");

  /* ==========================================================
     🧾 Form Submission (DELEGATED)
  ========================================================== */
  setupFacilityFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ==========================================================
     ✏️ Edit Mode Handling (CACHE → QUERY → API)
  ========================================================== */
  const editId = sessionStorage.getItem("facilityEditId");
  const rawPayload = sessionStorage.getItem("facilityEditPayload");

  async function applyPrefill(entry) {
    const setVal = (name, value) => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.value = value ?? "";
    };

    setVal("name", entry.name);
    setVal("code", entry.code);
    setVal("address", entry.address);
    setVal("phone", entry.phone);
    setVal("email", entry.email);

    // Status
    if (entry.status) {
      form
        .querySelector(
          `input[name="status"][value="${entry.status.toLowerCase()}"]`
        )
        ?.setAttribute("checked", true);
    }

    // Organization (SuperAdmin only)
    if (entry.organization_id && orgSelect) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );
      orgSelect.value = entry.organization_id;
    }

    // UI → Edit mode
    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit Facility";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Facility`;
    }
  }

  /* ==========================================================
     1️⃣ Cached Edit Session
  ========================================================== */
  if (editId && rawPayload) {
    try {
      sharedState.currentEditIdRef.value = editId;
      await applyPrefill(JSON.parse(rawPayload));
    } catch (err) {
      console.error("❌ Cached facility load failed:", err);
      showToast("❌ Could not load cached facility for editing");
    }
  } else {
    /* ========================================================
       2️⃣ Fallback: ?id Query Parameter
    ======================================================== */
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/facilities/${id}`);
        const result = await res.json().catch(() => ({}));
        const entry = result?.data;

        if (!res.ok || !entry)
          throw new Error(result?.message || "Failed to load facility");

        await applyPrefill(entry);
      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to load facility");
      } finally {
        hideLoading();
      }
    }
  }

  /* ==========================================================
     🚪 Cancel / Clear
  ========================================================== */
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
