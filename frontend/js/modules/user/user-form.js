// 📁 user-form.js – Secure & Role-Aware User Form (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-form.js / vital-form.js
// 🔹 Backend is authority; frontend enforces UX only
// 🔹 Clean Add/Edit lifecycle with disciplined payload
// 🔹 Assignment scoping mirrors backend enforcement
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
  loadRolesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";

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
   🧹 Reset Form Helper (Add Mode)
============================================================ */
function resetForm() {
  const form = document.getElementById("userForm");
  if (!form) return;

  form.reset();

  ["username", "email", "first_name", "last_name", "password"].forEach((id) => {
    document.getElementById(id) && (document.getElementById(id).value = "");
  });

  document.getElementById("status_active")?.setAttribute("checked", true);

  document.getElementById("organization_id") &&
    (document.getElementById("organization_id").value = "");

  document.getElementById("facility_id") &&
    (document.getElementById("facility_id").innerHTML =
      `<option value="">-- Select Facility --</option>`);

  document.getElementById("role_id") &&
    (document.getElementById("role_id").innerHTML =
      `<option value="">-- Select Role --</option>`);

  sessionStorage.removeItem("userEditId");
  sessionStorage.removeItem("userEditPayload");

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add User";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add User`;
  }
}

/* ============================================================
   📦 Load Assignment Options (ORG / FAC / ROLE)
============================================================ */
async function loadAssignments({ preset = null } = {}) {
  try {
    const userRole = resolveUserRole();

    const orgSelect = document.getElementById("organization_id");
    const facSelect = document.getElementById("facility_id");
    const roleSelect = document.getElementById("role_id");

    facSelect && (facSelect.innerHTML = `<option value="">-- Select Facility --</option>`);
    roleSelect && (roleSelect.innerHTML = `<option value="">-- Select Role --</option>`);

    /* ---------------- SUPERADMIN ---------------- */
    if (userRole === "superadmin") {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );
      orgSelect.closest(".form-group")?.classList.remove("hidden");

      if (preset?.organization_id) {
        orgSelect.value = preset.organization_id;
      }

      orgSelect.onchange = async () => {
        const orgId = orgSelect.value || null;

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

        const roles = await loadRolesLite(
          orgId ? { organization_id: orgId } : {}
        );
        setupSelectOptions(
          roleSelect,
          roles,
          "id",
          "name",
          "-- Select Role --"
        );
      };

      if (preset?.organization_id) {
        await orgSelect.onchange();
        preset.facility_id && (facSelect.value = preset.facility_id);
        preset.role_id && (roleSelect.value = preset.role_id);
      }
    }

    /* ---------------- NON-SUPERADMIN ---------------- */
    else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(
        facSelect,
        facs,
        "id",
        "name",
        "-- Select Facility --"
      );

      const roles = await loadRolesLite();
      setupSelectOptions(
        roleSelect,
        roles,
        "id",
        "name",
        "-- Select Role --"
      );

      preset?.facility_id && (facSelect.value = preset.facility_id);
      preset?.role_id && (roleSelect.value = preset.role_id);
    }
  } catch (err) {
    console.error("❌ Failed to load assignments:", err);
    showToast("❌ Could not load assignments");
  }
}

/* ============================================================
   🚀 Setup User Form
============================================================ */
export async function setupUserFormSubmission({ form }) {
  /* ---------------- Auth ---------------- */
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const userRole = resolveUserRole();

  /* ---------------- Edit Detection ---------------- */
  const sessionId = sessionStorage.getItem("userEditId");
  const queryId = getQueryParam("id");
  const userId = sessionId || queryId;
  const isEdit = !!userId;

  isEdit ? null : resetForm();

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  titleEl.textContent = isEdit ? "Edit User" : "Add User";
  submitBtn.innerHTML = isEdit
    ? `<i class="ri-save-3-line me-1"></i> Update User`
    : `<i class="ri-add-line me-1"></i> Add User`;

  await loadAssignments();

  /* ---------------- PREFILL (EDIT MODE) ---------------- */
  if (isEdit) {
    try {
      let entry = null;
      const cached = sessionStorage.getItem("userEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/users/${userId}`);
        const result = await res.json();
        entry = result?.data;
      }

      document.getElementById("username").value = entry.username || "";
      document.getElementById("email").value = entry.email || "";
      document.getElementById("first_name").value = entry.first_name || "";
      document.getElementById("last_name").value = entry.last_name || "";

      entry.status &&
        document
          .getElementById(`status_${entry.status.toLowerCase()}`)
          ?.click();

      await loadAssignments({
        preset: {
          organization_id: entry.organization_id,
          facility_id: entry.facilities?.[0]?.id,
          role_id: entry.roles?.[0]?.id,
        },
      });
    } catch (err) {
      showToast("❌ Could not load user");
    } finally {
      hideLoading();
    }
  }

  /* ---------------- SUBMIT ---------------- */
  form.onsubmit = async (e) => {
    e.preventDefault();

    const payload = {
      username: document.getElementById("username").value.trim(),
      email: document.getElementById("email").value.trim(),
      first_name: document.getElementById("first_name").value.trim(),
      last_name: document.getElementById("last_name").value.trim(),
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
      assignments: [],
    };

    /* -------- Password -------- */
    const password = document.getElementById("password")?.value.trim();
    if (!isEdit && !password) {
      return showToast("❌ Password required");
    }
    if (password) {
      payload.password = password;
    }

    /* -------- IDs -------- */
    const orgEl = document.getElementById("organization_id");
    const facEl = document.getElementById("facility_id");
    const roleEl = document.getElementById("role_id");

    const orgId =
      orgEl && !orgEl.closest(".hidden") && orgEl.value &&
      orgEl.value !== "null" &&
      orgEl.value !== "undefined"
        ? orgEl.value
        : null;

    const facId =
      facEl && facEl.value && facEl.value !== "null"
        ? facEl.value
        : null;

    const roleId =
      roleEl && roleEl.value && roleEl.value !== "null"
        ? roleEl.value
        : null;

    if (!roleId) {
      return showToast("❌ Role is required");
    }

    /* -------- ROOT ORGANIZATION (MANDATORY) -------- */
    if (userRole === "superadmin") {
      if (!orgId) {
        console.error("❌ Missing organization_id on submit");
        return showToast("❌ Organization is required");
      }
      payload.organization_id = orgId;
    }

    /* -------- ASSIGNMENTS -------- */
    payload.assignments.push(
      facId
        ? { facility_id: facId, role_id: roleId }
        : { organization_id: orgId, role_id: roleId }
    );

    /* -------- SUBMIT -------- */
    try {
      showLoading();

      const res = await authFetch(
        isEdit ? `/api/users/${userId}` : `/api/users`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        throw new Error(normalizeMessage(result, "❌ Save failed"));
      }

      showToast(isEdit ? "✅ User updated" : "✅ User created");

      sessionStorage.removeItem("userEditId");
      sessionStorage.removeItem("userEditPayload");

      if (isEdit) {
        window.location.href = "/users-list.html";
      } else {
        resetForm();
      }
    } catch (err) {
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ---------------- CANCEL / CLEAR ---------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/users-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    sessionStorage.clear();
    resetForm();
  });
}
