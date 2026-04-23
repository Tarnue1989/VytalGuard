// 📁 feature-access-form.js – Secure & Rule-Driven Feature Access Form
// ============================================================================
// 🧭 Mirrors feature-module-form.js EXACTLY (structure + lifecycle)
// 🔹 Live validation + red fields
// 🔹 Single + Bulk replace (controller-faithful)
// 🔹 No silent coercion
// 🔹 Safe reset + preview lifecycle
// 🔹 Roles load ONLY after organization selection
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import {
  enableLiveValidation,
  clearFormErrors,
  applyServerErrors,
} from "../../utils/form-ux.js";

import {
  loadFeatureModulesLite,
  loadRolesLite,
  loadFacilitiesLite,
  loadOrganizationsLite,
  setupSelectOptions,
  loadPermissionsLite 
} from "../../utils/data-loaders.js";

import { authFetch } from "../../authSession.js";

/* ============================================================
   🧩 Helpers
============================================================ */
function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}
async function loadModulePermissions(mod) {
  const permsRaw = await loadPermissionsLite({ module: mod.key }, true);
  return permsRaw || [];
}
function renderModuleCards() {
  const container = document.getElementById("moduleCardsContainer");
  container.innerHTML = "";

  allModulesCache.forEach((mod) => {
    moduleState[mod.id] = {
      selected: false,
      expanded: false,
      permissions: []
    };

    const col = document.createElement("div");

    // 🔥 4 per row desktop
    col.className = "col-12 col-sm-6 col-lg-3";

    col.innerHTML = `
      <div class="card h-100 shadow-sm border module-card">

        <!-- HEADER -->
        <div class="card-header d-flex justify-content-between align-items-center">

          <div class="d-flex align-items-center gap-2">
            <input
              type="checkbox"
              class="form-check-input module-checkbox"
              data-id="${mod.id}"
            >

            <div class="lh-sm">
              <div class="fw-semibold small mb-0">${mod.name}</div>
              <small class="text-muted">${mod.key}</small>
            </div>
          </div>

          <button
            type="button"
            class="btn btn-xs btn-light expand-btn"
            data-id="${mod.id}"
          >
            ▶
          </button>

        </div>

        <!-- BODY -->
        <div class="card-body d-none" id="perm_${mod.id}">
          <small class="text-muted">Select module to load permissions</small>
        </div>

      </div>
    `;

    container.appendChild(col);
  });
}
function attachModuleEvents() {

  /* =========================
     ✅ MODULE CHECKBOX
  ========================= */
  document.querySelectorAll(".module-checkbox").forEach(cb => {
    cb.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const state = moduleState[id];
      const box = document.getElementById(`perm_${id}`);
      const mod = allModulesCache.find(m => m.id === id);

      state.selected = e.target.checked;

      // ❌ UNCHECK → RESET
      if (!state.selected) {
        state.permissions = [];
        state.expanded = false;

        box.classList.add("d-none");
        box.innerHTML = `<small>Select module first</small>`;

        // reset arrow
        const btn = document.querySelector(`.expand-btn[data-id="${id}"]`);
        if (btn) btn.textContent = "▶";

        return;
      }

      try {
        // 🔥 LOAD ONLY IF EMPTY (avoid reload spam)
        if (!state.permissions.length) {
          const perms = await loadModulePermissions(mod);

          state.permissions = perms.map(p => ({
            key: p.key,
            checked: true
          }));
        }

        renderPermissions(id);

        // 🔥 AUTO OPEN
        box.classList.remove("d-none");
        state.expanded = true;

        // update arrow
        const btn = document.querySelector(`.expand-btn[data-id="${id}"]`);
        if (btn) btn.textContent = "▼";

      } catch (err) {
        console.error(err);
        box.innerHTML = `<small class="text-danger">Failed to load permissions</small>`;
      }
    });
  });


  /* =========================
     ✅ EXPAND / COLLAPSE
  ========================= */
  document.querySelectorAll(".expand-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const state = moduleState[id];
      const box = document.getElementById(`perm_${id}`);
      const mod = allModulesCache.find(m => m.id === id);

      // ❌ block if module not selected
      if (!state.selected) return;

      try {
        // 🔥 ensure permissions exist
        if (!state.permissions.length) {
          const perms = await loadModulePermissions(mod);

          state.permissions = perms.map(p => ({
            key: p.key,
            checked: true
          }));

          renderPermissions(id);
        }

        // 🔁 toggle
        state.expanded = !state.expanded;

        if (state.expanded) {
          box.classList.remove("d-none");
          btn.textContent = "▼";
        } else {
          box.classList.add("d-none");
          btn.textContent = "▶";
        }

      } catch (err) {
        console.error(err);
        box.innerHTML = `<small class="text-danger">Error loading permissions</small>`;
      }
    });
  });
}
function renderPermissions(moduleId) {
  const state = moduleState[moduleId];
  const box = document.getElementById(`perm_${moduleId}`);

  box.innerHTML = `
    <div class="mb-2 d-flex justify-content-between align-items-center">
      <strong class="small">Permissions</strong>

      <div>
        <button type="button" class="btn btn-xs btn-light select-all" data-id="${moduleId}">
          All
        </button>
        <button type="button" class="btn btn-xs btn-light deselect-all" data-id="${moduleId}">
          None
        </button>
      </div>
    </div>

    <div class="permission-list">
      ${state.permissions.map(p => `
        <label class="permission-row">

          <input
            type="checkbox"
            class="form-check-input"
            data-key="${p.key}"
            ${p.checked ? "checked" : ""}
          >

          <span class="permission-text" title="${p.key}">
            ${p.key}
          </span>

        </label>
      `).join("")}
    </div>
  `;

  // 🔁 Sync checkbox state
  box.querySelectorAll("input").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const key = e.target.dataset.key;
      const perm = state.permissions.find(p => p.key === key);
      if (perm) perm.checked = e.target.checked;
    });
  });

  // 🔥 Select all
  box.querySelector(".select-all")?.addEventListener("click", () => {
    state.permissions.forEach(p => p.checked = true);
    box.querySelectorAll("input[type='checkbox']").forEach(cb => {
      cb.checked = true;
    });
  });

  // 🔥 Deselect all
  box.querySelector(".deselect-all")?.addEventListener("click", () => {
    state.permissions.forEach(p => p.checked = false);
    box.querySelectorAll("input[type='checkbox']").forEach(cb => {
      cb.checked = false;
    });
  });
}

