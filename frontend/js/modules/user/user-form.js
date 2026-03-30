// 📁 user-form.js – MASTER (DEPARTMENT STYLE)
// ============================================================================
// 🔹 Rule-driven validation
// 🔹 Role-aware org/fac handling (like department)
// 🔹 Flat payload (NO assignments)
// 🔹 Clean + predictable behavior
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadRolesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";
import { USER_FORM_RULES } from "./user.form.rules.js";

/* ============================================================
   HELPERS
============================================================ */
const getQueryParam = (k) =>
  new URLSearchParams(window.location.search).get(k);

const normalizeMessage = (r, fb) =>
  r?.message || r?.error || r?.msg || fb;

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

/* ============================================================
   LOAD ORG / FAC / ROLE (DEPARTMENT STYLE)
============================================================ */
async function loadRefs({ preset = null } = {}) {
  const userRole = resolveUserRole();

  const orgSelect = document.getElementById("organization_id");
  const facSelect = document.getElementById("facility_id");
  const roleSelect = document.getElementById("role_id");

  try {
    /* ================= SUPERADMIN ================= */
    if (userRole === "superadmin") {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      orgSelect.closest(".form-group")?.classList.remove("hidden");

      orgSelect.onchange = async () => {
        const orgId = orgSelect.value || null;

        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

        const roles = await loadRolesLite(
          orgId ? { organization_id: orgId } : {}
        );
        setupSelectOptions(roleSelect, roles, "id", "name", "-- Select Role --");
      };

      if (preset?.organization_id) {
        orgSelect.value = preset.organization_id;
        await orgSelect.onchange();
      }
    }

    /* ================= NON-SUPERADMIN ================= */
    else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");

      const roles = await loadRolesLite();
      setupSelectOptions(roleSelect, roles, "id", "name", "-- Select Role --");
    }

    /* ================= APPLY PRESET ================= */
    if (preset) {
      preset.facility_id && (facSelect.value = preset.facility_id);
      preset.role_id && (roleSelect.value = preset.role_id);
    }

  } catch (err) {
    console.error("❌ Failed loading refs:", err);
    showToast("❌ Could not load dropdowns");
  }
}

/* ============================================================
   MAIN SETUP
============================================================ */
export async function setupUserFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const userRole = resolveUserRole();

  const userId =
    sessionStorage.getItem("userEditId") ||
    getQueryParam("id");

  const isEdit = !!userId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  titleEl.textContent = isEdit ? "Edit User" : "Add User";
  submitBtn.innerHTML = isEdit
    ? `<i class="ri-save-3-line me-1"></i> Update User`
    : `<i class="ri-add-line me-1"></i> Add User`;

  await loadRefs();

  /* ================= PREFILL ================= */
  if (isEdit) {
    try {
      let entry = null;

      const cached = sessionStorage.getItem("userEditPayload");
      if (cached) entry = JSON.parse(cached);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/users/${userId}`);
        const json = await res.json();
        entry = json?.data;
      }

      document.getElementById("username").value = entry.username || "";
      document.getElementById("email").value = entry.email || "";
      document.getElementById("first_name").value = entry.first_name || "";
      document.getElementById("last_name").value = entry.last_name || "";

      entry.status &&
        document.getElementById(`status_${entry.status}`)?.click();

      await loadRefs({
        preset: {
          organization_id: entry.organization_id,
          facility_id: entry.facilities?.[0]?.id,
          role_id: entry.roles?.[0]?.id,
        },
      });

    } catch {
      showToast("❌ Failed to load user");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🚀 SUBMIT (DEPARTMENT STYLE)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();

    clearFormErrors(form);

    const errors = [];

    for (const rule of USER_FORM_RULES) {
      if (typeof rule.when === "function" && !rule.when()) continue;

      const el =
        document.getElementById(rule.id) ||
        form.querySelector(`[name="${rule.id}"]`);

      if (!el || !el.value || el.value.toString().trim() === "") {
        errors.push({ field: rule.id, message: rule.message });
      }
    }

    if (errors.length) {
      applyServerErrors(form, errors);
      showToast("❌ Please fix the highlighted fields");
      return;
    }

    /* ================= BUILD PAYLOAD ================= */
    const payload = {
      username: document.getElementById("username").value.trim(),
      email: document.getElementById("email").value.trim(),
      first_name: document.getElementById("first_name").value.trim(),
      last_name: document.getElementById("last_name").value.trim(),
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",

      role_id: document.getElementById("role_id")?.value,
    };

    // ✅ conditional fields ONLY
    const orgId = normalizeUUID(document.getElementById("organization_id")?.value);
    const facId = normalizeUUID(document.getElementById("facility_id")?.value);

    if (userRole === "superadmin" && orgId) {
      payload.organization_id = orgId;
    }

    if (facId) {
      payload.facility_id = facId;
    }
    const password = document.getElementById("password")?.value.trim();
    if (password) payload.password = password;

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

      const json = await res.json();
      if (!res.ok)
        throw new Error(normalizeMessage(json, "❌ Save failed"));

      showToast(isEdit ? "✅ User updated" : "✅ User created");

      sessionStorage.clear();
      window.location.href = "/users-list.html";

    } catch (err) {
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

const cancelBtn = document.getElementById("cancelBtn");

if (cancelBtn) {
  cancelBtn.onclick = () => {
    sessionStorage.clear();
    window.location.href = "/users-list.html";
  };
}

const clearBtn = document.getElementById("clearBtn");

if (clearBtn) {
  clearBtn.onclick = (e) => {
    e.preventDefault();
    sessionStorage.clear();
    form.reset();
  };
}
}