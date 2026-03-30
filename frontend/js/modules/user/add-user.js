// 📦 add-user.js – FINAL MASTER (CLEAN + STABLE)
// ============================================================================
// 🔹 ROLE parity (exact pattern)
// 🔹 No optional chaining in unsafe places
// 🔹 Fixed selector (.mb-3)
// 🔹 Stable dropdown loading + cascade
// 🔹 Edit mode fully aligned
// ============================================================================

import { setupUserFormSubmission } from "./user-form.js";

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadRolesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { authFetch } from "../../authSession.js";

/* ============================================================
   🔐 AUTH GUARD
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧠 SHARED STATE
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧩 ROLE NORMALIZATION
============================================================ */
function resolveUserRole() {
  const raw = (localStorage.getItem("userRole") || "").toLowerCase();

  if (raw.includes("superadmin")) return "superadmin";
  if (raw.includes("organization_admin")) return "organization_admin";
  if (raw.includes("facility_admin")) return "facility_admin";

  return "staff";
}

const userRole = resolveUserRole();

/* ============================================================
   🧹 RESET FORM
============================================================ */
function resetForm() {
  const form = document.getElementById("userForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  sessionStorage.removeItem("userEditId");
  sessionStorage.removeItem("userEditPayload");

  ["username", "email", "first_name", "last_name", "password"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("status_active")?.setAttribute("checked", true);

  const org = document.getElementById("organization_id");
  if (org) org.value = "";

  const fac = document.getElementById("facility_id");
  if (fac) {
    fac.innerHTML = `<option value="">-- Select Facility --</option>`;
  }

  const role = document.getElementById("role_id");
  if (role) {
    role.innerHTML = `<option value="">-- Select Role --</option>`;
  }

  const title = document.querySelector(".card-title");
  if (title) title.textContent = "Add User";

  const btn = form.querySelector("button[type=submit]");
  if (btn) {
    btn.innerHTML = `<i class="ri-add-line me-1"></i> Add User`;
  }
}

/* ============================================================
   🚀 INIT
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("userForm");
  if (!form) return;

  const orgSelect = document.getElementById("organization_id");
  const facSelect = document.getElementById("facility_id");
  const roleSelect = document.getElementById("role_id");

  /* ============================================================
     🏢 LOAD DROPDOWNS
  ============================================================ */
  try {
    if (userRole === "superadmin") {
      /* -------- LOAD ORGS -------- */
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        orgSelect,
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );

      /* -------- CASCADE -------- */
      async function reloadAll(orgId = null) {
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
      }

      await reloadAll();

      if (orgSelect) {
        orgSelect.addEventListener("change", () => {
          reloadAll(orgSelect.value || null);
        });
      }
    }

    /* -------- NON SUPERADMIN -------- */
    else {
      if (orgSelect) {
        const wrapper = orgSelect.closest(".mb-3");
        if (wrapper) wrapper.classList.add("hidden");
      }

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
    }

  } catch (err) {
    console.error("❌ Dropdown load failed:", err);
    showToast("❌ Failed to load dropdown data");
  }

  /* ============================================================
     🧾 FORM SETUP
  ============================================================ */
  setupUserFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ EDIT PREFILL
  ============================================================ */
  const editId = sessionStorage.getItem("userEditId");
  const rawPayload = sessionStorage.getItem("userEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("username").value = entry.username || "";
    document.getElementById("email").value = entry.email || "";
    document.getElementById("first_name").value = entry.first_name || "";
    document.getElementById("last_name").value = entry.last_name || "";

    if (entry.status) {
      const el = document.getElementById(`status_${entry.status}`);
      if (el) el.checked = true;
    }

    if (entry.organization_id && orgSelect) {
      orgSelect.value = entry.organization_id;
      orgSelect.dispatchEvent(new Event("change"));
    }

    setTimeout(() => {
      if (entry.facilities?.[0]?.id && facSelect) {
        facSelect.value = entry.facilities[0].id;
      }

      if (entry.roles?.[0]?.id && roleSelect) {
        roleSelect.value = entry.roles[0].id;
      }
    }, 300);

    const title = document.querySelector(".card-title");
    if (title) title.textContent = "Edit User";

    const btn = form.querySelector("button[type=submit]");
    if (btn) {
      btn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update User`;
    }
  }

  if (editId && rawPayload) {
    sharedState.currentEditIdRef.value = editId;
    await applyPrefill(JSON.parse(rawPayload));
  } else {
    const id = new URLSearchParams(window.location.search).get("id");

    if (id) {
      try {
        showLoading();

        const res = await authFetch(`/api/users/${id}`);
        const result = await res.json();

        if (!res.ok || !result?.data) {
          throw new Error(result.message || "Failed to load user");
        }

        sharedState.currentEditIdRef.value = id;
        await applyPrefill(result.data);

      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to load user");
      } finally {
        hideLoading();
      }
    } else {
      resetForm();
    }
  }

  /* ============================================================
     🚪 CANCEL / CLEAR
  ============================================================ */
  const cancelBtn = document.getElementById("cancelBtn");
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      sessionStorage.clear();
      window.location.href = "/users-list.html";
    };
  }

  const clearBtn = document.getElementById("clearBtn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      sessionStorage.clear();
      resetForm();
    };
  }
});