/* ============================================================
   📋 FORM RULES (mirrors module pattern)
============================================================ */
const FEATURE_ACCESS_FORM_RULES = [
  { id: "organization_id", message: "Organization is required" },
  { id: "role_id", message: "Role is required" },

  {
    id: "role_id",
    message: "At least one module must be selected",
    when: () => false,
  },

  {
    id: "status",
    message: "Status is required",
    when: () => true,
  },
];

/* ============================================================
   🧠 Bulk State
============================================================ */
let allModulesCache = [];
const moduleState = {};


window.__featureAccessBulkMode = false;

/* ============================================================
   🔽 Dropdowns
============================================================ */
async function populateBaseDropdowns() {
  const [modules, facilities, organizations] = await Promise.all([
    loadFeatureModulesLite(true),
    loadFacilitiesLite({}, true),
    loadOrganizationsLite({}, true),
  ]);

  allModulesCache = modules || [];
  renderModuleCards();
  attachModuleEvents();

  setupSelectOptions(
    document.getElementById("organization_id"),
    organizations,
    "id",
    "name",
    "-- Select Organization --"
  );


  setupSelectOptions(
    document.getElementById("facility_id"),
    facilities,
    "id",
    "name",
    "-- All Facilities (Org-wide) --"
  );

  // ⛔ roles intentionally NOT loaded here
  setupSelectOptions(
    document.getElementById("role_id"),
    [],
    "id",
    "name",
    "-- Select Organization First --"
  );
}

/* ============================================================
   🔁 Load Roles by Organization (STRICT)
============================================================ */
async function loadRolesForOrganization(orgId) {
  const roleSelect = document.getElementById("role_id");
  roleSelect.disabled = true;

  setupSelectOptions(
    roleSelect,
    [],
    "id",
    "name",
    "-- Loading roles... --"
  );

  if (!orgId) {
    setupSelectOptions(
      roleSelect,
      [],
      "id",
      "name",
      "-- Select Organization First --"
    );
    roleSelect.disabled = false;
    return;
  }

  const roles = await loadRolesLite({ organization_id: orgId }, true);

  setupSelectOptions(
    roleSelect,
    roles || [],
    "id",
    "name",
    "-- Select Role --"
  );

  roleSelect.disabled = false;
}

