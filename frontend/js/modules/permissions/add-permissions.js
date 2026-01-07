// 📁 add-permission.js – Init Add/Edit form for Permission

import { setupPermissionFormSubmission } from "./permissions-form.js";
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";

// 🔐 Auth Guard – requires create/edit permission
const token = initPageGuard(["permissions:create", "permissions:edit"]);
initLogoutWatcher();

// Shared ref for edit tracking
const sharedState = {
  currentEditIdRef: { value: null },
};

// 🧹 Reset Form Helper
function resetForm() {
  const form = document.getElementById("permissionForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  ["organizationSelect", "facilitySelect", "category", "module"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const title = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  if (title) title.textContent = "Add Permission";
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create Permission`;
}

/* ============================================================
   🚀 Initialize Page
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("permissionForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const moduleSelect = document.getElementById("module");
  const categoryField = document.getElementById("category");
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🔹 Organization + Facility Dropdowns
     ============================================================ */
  async function reloadFacilities(orgId = null) {
    try {
      const res = await authFetch(`/api/lite/facilities?organization_id=${orgId || ""}`);
      const result = await res.json();
      const facs = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result?.data?.records)
        ? result.data.records
        : [];

      facSelect.innerHTML = `<option value="">-- Select Facility --</option>`;
      facs.forEach((f) => {
        facSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${f.id}">${f.name}</option>`
        );
      });
    } catch (err) {
      console.error("❌ Facilities load failed:", err);
      showToast("❌ Could not load facilities");
    }
  }

  try {
    if (userRole.includes("super")) {
      // 🔒 Superadmin: show both org + facility
      const res = await authFetch("/api/lite/organizations");
      const result = await res.json();

      const orgs = Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result?.data?.records)
        ? result.data.records
        : [];

      orgSelect.innerHTML = `<option value="">-- Select Organization --</option>`;
      orgs.forEach((o) => {
        orgSelect.insertAdjacentHTML(
          "beforeend",
          `<option value="${o.id}">${o.name}</option>`
        );
      });

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      await reloadFacilities();
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Failed to load org/facility lists:", err);
    showToast("❌ Failed to load dropdowns");
  }

  /* ============================================================
     🔹 Load Feature Modules Dropdown
     ============================================================ */
  try {
    const res = await authFetch("/api/lite/feature-modules");
    const result = await res.json();

    const modules = Array.isArray(result?.data)
      ? result.data
      : Array.isArray(result?.data?.records)
      ? result.data.records
      : [];

    moduleSelect.innerHTML = `<option value="">-- Select Module --</option>`;
    modules.forEach((m) => {
      moduleSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${m.key}" data-category="${m.category || ""}">${m.name}</option>`
      );
    });

    // ✅ Auto-fill category when module changes
    moduleSelect.addEventListener("change", () => {
      const selectedOption = moduleSelect.options[moduleSelect.selectedIndex];
      const cat = selectedOption?.dataset?.category || "";
      categoryField.value = cat;
    });
  } catch (err) {
    console.error("❌ Failed to load feature modules:", err);
    showToast("❌ Could not load feature modules");
  }

  /* ============================================================
     💾 Hook Form Submission
     ============================================================ */
  setupPermissionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ============================================================
     ✏️ Handle Edit Mode
     ============================================================ */
  const editId = sessionStorage.getItem("permissionEditId");
  const rawPayload = sessionStorage.getItem("permissionEditPayload");

  async function prefillForm(entry) {
    document.getElementById("key").value = entry.key || "";
    document.getElementById("name").value = entry.name || "";
    document.getElementById("description").value = entry.description || "";
    moduleSelect.value = entry.module || "";
    categoryField.value = entry.category || "";
    document.getElementById("isGlobal").checked = !!entry.is_global;

    if (entry.organization_id && orgSelect) {
      orgSelect.value = entry.organization_id;
      await reloadFacilities(entry.organization_id);
    }
    if (entry.facility_id && facSelect) facSelect.value = entry.facility_id;

    const title = document.querySelector(".card-title");
    const submitBtn = form.querySelector("button[type=submit]");
    if (title) title.textContent = "Edit Permission";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Permission`;
  }

  if (editId && rawPayload) {
    try {
      const entry = JSON.parse(rawPayload);
      sharedState.currentEditIdRef.value = editId;
      await prefillForm(entry);
    } catch (err) {
      console.error("❌ Failed to parse cached payload:", err);
      showToast("❌ Could not load cached permission for editing");
    }
  } else {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/permissions/${id}`);
        const result = await res.json();
        const entry = result?.data?.record || result?.data;
        if (!res.ok || !entry)
          throw new Error(result.message || "❌ Failed to fetch permission");
        await prefillForm(entry);
      } catch (err) {
        console.error("❌ Failed to load permission:", err);
        showToast(err.message || "❌ Failed to load permission for editing");
      } finally {
        hideLoading();
      }
    }
  }

  /* ============================================================
     🧹 Cancel / Clear Buttons
     ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("permissionEditId");
    sessionStorage.removeItem("permissionEditPayload");
    window.location.href = "/permissions-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("permissionEditId");
    sessionStorage.removeItem("permissionEditPayload");
    resetForm();
  });
});
