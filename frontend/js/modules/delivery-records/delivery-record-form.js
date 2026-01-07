// 📦 delivery-record-form.js – Secure, Role-Aware Delivery Record Form (Enterprise-Aligned)
// ============================================================================
// 🔹 Master Pattern: registrationLog-form.js (1:1 org/facility handling)
// 🔹 Delivery-specific: patient-triggered consultation reload, doctor/midwife, etc.
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
  loadDepartmentsLite,
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
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

function normalizeDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/* ============================================================
   🔁 Consultation Loader (Date + Status)
============================================================ */
async function reloadConsultations(patientId, preselectId = null, preselectLabel = null) {
  const select = document.getElementById("consultationSelect");
  if (!select) return;

  setupSelectOptions(select, [], "id", "label", "-- Select Consultation --");
  if (!patientId) return;

  try {
    const res = await authFetch(`/api/lite/consultations?patient_id=${patientId}`);
    const data = await res.json();
    let consultations = data?.data?.records || data?.data || [];

    consultations = consultations.filter((c) =>
      ["open", "in_progress"].includes((c.status || "").toLowerCase())
    );

    const options = consultations.map((c) => {
      const rawDate = c.consultation_date || c.date;
      const dateStr = rawDate
        ? new Date(rawDate).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "(no date)";
      const statusStr = (c.status || "unknown").toLowerCase();
      return {
        id: c.id,
        label: c.label || `${dateStr} — ${statusStr}`,
      };
    });

    setupSelectOptions(select, options, "id", "label", "-- Select Consultation --");

    if (preselectId) {
      const match = options.find((o) => o.id === preselectId);
      if (match) select.value = preselectId;
      else if (preselectLabel) {
        const opt = document.createElement("option");
        opt.value = preselectId;
        opt.textContent = preselectLabel;
        opt.selected = true;
        select.appendChild(opt);
      }
    }
  } catch (err) {
    console.error("❌ Consultation load failed:", err);
  }
}