/* ============================================================
   🚀 Main Setup (MASTER-ALIGNED)
============================================================ */
export async function setupFeatureAccessFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();
  enableLiveValidation(form);

  await populateBaseDropdowns();

  const orgSelect = document.getElementById("organization_id");
  const roleSelect = document.getElementById("role_id");
  const addAllBtn = document.getElementById("addAllModulesBtn");
  const fullAccessBtn = document.getElementById("grantFullAccessBtn");

  /* ================= ORG → ROLE CHAIN ================= */
  orgSelect.addEventListener("change", async () => {
    roleSelect.value = "";
    await loadRolesForOrganization(orgSelect.value);
  });

  /* ============================================================
     🔥 SELECT ALL MODULES (FAST + CLEAN)
  ============================================================ */
  addAllBtn?.addEventListener("click", async () => {

    await Promise.all(allModulesCache.map(async (mod) => {
      const id = mod.id;

      moduleState[id].selected = true;

      const checkbox = document.querySelector(
        `.module-checkbox[data-id="${id}"]`
      );
      if (checkbox) checkbox.checked = true;

      // 🔥 load only if needed
      if (!moduleState[id].permissions.length) {
        const perms = await loadModulePermissions(mod);

        moduleState[id].permissions = perms.map(p => ({
          key: p.key,
          checked: true
        }));
      }

      renderPermissions(id);

      const box = document.getElementById(`perm_${id}`);
      if (box) box.classList.remove("d-none");

      const btn = document.querySelector(`.expand-btn[data-id="${id}"]`);
      if (btn) btn.textContent = "▼";
    }));

  });


  /* ============================================================
     🔥 FULL ACCESS (NO RELOAD IF EXISTS)
  ============================================================ */
  fullAccessBtn?.addEventListener("click", async () => {

    await Promise.all(allModulesCache.map(async (mod) => {
      const id = mod.id;

      moduleState[id].selected = true;

      const checkbox = document.querySelector(
        `.module-checkbox[data-id="${id}"]`
      );
      if (checkbox) checkbox.checked = true;

      // 🔥 FIX: avoid reloading every time
      if (!moduleState[id].permissions.length) {
        const perms = await loadModulePermissions(mod);

        moduleState[id].permissions = perms.map(p => ({
          key: p.key,
          checked: true
        }));
      } else {
        // reuse existing
        moduleState[id].permissions.forEach(p => p.checked = true);
      }

      renderPermissions(id);

      const box = document.getElementById(`perm_${id}`);
      if (box) box.classList.remove("d-none");

      const btn = document.querySelector(`.expand-btn[data-id="${id}"]`);
      if (btn) btn.textContent = "▼";
    }));

  });


  /* ============================================================
     📤 SUBMIT
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const errors = [];

    for (const rule of FEATURE_ACCESS_FORM_RULES) {
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

    const orgId = form.organization_id.value;
    const roleId = form.role_id.value;
    const facilityId = form.facility_id.value || null;
    const status =
      form.querySelector("input[name='status']:checked")?.value || "active";

    /* ========================================================
       🔥 BUILD PAYLOAD
    ======================================================== */
    const module_ids = [];
    const permission_keys = [];

    Object.entries(moduleState).forEach(([id, state]) => {
      if (!state.selected) return;

      module_ids.push(id);

      state.permissions.forEach((p) => {
        if (p.checked) {
          permission_keys.push(p.key);
        }
      });
    });

    /* ========================================================
       🚨 VALIDATION
    ======================================================== */
    if (!module_ids.length) {
      showToast("❌ Select at least one module");
      return;
    }

    if (!permission_keys.length) {
      showToast("❌ Select at least one permission");
      return;
    }

    try {
      showLoading();

      const res = await authFetch(
        `/api/features/feature-access/by-role/${roleId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id: orgId,
            role_id: roleId,
            facility_id: facilityId,
            module_ids,
            permission_keys,
            status,
          }),
        }
      );

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(normalizeMessage(result, "Failed to save access"));
      }

      showToast("✅ Role access saved successfully");
      // 🔥 stay on page + reset form cleanly
      form.reset();
      form.dispatchEvent(new Event("reset"));
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  /* ================= RESET ================= */
  form.addEventListener("reset", () => {
    clearFormErrors(form);

    /* =========================
      🔥 RESET MODULE STATE
    ========================= */
    Object.keys(moduleState).forEach(id => {
      const state = moduleState[id];

      // reset state
      state.selected = false;
      state.expanded = false;
      state.permissions = [];

      // reset module checkbox
      const checkbox = document.querySelector(`.module-checkbox[data-id="${id}"]`);
      if (checkbox) checkbox.checked = false;

      // reset permission box
      const box = document.getElementById(`perm_${id}`);
      if (box) {
        box.classList.add("d-none");
        box.innerHTML = `<small>Select module first</small>`;
      }

      // reset expand arrow
      const btn = document.querySelector(`.expand-btn[data-id="${id}"]`);
      if (btn) btn.textContent = "▶";
    });

    /* =========================
      🔥 RESET ROLE DROPDOWN
    ========================= */
    const roleSelect = document.getElementById("role_id");
    if (roleSelect) {
      roleSelect.innerHTML = `<option value="">-- Select Organization First --</option>`;
    }

    /* 🔥 ADD THIS */
    const orgSelect = document.getElementById("organization_id");
    if (orgSelect) {
      orgSelect.value = "";
    }
  });
}