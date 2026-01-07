// ============================================================================
// 🏥 VytalGuard – Secure & Role-Aware Facility Form
// 🔹 Fully aligned with Enterprise Master Pattern (organization-form.js)
// 🔹 Preserves all existing IDs, suggestion input, and submission flow
// 🔹 Adds auth guard, logout watcher, safe prefill, and unified UX behavior
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
import { setupSuggestionInputDynamic } from "../../utils/data-loaders.js";

/* ============================================================
   🔧 Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

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

/* ============================================================
   🚀 Setup Facility Form
============================================================ */
export async function setupFacilityFormSubmission({ form }) {
  // 🔐 Auth Guard & Logout Watcher
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("facilityEditId");
  const queryId = getQueryParam("id");
  const facId = sessionId || queryId;
  const isEdit = !!facId;

  // 🎨 UI Title & Button Mode
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Facility");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Facility`);
    } else {
      titleEl && (titleEl.textContent = "Add Facility");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Facility`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🧩 Organization Suggestion Input (Dynamic Binding)
  ============================================================ */
  const orgInput = document.getElementById("organizationInput");
  const orgSuggestions = document.getElementById("organizationSuggestions");
  const orgHidden = document.getElementById("organization_id");

  if (orgInput && orgSuggestions && orgHidden) {
    setupSuggestionInputDynamic(
      orgInput,
      orgSuggestions,
      "/api/lite/organizations",
      (selected) => {
        orgHidden.value = selected?.id || "";
      },
      "name"
    );
  }

  /* ============================================================
     🧭 Prefill (Edit Mode)
  ============================================================ */
  if (isEdit && facId) {
    try {
      let entry = null;
      const cached = sessionStorage.getItem("facilityEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/facilities/${facId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load facility"));
        entry = result?.data;
      }

      if (!entry) throw new Error("❌ Facility not found");

      // 🏷 Prefill core fields
      ["name", "code", "address", "phone", "email"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = entry[id] || "";
      });

      // 🧩 Prefill organization
      if (entry.organization) {
        orgInput.value = entry.organization.name || "";
        orgHidden.value = entry.organization_id || entry.organization.id;
      } else if (entry.organization_id) {
        orgHidden.value = entry.organization_id;
      }

      // ⚙️ Status radio
      if (entry.status) {
        const radio = document.getElementById(
          `status_${entry.status.toLowerCase()}`
        );
        if (radio) radio.checked = true;
      }
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load facility");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const orgVal = orgHidden?.value?.trim();
    if (!orgVal) {
      showToast("❌ Organization is required");
      orgInput?.focus();
      return;
    }

    const payload = {
      organization_id: orgVal,
      name: (document.getElementById("name")?.value || "").trim(),
      code: (document.getElementById("code")?.value || "").trim(),
      address: (document.getElementById("address")?.value || "").trim() || null,
      phone: (document.getElementById("phone")?.value || "").trim() || null,
      email: (document.getElementById("email")?.value || "").trim() || null,
      status:
        document.querySelector("input[name='status']:checked")?.value || "active",
    };

    // 🔎 Validation
    if (!payload.name) return showToast("❌ Facility Name is required");
    if (payload.name.length < 3)
      return showToast("❌ Facility Name must be at least 3 characters");
    if (!payload.code) return showToast("❌ Facility Code is required");
    if (!/^[A-Z0-9_-]+$/i.test(payload.code))
      return showToast("❌ Code may only contain letters, numbers, underscores, or dashes");
    if (payload.code.length > 50)
      return showToast("❌ Code must be ≤ 50 characters");

    try {
      showLoading();
      const url = isEdit ? `/api/facilities/${facId}` : `/api/facilities`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(
        isEdit
          ? `✅ Facility "${payload.name}" updated successfully`
          : `✅ Facility "${payload.name}" added successfully`
      );

      sessionStorage.removeItem("facilityEditId");
      sessionStorage.removeItem("facilityEditPayload");

      if (isEdit) {
        window.location.href = "/facilities-list.html";
      } else {
        form.reset();
        orgInput.value = "";
        orgHidden.value = "";
        document.getElementById("status_active")?.setAttribute("checked", true);
        setUI("add");
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel & Reset
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("facilityEditId");
    sessionStorage.removeItem("facilityEditPayload");
    form.reset();
    orgInput.value = "";
    orgHidden.value = "";
    document.getElementById("status_active")?.setAttribute("checked", true);
    window.location.href = "/facilities-list.html";
  });
}

// ============================================================================
// ✅ Enterprise Master Pattern Summary:
//    • Auth guard + logout watcher
//    • Safe prefill via sessionStorage + fallback fetch
//    • Unified validation & UX messages
//    • Dynamic organization suggestion input
//    • Cancel/reset + safe redirect
// ============================================================================
