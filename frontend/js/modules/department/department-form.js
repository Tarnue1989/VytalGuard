// 📁 department-form.js – Secure & Role-Aware Department Form (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-form.js / vital-form.js
// 🔹 Uses shared roleResolver util (SINGLE SOURCE OF TRUTH)
// 🔹 Supports ORG-WIDE + FACILITY-SCOPED departments
// 🔹 Facility optional for org admins
// 🔹 Clean payload normalization (UUID | null)
// 🔹 Preserves ALL existing IDs & behavior
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

import {
  resolveUserRole,
  getOrganizationId,
} from "../../utils/roleResolver.js";

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
  return typeof val === "string" && val.trim() !== "" ? val : null;
}

/* ============================================================
   🚀 Setup Department Form
============================================================ */
export async function setupDepartmentFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const sessionId = sessionStorage.getItem("departmentEditId");
  const queryId = getQueryParam("id");
  const depId = sessionId || queryId;
  const isEdit = !!depId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl && (titleEl.textContent = "Edit Department");
      submitBtn &&
        (submitBtn.innerHTML =
          `<i class="ri-save-3-line me-1"></i> Update Department`);
    } else {
      titleEl && (titleEl.textContent = "Add Department");
      submitBtn &&
        (submitBtn.innerHTML =
          `<i class="ri-add-line me-1"></i> Add Department`);
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🌐 DOM References
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const headInput = document.getElementById("headInput");
  const headHidden = document.getElementById("headId");
  const headSuggestions = document.getElementById("headSuggestions");

  /* ============================================================
     🧭 Role Resolution (SHARED UTIL)
  ============================================================ */
  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  /* ============================================================
     🧭 Prefill Dropdowns & Suggestions
  ============================================================ */
  try {
    if (isSuper) {
      // 🔹 Superadmin → org + facility selectable
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
        { organization_id: orgId ?? getOrganizationId() },
        true
      );


        setupSelectOptions(
          facSelect,
          facs,
          "id",
          "name",
          "-- Select Facility (optional) --"
        );
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });

    } else if (isOrgAdmin) {
      // 🔹 Org admin → facilities scoped to org (optional)
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      const facs = await loadFacilitiesLite(
        { organization_id: getOrganizationId() },
        true
      );


      setupSelectOptions(
        facSelect,
        facs,
        "id",
        "name",
        "-- Select Facility (optional) --"
      );

    } else {
      // 🔹 Facility-scoped / staff
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    // ✅ Head of Department (Employee suggestion)
    setupSuggestionInputDynamic(
      headInput,
      headSuggestions,
      "/api/lite/employees",
      (selected) => {
        headHidden.value = selected?.id || "";
        headInput.value =
          selected?.label ||
          (selected?.employee_no && selected?.full_name
            ? `${selected.full_name} (${selected.employee_no})`
            : selected?.full_name || "");
      },
      "label"
    );
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
    ✏️ Prefill if Editing
  ============================================================ */
  if (isEdit && depId) {
    try {
      showLoading();

      const res = await authFetch(`/api/departments/${depId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok) {
        throw new Error(
          normalizeMessage(result, "Failed to load department")
        );
      }

      const entry = result?.data;
      if (!entry) return;

      /* ============================
        📝 Basic fields
      ============================ */
      document.getElementById("name").value = entry.name || "";
      document.getElementById("code").value = entry.code || "";
      document.getElementById("description").value =
        entry.description || "";

      /* ========================================================
        🏢 SUPERADMIN — preload + set organization
      ======================================================== */
      if (isSuper && entry.organization_id) {
        // Ensure org selector is visible
        orgSelect.closest(".form-group")?.classList.remove("hidden");

        const orgs = await loadOrganizationsLite();
        setupSelectOptions(
          orgSelect,
          orgs,
          "id",
          "name",
          "-- Select Organization --"
        );

        orgSelect.value = entry.organization_id;

        // Load facilities for this org
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization_id },
          true
        );
        setupSelectOptions(
          facSelect,
          facs,
          "id",
          "name",
          "-- Select Facility (optional) --"
        );
      }
      /* ========================================================
        🏥 ORG ADMIN — reload facilities for edit
        (THIS IS THE MISSING PIECE)
      ======================================================== */
      if (isOrgAdmin && entry.organization_id) {
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization_id },
          true
        );

        setupSelectOptions(
          facSelect,
          facs,
          "id",
          "name",
          "-- Select Facility (optional) --"
        );
      }

      /* ========================================================
        🏥 FACILITY — FIX (ORG ADMIN + SUPERADMIN)
        IMPORTANT: must UNHIDE before setting value
      ======================================================== */
      if (isOrgAdmin || isSuper) {
        facSelect.closest(".form-group")?.classList.remove("hidden");
      }

      if (entry.facility_id) {
        facSelect.value = entry.facility_id;
      }

      /* ========================================================
        👤 Head of Department
      ======================================================== */
      if (entry.head_of_department) {
        const h = entry.head_of_department;
        headInput.value = [h.first_name, h.middle_name, h.last_name]
          .filter(Boolean)
          .join(" ");
        headHidden.value = h.id;
      }

      /* ========================================================
        🔘 Status
      ======================================================== */
      if (entry.status) {
        const radio = document.getElementById(
          `status_${entry.status.toLowerCase()}`
        );
        if (radio) radio.checked = true;
      }

    } catch (err) {
      hideLoading();
      showToast(err.message || "❌ Could not load department");
    }
  }


  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

const payload = {
  name: document.getElementById("name")?.value.trim(),
  code: document.getElementById("code")?.value.trim(),
  description:
    document.getElementById("description")?.value.trim() || "",
  status:
    document.querySelector("input[name='status']:checked")?.value ||
    "active",

  // Superadmin may send org, others rely on backend
  organization_id: isSuper
    ? normalizeUUID(orgSelect?.value)
    : null,

  // 🔥 ALWAYS send facility_id (UUID or null)
  facility_id: normalizeUUID(facSelect?.value),

  head_of_department_id: normalizeUUID(headHidden?.value),
};

    if (!payload.name)
      return showToast("❌ Department Name is required");
    if (!payload.code)
      return showToast("❌ Department Code is required");

    try {
      showLoading();
      const url = isEdit
        ? `/api/departments/${depId}`
        : `/api/departments`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          normalizeMessage(result, `❌ Server error (${res.status})`)
        );

      showToast(
        isEdit ? "✅ Department updated" : "✅ Department created"
      );

      sessionStorage.removeItem("departmentEditId");
      sessionStorage.removeItem("departmentEditPayload");

      if (isEdit) {
        window.location.href = "/departments-list.html";
      } else {
        form.reset();
        setUI("add");
        document
          .getElementById("status_active")
          ?.setAttribute("checked", true);
      }
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/departments-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    form.reset();
    setUI("add");
    document
      .getElementById("status_active")
      ?.setAttribute("checked", true);
  });
}
