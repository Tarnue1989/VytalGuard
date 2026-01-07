// 📁 master-item-category-form.js – Secure & Role-Aware Category Form (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-form.js / vital-form.js
// 🔹 Same enterprise submission flow, permission logic, and UI behavior
// 🔹 100% ID preservation (safe for linked HTML + modules)
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
} from "../../utils/data-loaders.js";

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
function normalizeUUID(val) {
  return val && val.trim() !== "" ? val : null;
}

/* ============================================================
   🚀 Setup Master Item Category Form
============================================================ */
export async function setupMasterItemCategoryFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("masterItemCategoryEditId");
  const queryId = getQueryParam("id");
  const categoryId = sessionId || queryId;
  const isEdit = !!categoryId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Master Item Category");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Category`);
    } else {
      titleEl && (titleEl.textContent = "Add Master Item Category");
      submitBtn &&
        (submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Category`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🌐 DOM References
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const nameInput = document.getElementById("name");
  const codeInput = document.getElementById("code");
  const descInput = document.getElementById("description");

  /* ============================================================
     🧠 Auto-generate Code when Category Name is typed
  ============================================================ */
  nameInput?.addEventListener("input", () => {
    const raw = nameInput.value.trim();
    if (!raw) {
      codeInput.value = "";
      return;
    }

    // Convert to uppercase & safe format
    const base = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/_+$/, "");

    // Add short unique suffix
    const suffix = Date.now().toString().slice(-4);
    codeInput.value = `${base}_${suffix}`;
  });

  /* ============================================================
     🧭 Prefill Dropdowns (Org/Facility)
  ============================================================ */
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
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
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     ✏️ Prefill if Editing
  ============================================================ */
  if (isEdit && categoryId) {
    try {
      showLoading();
      const res = await authFetch(`/api/master-item-categories/${categoryId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok) throw new Error(normalizeMessage(result, "Failed to load category"));
      const entry = result?.data;
      if (!entry) return;

      // 🔁 Populate fields
      nameInput.value = entry.name || "";
      codeInput.value = entry.code || "";
      descInput.value = entry.description || "";

      orgSelect.value = entry.organization_id || "";
      facSelect.value = entry.facility_id || "";

      // 🟣 Status radios
      if (entry.status) {
        const radio = document.getElementById(`status_${entry.status.toLowerCase()}`);
        if (radio) radio.checked = true;
      }
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load category");
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      name: (nameInput?.value || "").trim(),
      code: (codeInput?.value || "").trim(),
      description: (descInput?.value || "").trim(),
      organization_id: normalizeUUID(orgSelect?.value),
      facility_id: normalizeUUID(facSelect?.value),
      status:
        document.querySelector("input[name='status']:checked")?.value || "active",
    };

    // ✅ Hard-required fields
    if (!payload.name) return showToast("❌ Category Name is required");
    if (!payload.code) return showToast("❌ Category Code is required");

    try {
      showLoading();
      const url = isEdit
        ? `/api/master-item-categories/${categoryId}`
        : `/api/master-item-categories`;
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
          ? "✅ Category updated successfully"
          : "✅ Category created successfully"
      );

      sessionStorage.removeItem("masterItemCategoryEditId");
      sessionStorage.removeItem("masterItemCategoryEditPayload");

      if (isEdit) window.location.href = "/master-item-categories-list.html";
      else {
        form.reset();
        setUI("add");
        document.getElementById("status_active")?.setAttribute("checked", true);
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemCategoryEditId");
    sessionStorage.removeItem("masterItemCategoryEditPayload");
    window.location.href = "/master-item-categories-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemCategoryEditId");
    sessionStorage.removeItem("masterItemCategoryEditPayload");
    form.reset();
    setUI("add");
    document.getElementById("status_active")?.setAttribute("checked", true);
  });
}