/* ============================================================
   🚀 Main Form Setup
============================================================ */
export async function setupDeliveryRecordFormSubmission({ form }) {
  const token = initPageGuard(
    autoPagePermissionKey(["delivery_records:create", "delivery_records:edit"])
  );
  initLogoutWatcher();

  const deliveryId = getQueryParam("id") || sessionStorage.getItem("deliveryRecordEditId");
  const isEdit = !!deliveryId;

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  const setFormTitle = (text, icon) => {
    if (titleEl) titleEl.textContent = text;
    if (submitBtn) submitBtn.innerHTML = `<i class="${icon} me-1"></i> ${text}`;
  };

  isEdit
    ? setFormTitle("Update Delivery Record", "ri-save-3-line")
    : setFormTitle("Add Delivery Record", "ri-add-line");

  /* ------------------------- DOM References ------------------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const departmentSelect = document.getElementById("departmentSelect");
  const billableItemSelect = document.getElementById("billableItemSelect");
  const consultationSelect = document.getElementById("consultationSelect");

  const patientInput = document.getElementById("patientInput");
  const patientHidden = document.getElementById("patientId");
  const patientSuggestions = document.getElementById("patientSuggestions");
  const doctorInput = document.getElementById("doctorInput");
  const doctorHidden = document.getElementById("doctorId");
  const doctorSuggestions = document.getElementById("doctorSuggestions");
  const midwifeInput = document.getElementById("midwifeInput");
  const midwifeHidden = document.getElementById("midwifeId");
  const midwifeSuggestions = document.getElementById("midwifeSuggestions");

  const deliveryDate = document.getElementById("deliveryDate");
  const deliveryType = document.getElementById("deliveryType");
  const deliveryMode = document.getElementById("deliveryMode");
  const babyCount = document.getElementById("babyCount");
  const birthWeight = document.getElementById("birthWeight");
  const birthLength = document.getElementById("birthLength");
  const newbornWeight = document.getElementById("newbornWeight");
  const newbornGender = document.getElementById("newbornGender");
  const apgarScore = document.getElementById("apgarScore");
  const complications = document.getElementById("complications");
  const notes = document.getElementById("notes");
  const isEmergency = document.getElementById("isEmergency");

  /* ============================================================
     🔽 Prefill dropdowns + suggestion inputs
  ============================================================ */
  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    const departments = await loadDepartmentsLite({}, true);
    setupSelectOptions(departmentSelect, departments, "id", "name", "-- Select Department --");

    const items = await loadBillableItemsLite({ category: "delivery" }, true);
    setupSelectOptions(billableItemSelect, items, "id", "name", "-- Select Billable Item --");

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (selected) => {
        patientHidden.value = selected?.id || "";
        patientInput.value =
          selected.full_name ||
          `${selected.pat_no || ""} ${selected.full_name || ""}`.trim();
        reloadConsultations(patientHidden.value);
      },
      "full_name"
    );

    setupSuggestionInputDynamic(
      doctorInput,
      doctorSuggestions,
      "/api/lite/employees",
      (sel) => {
        doctorHidden.value = sel?.id || "";
        doctorInput.value = sel.full_name || `${sel.first_name || ""} ${sel.last_name || ""}`.trim();
      },
      "full_name"
    );

    setupSuggestionInputDynamic(
      midwifeInput,
      midwifeSuggestions,
      "/api/lite/employees",
      (sel) => {
        midwifeHidden.value = sel?.id || "";
        midwifeInput.value = sel.full_name || `${sel.first_name || ""} ${sel.last_name || ""}`.trim();
      },
      "full_name"
    );
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ============================================================
     🧩 Prefill if editing
  ============================================================ */
  if (isEdit && deliveryId) {
    try {
      showLoading();
      const raw = sessionStorage.getItem("deliveryRecordEditPayload");
      let entry = raw ? JSON.parse(raw) : null;

      if (!entry) {
        const res = await authFetch(`/api/delivery-records/${deliveryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        entry = result?.data;
      }

      if (!entry) throw new Error("❌ Delivery record not found");

      deliveryDate.value = normalizeDate(entry.delivery_date) || "";
      deliveryType.value = entry.delivery_type || "";
      deliveryMode.value = entry.delivery_mode || "";
      babyCount.value = entry.baby_count || "";
      birthWeight.value = entry.birth_weight || "";
      birthLength.value = entry.birth_length || "";
      newbornWeight.value = entry.newborn_weight || "";
      newbornGender.value = entry.newborn_gender || "";
      apgarScore.value = entry.apgar_score || "";
      complications.value = entry.complications || "";
      notes.value = entry.notes || "";
      isEmergency.checked = !!entry.is_emergency;

      if (entry.organization_id && orgSelect) {
        orgSelect.value = entry.organization_id;
        const facs = await loadFacilitiesLite(
          { organization_id: entry.organization_id },
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
      if (entry.facility_id) facSelect.value = entry.facility_id;
      if (entry.department_id) departmentSelect.value = entry.department_id;
      if (entry.billable_item_id) billableItemSelect.value = entry.billable_item_id;

      if (entry.patient) {
        patientHidden.value = entry.patient.id;
        patientInput.value =
          `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim();

        let preLabel = null;
        if (entry.consultation) {
          const rawDate = entry.consultation.consultation_date || entry.consultation.date;
          const dateStr = rawDate
            ? new Date(rawDate).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "(no date)";
          const statusStr = (entry.consultation.status || "unknown").toLowerCase();
          preLabel = `${dateStr} — ${statusStr}`;
        }
        await reloadConsultations(entry.patient.id, entry.consultation_id, preLabel);
      }

      if (entry.doctor) {
        doctorHidden.value = entry.doctor.id;
        doctorInput.value = entry.doctor.full_name || "";
      }
      if (entry.midwife) {
        midwifeHidden.value = entry.midwife.id;
        midwifeInput.value = entry.midwife.full_name || "";
      }

      setFormTitle("Update Delivery Record", "ri-save-3-line");
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load record");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const organizationId = orgSelect?.value || localStorage.getItem("organizationId");
    const facilityId = facSelect?.value || localStorage.getItem("facilityId");

    const payload = {
      organization_id: normalizeUUID(organizationId),
      facility_id: normalizeUUID(facilityId),
      patient_id: normalizeUUID(patientHidden.value),
      doctor_id: normalizeUUID(doctorHidden.value),
      midwife_id: normalizeUUID(midwifeHidden.value),
      department_id: normalizeUUID(departmentSelect?.value),
      billable_item_id: normalizeUUID(billableItemSelect?.value),
      consultation_id: normalizeUUID(consultationSelect?.value),
      delivery_date: normalizeDate(deliveryDate.value),
      delivery_type: deliveryType.value || null,
      delivery_mode: deliveryMode.value || null,
      baby_count: parseInt(babyCount.value || 0, 10) || null,
      birth_weight: birthWeight.value || null,
      birth_length: birthLength.value || null,
      newborn_weight: newbornWeight.value || null,
      newborn_gender: newbornGender.value || null,
      apgar_score: apgarScore.value || null,
      complications: complications.value || null,
      notes: notes.value || null,
      is_emergency: !!isEmergency.checked,
    };

    if (!payload.organization_id) return showToast("❌ Organization is required");
    if (!payload.facility_id) return showToast("❌ Facility is required");
    if (!payload.patient_id) return showToast("❌ Patient is required");
    if (!payload.delivery_date) return showToast("❌ Delivery Date is required");
    if (!payload.delivery_type) return showToast("❌ Delivery Type is required");

    try {
      showLoading();
      const url = isEdit
        ? `/api/delivery-records/${deliveryId}`
        : `/api/delivery-records`;
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
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(isEdit ? "✅ Delivery Record updated" : "✅ Delivery Record created");
      sessionStorage.removeItem("deliveryRecordEditId");
      sessionStorage.removeItem("deliveryRecordEditPayload");
      window.location.href = "/delivery-records-list.html";
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ============================================================
     🚪 Clear / Cancel Buttons
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("deliveryRecordEditId");
    sessionStorage.removeItem("deliveryRecordEditPayload");
    window.location.href = "/delivery-records-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    form.reset();
    patientHidden.value = doctorHidden.value = midwifeHidden.value = "";
    setupSelectOptions(consultationSelect, [], "id", "label", "-- Select Consultation --");
    setFormTitle("Add Delivery Record", "ri-add-line");
  });
}
