// 📦 patientchart-form.js – Secure & Role-Aware Patient Chart Cache Generator (Enterprise-Aligned)
// ============================================================================
// 🔹 Mirrors consultation-form.js master pattern
// 🔹 Handles Organization / Facility / Patient (role-aware dropdowns)
// 🔹 Triggers backend invalidate-cache API to generate/revalidate snapshot
// 🔹 🚫 No edit mode – only generate/revalidate logic
// ============================================================================

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
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔧 Helpers
============================================================ */
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
  return val && val.trim() !== "" ? val : null;
}

/* ============================================================
   🚀 Setup Patient Chart Form (Generate Only)
============================================================ */
export async function setupPatientChartFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  // ✅ Static UI (no edit mode)
  if (titleEl) titleEl.textContent = "Generate / Revalidate Patient Chart Cache";
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-database-2-line me-1"></i> Generate Cache`;

  /* ============================================================
     🧭 Dropdowns & Patient Search
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    // 🔹 Organization & Facility Scoping
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // 🔹 Patient Search Suggestion
    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected.label ||
          (selected.pat_no && selected.full_name
            ? `${selected.pat_no} - ${selected.full_name}`
            : selected.full_name || selected.pat_no || "");
      },
      "label"
    );
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     💾 Submit Handler – Generate / Revalidate Cache
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const patientId = normalizeUUID(patientHidden.value);
    if (!patientId) return showToast("❌ Please select a patient");

    try {
      showLoading();
      const res = await authFetch(
        `/api/patient-chart/patient/${patientId}/cache/invalidate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast("✅ Patient chart cache generated successfully");

      form.reset();
      patientHidden.value = "";

      // Optional: redirect to list view after success
      setTimeout(() => {
        window.location.href = "/patientchart-list.html";
      }, 1200);
    } catch (err) {
      hideLoading();
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Failed to generate cache");
    }
  };

  /* ============================================================
     🚪 Cancel / Clear Buttons
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    window.location.href = "/patientchart-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    patientHidden.value = "";
  });
}
