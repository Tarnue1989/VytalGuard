// 📁 supplier-form.js – Enterprise-Aligned Master Pattern (Backend-Safe)
// ============================================================================
// 🔹 Fully aligned with supplierController.js tenant resolution
// 🔹 Backend is the source of truth for organization + status
// 🔹 Preserves all supplier-specific fields and existing HTML IDs
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
   🚀 Setup Supplier Form
============================================================ */
export async function setupSupplierFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("supplierEditId");
  const queryId = getQueryParam("id");
  const supplierId = sessionId || queryId;
  const isEdit = !!supplierId;

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ============================================================
     🎨 UI Setup
  ============================================================ */
  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Supplier");
      submitBtn &&
        (submitBtn.innerHTML =
          `<i class="ri-save-3-line me-1"></i> Update Supplier`);
    } else {
      titleEl && (titleEl.textContent = "Add Supplier");
      submitBtn &&
        (submitBtn.innerHTML =
          `<i class="ri-add-line me-1"></i> Add Supplier`);
    }
  };

  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🌐 DOM References
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const nameInput = document.getElementById("name");
  const contactName = document.getElementById("contact_name");
  const contactEmail = document.getElementById("contact_email");
  const contactPhone = document.getElementById("contact_phone");
  const address = document.getElementById("address");
  const notes = document.getElementById("notes");

  /* ============================================================
     🧭 Prefill Org / Facility (ROLE-AWARE)
  ============================================================ */
  try {
    if (userRole.includes("super")) {
      // 🏢 Superadmin → org + facility
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(
          facSelect,
          facs,
          "id",
          "name",
          "-- Select Facility --"
        );
      }

      await reloadFacilities();

      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (userRole.includes("admin") || userRole.includes("org_owner")) {
      // 🧑‍💼 Admin / Org Owner → facility only
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(
        facSelect,
        facs,
        "id",
        "name",
        "-- Select Facility --"
      );
    } else {
      // 👷 Facility head / staff → implicit tenant
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load organization/facility lists");
  }

  /* ============================================================
     ✏️ Prefill If Editing
  ============================================================ */
  if (isEdit && supplierId) {
    try {
      showLoading();

      const res = await authFetch(`/api/suppliers/${supplierId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, "Failed to load supplier"));

      const entry = result?.data;
      if (!entry) return;

      nameInput.value = entry.name || "";
      contactName.value = entry.contact_name || "";
      contactEmail.value = entry.contact_email || "";
      contactPhone.value = entry.contact_phone || "";
      address.value = entry.address || "";
      notes.value = entry.notes || "";

      if (entry.organization_id && orgSelect)
        orgSelect.value = entry.organization_id;
      if (entry.facility_id && facSelect)
        facSelect.value = entry.facility_id;

      // 🔒 Prevent tenant movement on edit
      orgSelect?.setAttribute("disabled", true);
      facSelect?.setAttribute("disabled", true);

      setUI("edit");
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load supplier");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit Handler (FINAL – BACKEND SAFE)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      name: nameInput.value?.trim(),
      contact_name: contactName.value?.trim() || null,
      contact_email: contactEmail.value?.trim() || null,
      contact_phone: contactPhone.value?.trim() || null,
      address: address.value?.trim() || null,
      notes: notes.value?.trim() || null,
    };

    // 🔑 Tenant fields ONLY when allowed
    if (userRole.includes("super")) {
      payload.organization_id = normalizeUUID(orgSelect?.value);
      payload.facility_id = normalizeUUID(facSelect?.value);
    } else if (userRole.includes("admin") || userRole.includes("org_owner")) {
      payload.facility_id = normalizeUUID(facSelect?.value);
    }

    // 🔍 Validation
    if (!payload.name)
      return showToast("❌ Supplier Name is required");

    if (userRole.includes("super")) {
      if (!payload.organization_id)
        return showToast("❌ Organization is required");
      if (!payload.facility_id)
        return showToast("❌ Facility is required");
    } else if (userRole.includes("admin") || userRole.includes("org_owner")) {
      if (!payload.facility_id)
        return showToast("❌ Facility selection is required");
    }

    try {
      showLoading();

      const url = isEdit
        ? `/api/suppliers/${supplierId}`
        : `/api/suppliers`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(
        isEdit
          ? "✅ Supplier updated successfully"
          : "✅ Supplier created successfully"
      );

      sessionStorage.removeItem("supplierEditId");
      sessionStorage.removeItem("supplierEditPayload");

      if (isEdit) window.location.href = "/suppliers-list.html";
      else {
        form.reset();
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
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("supplierEditId");
    sessionStorage.removeItem("supplierEditPayload");
    window.location.href = "/suppliers-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("supplierEditId");
    sessionStorage.removeItem("supplierEditPayload");
    form.reset();
    setUI("add");
  });
}
