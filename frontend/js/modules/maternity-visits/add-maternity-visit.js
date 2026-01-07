// 📦 add-maternity-visit.js – Maternity Visit Form (Add/Edit) Page Controller (Enterprise-Aligned)

import { setupMaternityVisitFormSubmission } from "./maternity-visit-form.js";
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
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard – Enterprise Safe
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧩 Helpers
============================================================ */
function renderPatientLabel(p) {
  if (!p) return "";
  const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return `${p.pat_no ? p.pat_no + " - " : ""}${full || p.full_name || ""}`.trim();
}

/* ============================================================
   🧹 Reset Form (Safe Add Mode)
============================================================ */
function resetForm() {
  const form = document.getElementById("maternityVisitForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("maternityVisitEditId");
  sessionStorage.removeItem("maternityVisitEditPayload");

  // Clear hidden IDs
  ["patientId", "doctorId", "midwifeId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "visitTypeSelect",
    "registrationLogSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // UI reset
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Maternity Visit";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Maternity Visit`;
}

/* ============================================================
   🚀 Init (DOM Ready)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("maternityVisitForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const visitTypeSelect = document.getElementById("visitTypeSelect");
  const regLogSelect = document.getElementById("registrationLogSelect");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  /* ---------------- Organization & Facility ---------------- */
  async function reloadFacilities(orgId = null) {
    const facs = await loadFacilitiesLite(
      orgId ? { organization_id: orgId } : {},
      true
    );
    setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
  }

  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });

      await reloadFacilities();
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      await reloadFacilities();
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ Org/Facility preload failed:", err);
    showToast("❌ Could not load organization/facility");
  }

  /* ---------------- Visit Types (Billable Items) ---------------- */
  try {
    const visitTypes = await loadBillableItemsLite(
      { category: "maternity-visit" },
      true
    );
    setupSelectOptions(
      visitTypeSelect,
      visitTypes,
      "id",
      "name",
      "-- Select Visit Type --"
    );
  } catch (err) {
    console.error("❌ Visit type preload failed:", err);
  }

  /* ---------------- Suggestion Inputs ---------------- */
  setupSuggestionInputDynamic(
    document.getElementById("patientInput"),
    document.getElementById("patientSuggestions"),
    "/api/lite/patients",
    (sel) => {
      document.getElementById("patientId").value = sel?.id || "";
      document.getElementById("patientInput").value = renderPatientLabel(sel);
    },
    "label"
  );

  setupSuggestionInputDynamic(
    document.getElementById("doctorInput"),
    document.getElementById("doctorSuggestions"),
    "/api/lite/employees",
    (sel) => {
      document.getElementById("doctorId").value = sel?.id || "";
      document.getElementById("doctorInput").value =
        sel?.full_name ||
        [sel?.first_name, sel?.last_name].filter(Boolean).join(" ");
    },
    "full_name"
  );

  setupSuggestionInputDynamic(
    document.getElementById("midwifeInput"),
    document.getElementById("midwifeSuggestions"),
    "/api/lite/employees",
    (sel) => {
      document.getElementById("midwifeId").value = sel?.id || "";
      document.getElementById("midwifeInput").value =
        sel?.full_name ||
        [sel?.first_name, sel?.last_name].filter(Boolean).join(" ");
    },
    "full_name"
  );

  /* ---------------- Form Submission ---------------- */
  await setupMaternityVisitFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Edit Mode ---------------- */
  const cachedId = sessionStorage.getItem("maternityVisitEditId");
  const cachedPayload = sessionStorage.getItem("maternityVisitEditPayload");

  async function applyPrefill(entry) {
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v || "";
    };
    const setDate = (id, v) => {
      const el = document.getElementById(id);
      if (el && v) el.value = v.split("T")[0];
    };

    setDate("visitDate", entry.visit_date);
    setDate("lnmp", entry.lnmp);
    setDate("expectedDueDate", entry.expected_due_date);
    setVal("estimatedGestAge", entry.estimated_gestational_age);
    setVal("fundusHeight", entry.fundus_height);
    setVal("fetalHeartRate", entry.fetal_heart_rate);
    setVal("presentation", entry.presentation);
    setVal("position", entry.position);
    setVal("complaint", entry.complaint);
    setVal("gravida", entry.gravida);
    setVal("para", entry.para);
    setVal("abortion", entry.abortion);
    setVal("living", entry.living);
    setVal("visitNotes", entry.visit_notes);
    setVal("bloodPressure", entry.blood_pressure);
    setVal("weight", entry.weight);
    setVal("height", entry.height);
    setVal("temperature", entry.temperature);
    setVal("pulseRate", entry.pulse_rate);

    if (entry.organization?.id && orgSelect) {
      orgSelect.value = entry.organization.id;
      await reloadFacilities(entry.organization.id);
    }
    if (entry.facility?.id && facSelect) facSelect.value = entry.facility.id;
    if (entry.billableItem?.id && visitTypeSelect)
      visitTypeSelect.value = entry.billableItem.id;
    if (entry.registrationLog?.id && regLogSelect)
      regLogSelect.value = entry.registrationLog.id;

    if (entry.patient) {
      document.getElementById("patientId").value = entry.patient.id;
      document.getElementById("patientInput").value = renderPatientLabel(entry.patient);
    }
    if (entry.doctor) {
      document.getElementById("doctorId").value = entry.doctor.id;
      document.getElementById("doctorInput").value =
        entry.doctor.full_name ||
        [entry.doctor.first_name, entry.doctor.last_name].filter(Boolean).join(" ");
    }
    if (entry.midwife) {
      document.getElementById("midwifeId").value = entry.midwife.id;
      document.getElementById("midwifeInput").value =
        entry.midwife.full_name ||
        [entry.midwife.first_name, entry.midwife.last_name].filter(Boolean).join(" ");
    }

    document.querySelector(".card-title").textContent = "Edit Maternity Visit";
    form.querySelector("button[type=submit]").innerHTML =
      `<i class="ri-save-3-line me-1"></i> Update Maternity Visit`;
  }

  if (cachedId && cachedPayload) {
    try {
      sharedState.currentEditIdRef.value = cachedId;
      await applyPrefill(JSON.parse(cachedPayload));
    } catch (err) {
      console.error("❌ Cached edit failed:", err);
      showToast("❌ Could not load cached maternity visit");
    }
  } else {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      sharedState.currentEditIdRef.value = id;
      try {
        showLoading();
        const res = await authFetch(`/api/maternity-visits/${id}`);
        const result = await res.json();
        if (!res.ok || !result?.data)
          throw new Error(result.message || "Failed to load maternity visit");
        await applyPrefill(result.data);
      } catch (err) {
        console.error(err);
        showToast(err.message);
      } finally {
        hideLoading();
      }
    }
  }

  /* ---------------- Cancel / Clear ---------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    resetForm();
    window.location.href = "/maternity-visits-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", resetForm);
});
