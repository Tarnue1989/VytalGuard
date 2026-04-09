// 📁 insurance-provider-form.js – Secure & Role-Aware Insurance Provider Form (Enterprise-Aligned)
// ============================================================================
// 🔹 Converted from role-form.js (MASTER PARITY)
// 🔹 Rule-driven validation
// 🔹 Superadmin can select org
// 🔹 Org admin implicit org
// 🔹 Facility optional
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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { resolveUserRole } from "../../utils/roleResolver.js";

/* ============================================================
   Helpers
============================================================ */
const getQueryParam = (k) =>
  new URLSearchParams(window.location.search).get(k);

const normalizeMessage = (r, fb) =>
  r?.message || r?.error || r?.msg || fb;

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

/* ============================================================
   Setup Form
============================================================ */
export async function setupInsuranceProviderFormSubmission({ form }) {
  initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const userRole = resolveUserRole();
  const isSuper = userRole === "superadmin";
  const isOrgAdmin = userRole === "organization_admin";

  const providerId =
    sessionStorage.getItem("insuranceProviderEditId") ||
    getQueryParam("id");

  const isEdit = Boolean(providerId);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");

  const setUI = (edit) => {
    titleEl.textContent = edit
      ? "Edit Insurance Provider"
      : "Add Insurance Provider";

    submitBtn.innerHTML = edit
      ? `<i class="ri-save-3-line me-1"></i> Update Provider`
      : `<i class="ri-add-line me-1"></i> Add Provider`;
  };

  setUI(isEdit);

  /* ---------------- DOM ---------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  const hideOrg = () =>
    orgSelect?.closest(".mb-3")?.classList.add("hidden");
  const showOrg = () =>
    orgSelect?.closest(".mb-3")?.classList.remove("hidden");

  const hideFac = () =>
    facSelect?.closest(".mb-3")?.classList.add("hidden");
  const showFac = () =>
    facSelect?.closest(".mb-3")?.classList.remove("hidden");

  /* ============================================================
     Role Visibility
  ============================================================ */
  if (isSuper) {
    showOrg();
    showFac();
  } else if (isOrgAdmin) {
    hideOrg();
    showFac();
  } else {
    hideOrg();
    hideFac();
  }

  /* ============================================================
     Load dropdowns
  ============================================================ */
  try {
    if (isSuper) {
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );

      const reloadFacilities = async (orgId = null) => {
        setupSelectOptions(
          facSelect,
          await loadFacilitiesLite(
            orgId ? { organization_id: orgId } : {},
            true
          ),
          "id",
          "name",
          "-- Select Facility (optional) --"
        );
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", () =>
        reloadFacilities(orgSelect.value || null)
      );
    } else if (isOrgAdmin) {
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite({}, true),
        "id",
        "name",
        "-- Select Facility (optional) --"
      );
    }
  } catch {
    showToast("❌ Failed to load organization/facility lists");
  }

  /* ============================================================
     Prefill (EDIT)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      const stored =
        JSON.parse(sessionStorage.getItem("insuranceProviderEditPayload") || "{}");

      const data =
        stored?.id === providerId
          ? stored
          : await (async () => {
              const res = await authFetch(`/api/insurance-providers/${providerId}`);
              const json = await res.json();
              return json?.data || {};
            })();

      document.getElementById("name").value = data.name || "";
      document.getElementById("contact_info").value = data.contact_info || "";
      document.getElementById("address").value = data.address || "";
      document.getElementById("phone").value = data.phone || "";
      document.getElementById("email").value = data.email || "";

      if (orgSelect) orgSelect.value = data.organization_id || "";
      if (facSelect) facSelect.value = data.facility_id || "";

      const statusRadio = document.querySelector(
        `input[name="status"][value="${data.status || "active"}"]`
      );
      if (statusRadio) statusRadio.checked = true;
    } catch {
      showToast("❌ Failed to load provider");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     Submit
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const payload = {
      name: document.getElementById("name").value.trim(),
      contact_info: document.getElementById("contact_info").value.trim(),
      address: document.getElementById("address").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      status:
        document.querySelector("input[name='status']:checked")?.value ||
        "active",
    };

    if (isSuper) payload.organization_id = normalizeUUID(orgSelect.value);
    payload.facility_id = normalizeUUID(facSelect?.value);

    if (!payload.name) {
      applyServerErrors(form, [{ field: "name", message: "Name is required" }]);
      showToast("❌ Please fill required fields");
      return;
    }

    try {
      showLoading();

      const res = await authFetch(
        isEdit
          ? `/api/insurance-providers/${providerId}`
          : `/api/insurance-providers`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok)
        throw new Error(normalizeMessage(json, "Submission failed"));

      showToast(
        isEdit
          ? "✅ Insurance Provider updated"
          : "✅ Insurance Provider created"
      );

      sessionStorage.clear();
      window.location.href = "/insurance-providers-list.html";
    } catch (err) {
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/insurance-providers-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    clearFormErrors(form);
    form.reset();
    setUI(false);
  });
}