// 📁 add-feature-access.js – Init add/edit Feature Access page

import { setupFeatureAccessFormSubmission } from "./feature-access-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";

// 🔐 Auth Guard
initPageGuard("feature_accesses");
initLogoutWatcher();

// Shared edit ref (read-only for this page)
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset helper (ADD MODE ONLY)
============================================================ */
function resetForm() {
  const form = document.getElementById("featureAccessForm");
  if (!form) return;

  form.reset();
  document.getElementById("status_active")?.click();

  ["organization_id", "role_id", "module_id", "facility_id"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("featureAccessForm");
  if (!form) return;

  // Detect edit mode (session OR query)
  const editId =
    sessionStorage.getItem("featureAccessEditId") ||
    new URLSearchParams(window.location.search).get("id");

  const rawPayload = sessionStorage.getItem("featureAccessEditPayload");
  const isEdit = !!editId;

  if (isEdit) {
    sharedState.currentEditIdRef.value = editId;
  }

  // Init form logic (loads dropdowns + submit handler)
  await setupFeatureAccessFormSubmission({ form });

  /* ========================================================
     🔒 EDIT MODE LOCKDOWN
  ======================================================== */
  if (isEdit) {
    // Disable bulk buttons
    document.getElementById("addAllModulesBtn")?.setAttribute("disabled", true);
    document.getElementById("grantFullAccessBtn")?.setAttribute("disabled", true);

    // Hide preview controls
    document.getElementById("modulePreviewContainer")?.classList.add("d-none");
    document.getElementById("selectAllPreview")?.classList.add("d-none");
    document.getElementById("deselectAllPreview")?.classList.add("d-none");
  }

  /* ========================================================
     ✏️ Prefill (EDIT MODE)
  ======================================================== */
  async function prefillForm(entry) {
    document.getElementById("organization_id").value = entry.organization_id;
    document.getElementById("role_id").value = entry.role_id;
    document.getElementById("module_id").value = entry.module_id;
    document.getElementById("facility_id").value = entry.facility_id || "";

    document.getElementById(`status_${entry.status}`)?.click();

    // UI
    document.querySelector(".card-title").textContent = "Edit Feature Access";
    form.querySelector("button[type=submit]").innerHTML =
      `<i class="ri-save-3-line me-1"></i> Update Access`;
  }

  if (isEdit) {
    try {
      let entry = null;

      if (rawPayload) {
        entry = JSON.parse(rawPayload);
      } else {
        showLoading();
        const res = await authFetch(`/api/features/feature-access/${editId}`);
        const result = await res.json();
        if (!res.ok || !result?.data) {
          throw new Error(result?.message || "Failed to load feature access");
        }
        entry = result.data;
      }

      await prefillForm(entry);
    } catch (err) {
      console.error("❌ Edit load failed:", err);
      showToast(err.message || "❌ Failed to load feature access");
    } finally {
      hideLoading();
    }
  }

  /* ========================================================
     🚪 Cancel
  ======================================================== */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("featureAccessEditId");
    sessionStorage.removeItem("featureAccessEditPayload");
    window.location.href = "/feature-access-list.html";
  });

  /* ========================================================
     🧹 Clear (ADD MODE ONLY)
  ======================================================== */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (isEdit) return;
    resetForm();
  });
});
