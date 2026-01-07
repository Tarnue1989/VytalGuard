// 📁 permissions-form.js – Handles Add/Edit form for Permission

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadFeatureModulesLite, // ✅ NEW
  setupSelectOptions,
} from "../../utils/data-loaders.js";

// 🔍 Extract query param
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// 🧭 Normalize messages from API
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
   🚀 Initialize Permission Form
   ============================================================ */
export async function setupPermissionFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("permissionEditId");
  const queryId = getQueryParam("id");
  const permissionId = sessionId || queryId;
  const isEdit = !!permissionId;

  // 🔐 Auth guard
  const token = initPageGuard(["permissions:create", "permissions:edit"]);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  const setAddModeUI = () => {
    if (titleEl) titleEl.textContent = "Add Permission";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Permission`;
  };

  const setEditModeUI = () => {
    if (titleEl) titleEl.textContent = "Edit Permission";
    if (submitBtn)
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Permission`;
  };

  isEdit ? setEditModeUI() : setAddModeUI();

  // 🧩 Field Refs
  const keyInput = document.getElementById("key");
  const nameInput = document.getElementById("name");
  const descriptionInput = document.getElementById("description");
  const moduleSelect = document.getElementById("module");
  const categoryInput = document.getElementById("category");
  const globalCheckbox = document.getElementById("isGlobal");

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  /* ============================================================
     🔽 Load Organization + Facility Dropdowns
     ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

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
  } catch (err) {
    console.error("❌ Failed to load org/facility lists:", err);
    showToast("❌ Failed to load organization/facility lists");
  }

  /* ============================================================
     🔹 Load Modules Dropdown + Auto-Fill Category
     ============================================================ */
  try {
    const modules = await loadFeatureModulesLite(); // GET /api/lite/feature-modules
    setupSelectOptions(moduleSelect, modules, "key", "name", "-- Select Module --");

    moduleSelect?.addEventListener("change", () => {
      const selectedKey = moduleSelect.value;
      const selectedModule = modules.find((m) => m.key === selectedKey);
      if (selectedModule && categoryInput) {
        categoryInput.value = selectedModule.category || "";
      } else {
        categoryInput.value = "";
      }
    });
  } catch (err) {
    console.error("❌ Failed to load feature modules:", err);
    showToast("❌ Could not load feature modules");
  }

  // Make category readonly since it auto-fills
  if (categoryInput) categoryInput.readOnly = true;

  /* ============================================================
     🔄 Prefill when Editing
     ============================================================ */
  if (isEdit) {
    let entry = null;
    try {
      const cached = sessionStorage.getItem("permissionEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/permissions/${permissionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let result = {};
        try {
          result = await res.json();
        } catch {}
        entry = result?.data?.record || result?.data;
        if (!res.ok || !entry)
          throw new Error(
            normalizeMessage(result, `❌ Failed to load permission (${res.status})`)
          );
      }

      keyInput.value = entry.key || "";
      nameInput.value = entry.name || "";
      descriptionInput.value = entry.description || "";
      moduleSelect.value = entry.module || "";
      categoryInput.value = entry.category || "";
      globalCheckbox.checked = !!entry.is_global;

      if (entry.organization_id && orgSelect) {
        orgSelect.value = entry.organization_id;
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization_id },
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      if (entry.facility_id && facSelect) facSelect.value = entry.facility_id;
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load permission");
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

    const payload = {
      key: keyInput.value.trim(),
      name: nameInput.value.trim() || null,
      description: descriptionInput.value.trim() || null,
      module: moduleSelect.value || null,
      category: categoryInput.value || null,
      is_global: !!globalCheckbox.checked,
      organization_id: orgSelect?.value || null,
      facility_id: facSelect?.value || null,
    };

    if (!payload.key) {
      showToast("❌ Permission key is required");
      keyInput?.focus();
      return;
    }

    const url = isEdit ? `/api/permissions/${permissionId}` : `/api/permissions`;
    const method = isEdit ? "PUT" : "POST";

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      let result = {};
      try {
        result = await res.json();
      } catch {}

      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Permission updated successfully");
        sessionStorage.removeItem("permissionEditId");
        sessionStorage.removeItem("permissionEditPayload");
        window.location.href = "/permissions-list.html";
      } else {
        showToast("✅ Permission created successfully");
        form.reset();
        setAddModeUI();
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🧹 Clear / Cancel Handlers
     ============================================================ */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("permissionEditId");
    sessionStorage.removeItem("permissionEditPayload");
    form.reset();
    setAddModeUI();
  });

  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("permissionEditId");
    sessionStorage.removeItem("permissionEditPayload");
    window.location.href = "/permissions-list.html";
  });
}
