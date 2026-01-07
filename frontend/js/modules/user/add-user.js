// 📁 add-user.js – User Form (Add/Edit) Page Controller (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-main.js / vital-main.js
// 🔹 Enterprise auth guard + role normalization
// 🔹 Shared state + reset/edit/add flow
// 🔹 Preserves all original HTML IDs
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

import { authFetch } from "../../authSession.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧩 User Role Normalization (CRITICAL)
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
   🧹 Reset Form Helper → Back to Add Mode
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

  const orgSelect = document.getElementById("organization_id");
  if (orgSelect) orgSelect.value = "";

  const facSelect = document.getElementById("facility_id");
  if (facSelect) {
    facSelect.innerHTML = `<option value="">-- Select Facility --</option>`;
  }

  const roleSelect = document.getElementById("role_id");
  if (roleSelect) {
    roleSelect.innerHTML = `<option value="">-- Select Role --</option>`;
  }

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add User";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Create User`;
  }
}

/* ============================================================
   🧩 Load Assignment Options (ORG / FAC / ROLE)
============================================================ */
async function loadAssignmentOptions(selected = {}) {
  try {
    const orgSelect = document.getElementById("organization_id");
    const facSelect = document.getElementById("facility_id");
    const roleSelect = document.getElementById("role_id");

    /* ---------------- ORGS ---------------- */
    if (orgSelect) {
      if (userRole === "superadmin") {
        const res = await authFetch("/api/organizations/lite/list");
        const data = await res.json();
        const orgs = data?.data?.records || [];

        orgSelect.innerHTML = `<option value="">-- Select Organization --</option>`;
        orgs.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o.id;
          opt.textContent = o.name || o.code || o.id;
          orgSelect.appendChild(opt);
        });

        if (selected.organization_id) {
          orgSelect.value = selected.organization_id;
        }
      } else {
        orgSelect.closest(".form-group")?.classList.add("hidden");
      }
    }

    /* ---------------- FACILITIES ---------------- */
    if (facSelect) {
      facSelect.innerHTML = `<option value="">-- Select Facility --</option>`;

      const facUrl = selected.organization_id
        ? `/api/facilities/lite/list?organization_id=${selected.organization_id}`
        : `/api/facilities/lite/list`;

      const res = await authFetch(facUrl);
      const data = await res.json();
      const facs = data?.data?.records || [];

      facs.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.id;
        opt.textContent = f.name || f.code || f.id;
        facSelect.appendChild(opt);
      });

      if (selected.facility_id) {
        facSelect.value = selected.facility_id;
      }
    }

    /* ---------------- ROLES ---------------- */
    if (!roleSelect) return;

    roleSelect.innerHTML = `<option value="">-- Select Role --</option>`;

    const roleUrl = selected.organization_id
      ? `/api/roles/lite/list?organization_id=${selected.organization_id}`
      : `/api/roles/lite/list`;

    const roleRes = await authFetch(roleUrl);
    const roleData = await roleRes.json();
    const roles = roleData?.data?.records || [];

    roles.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name || r.code || r.id;
      roleSelect.appendChild(opt);
    });

    if (selected.role_id) {
      roleSelect.value = selected.role_id;
    }

  } catch (err) {
    console.error("❌ Failed to load assignment options:", err);
    showToast("❌ Could not load assignments");
  }
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("userForm");
  if (!form) return;

  setupUserFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  const editId = sessionStorage.getItem("userEditId");
  const rawPayload = sessionStorage.getItem("userEditPayload");

  async function applyPrefill(entry) {
    document.getElementById("username").value = entry.username || "";
    document.getElementById("email").value = entry.email || "";
    document.getElementById("first_name").value = entry.first_name || "";
    document.getElementById("last_name").value = entry.last_name || "";

    if (entry.status) {
      document
        .getElementById(`status_${entry.status.toLowerCase()}`)
        ?.click();
    }

    await loadAssignmentOptions({
      organization_id: entry.organization?.id || entry.organization_id,
      facility_id: entry.facilities?.[0]?.id || null,
      role_id: entry.roles?.[0]?.id || null,
    });

    const titleEl = document.querySelector(".card-title");
    if (titleEl) titleEl.textContent = "Edit User";

    const submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) {
      submitBtn.innerHTML =
        `<i class="ri-save-3-line me-1"></i> Update User`;
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
        if (!res.ok || !result?.data)
          throw new Error(result.message || "Failed to load user");

        sharedState.currentEditIdRef.value = id;
        await applyPrefill(result.data);
      } catch (err) {
        console.error("❌ Load user failed:", err);
        showToast(err.message || "❌ Failed to load user for editing");
      } finally {
        hideLoading();
      }
    } else {
      resetForm();
    }
  }

  /* ============================================================
     🚪 Cancel & Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("userEditId");
    sessionStorage.removeItem("userEditPayload");
    window.location.href = "/users-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("userEditId");
    sessionStorage.removeItem("userEditPayload");
    resetForm();
  });
});
