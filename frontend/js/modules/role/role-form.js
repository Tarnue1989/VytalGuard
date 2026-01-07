// 📁 role-form.js – Secure & Role-Aware Role Form (Department-Aligned)
// ============================================================================
// 🧭 Master Pattern: vital-form.js / department-form.js
// 🔹 Backend is authority; frontend enforces correct UX
// 🔹 Roles can be ORG-WIDE or FACILITY-SCOPED (same as departments)
// 🔹 Facility optional for superadmin & org admin
// 🔹 All original HTML IDs preserved exactly
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
   🚀 Setup Role Form
============================================================ */
export async function setupRoleFormSubmission({ form }) {
  // 🔐 Auth Guard
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  const sessionId = sessionStorage.getItem("roleEditId");
  const queryId = getQueryParam("id");
  const roleId = sessionId || queryId;
  const isEdit = !!roleId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = document.getElementById("cancelBtn");
  const clearBtn = document.getElementById("clearBtn");

  const setUI = (mode = "add") => {
    if (mode === "edit") {
      titleEl.textContent = "Edit Role";
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update Role`;
    } else {
      titleEl.textContent = "Add Role";
      submitBtn.innerHTML =
        `<i class="ri-add-line me-1"></i> Add Role`;
    }
  };
  setUI(isEdit ? "edit" : "add");

  /* ============================================================
     🌐 DOM References
  ============================================================ */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const systemRadio = document.getElementById("is_system_true");
  const customRadio = document.getElementById("is_system_false");

  /* ============================================================
     🔒 Role-Type UI Enforcement
  ============================================================ */
  if (!isSuper) {
    systemRadio?.closest(".form-check")?.classList.add("hidden");
    customRadio.checked = true;
  }

  systemRadio?.addEventListener("change", () => {
    orgSelect.value = "";
    orgSelect.closest(".form-group")?.classList.add("hidden");
    facSelect.closest(".form-group")?.classList.add("hidden");
  });

  customRadio?.addEventListener("change", () => {
    // Superadmin: org + facility selectable
    if (isSuper) {
      orgSelect.closest(".form-group")?.classList.remove("hidden");
      facSelect.closest(".form-group")?.classList.remove("hidden");
    }

    // Org admin: facility selectable (ORG implicit)
    if (isOrgAdmin) {
      facSelect.closest(".form-group")?.classList.remove("hidden");
    }
  });


  /* ============================================================
     🧭 Load Organization / Facility (SAME AS DEPARTMENT)
  ============================================================ */
  try {
    if (isSuper) {
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
          "-- Select Facility (optional) --"
        );
      }

      await reloadFacilities();
      orgSelect.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );

    } else if (isOrgAdmin) {
      // Org is implicit
      orgSelect.closest(".form-group")?.classList.add("hidden");

      // ✅ Facility MUST be visible on load
      facSelect.closest(".form-group")?.classList.remove("hidden");

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
      orgSelect.closest(".form-group")?.classList.add("hidden");
      facSelect.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load organization/facility lists");
  }

  /* ============================================================
     ✏️ Prefill (Edit Mode)
  ============================================================ */
  if (isEdit && roleId) {
    try {
      showLoading();
      const res = await authFetch(`/api/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      if (!res.ok)
        throw new Error(normalizeMessage(result, "Failed to load role"));

      const entry = result?.data;
      if (!entry) return;

      document.getElementById("name").value = entry.name || "";
      document.getElementById("code").value = entry.code || "";
      document.getElementById("description").value =
        entry.description || "";

      entry.role_type === "system"
        ? (systemRadio.checked = true)
        : (customRadio.checked = true);

      if (entry.organization_id) orgSelect.value = entry.organization_id;
      if (entry.facility_id) facSelect.value = entry.facility_id;

      if (entry.status) {
        const radio = document.getElementById(
          `status_${entry.status}`
        );
        if (radio) radio.checked = true;
      }
    } catch (err) {
      hideLoading();
      showToast(err.message || "❌ Could not load role");
    }
  }

  /* ============================================================
    💾 Submit (PAYLOAD BUILDER) — FINAL & CORRECT
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      name: document.getElementById("name")?.value.trim(),
      code: document.getElementById("code")?.value.trim(),
      description:
        document.getElementById("description")?.value.trim() || "",
      is_system: systemRadio.checked,
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
    };

    // 🔒 Validation
    if (!payload.name) return showToast("❌ Role Name is required");
    if (!payload.code) return showToast("❌ Role Code is required");

    /* ============================================================
      🔑 SCOPING (FRONTEND RULES ONLY)
      - Forms express intent
      - authFetch + requestScope enforce scope
    ============================================================ */
    if (!payload.is_system) {
      // Only include fields the user explicitly interacted with

      if (isSuper) {
        payload.organization_id = normalizeUUID(orgSelect?.value);
      }

      if (!payload.is_system) {
        // ORG
        if (isSuper) {
          payload.organization_id = normalizeUUID(orgSelect?.value);
        }

        // 🔥 ALWAYS SEND facility_id KEY
        payload.facility_id = facSelect
          ? normalizeUUID(facSelect.value)
          : null;

        // UX validation
        if (isSuper && !payload.organization_id) {
          return showToast("❌ Organization is required");
        }
      }


      // UX validation only
      if (isSuper && !payload.organization_id) {
        return showToast("❌ Organization is required");
      }
    }


    try {
      showLoading();

      const url = isEdit
        ? `/api/roles/${roleId}`
        : `/api/roles`;

      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          normalizeMessage(result, "❌ Submission failed")
        );
      }

      showToast(isEdit ? "✅ Role updated" : "✅ Role created");

      // 🧹 Clear edit state
      sessionStorage.removeItem("roleEditId");
      sessionStorage.removeItem("roleEditPayload");

      /* ============================================================
        🚦 POST-SUBMIT BEHAVIOR
        - Edit → redirect
        - Add  → stay & reset (same as department)
      ============================================================ */
      if (isEdit) {
        window.location.href = "/roles-list.html";
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
    window.location.href = "/roles-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    form.reset();
    customRadio.checked = true;
    setUI("add");
  });
}
