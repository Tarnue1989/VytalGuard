// 📦 delivery-record-form.js – Secure & Role-Aware Delivery Record Form (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🔹 Rule-driven validation (DELIVERY_RECORD_FORM_RULES)
// 🔹 Role-aware org / facility handling (resolver-based)
// 🔹 Suggestion inputs (patient / doctor / midwife)
// 🔹 Patient-triggered consultation reload
// 🔹 Add + Edit parity
// 🔹 Controller-faithful payload (no silent mapping)
// 🔹 FULL parity with ekg-record-form.js / registrationLog-form.js / centralstock-form.js
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

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import {
  resolveUserRole,
  getOrganizationId,
  getFacilityId,
} from "../../utils/roleResolver.js";

import { DELIVERY_RECORD_FORM_RULES } from "./delivery-record.form.rules.js";

/* ============================================================
   🧩 HELPERS
============================================================ */
const qs = (id) => document.getElementById(id);

const normalizeUUID = (v) =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const normalizeDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ============================================================
   🛡️ RULE VALIDATION (MASTER PARITY)
============================================================ */
function validateUsingRules(form) {
  const errors = [];

  for (const rule of DELIVERY_RECORD_FORM_RULES) {
    if (typeof rule.when === "function" && !rule.when()) continue;

    const el =
      document.getElementById(rule.id) ||
      form.querySelector(`[name="${rule.id}"]`);

    if (!el) continue;

    let value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.type === "radio")
      value = document.querySelector(`input[name="${el.name}"]:checked`);
    else value = el.value;

    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === false
    ) {
      errors.push({ field: rule.id, message: rule.message });
    }
  }

  return errors;
}

/* ============================================================
   🔁 CONSULTATION LOADER (PATIENT-DRIVEN)
============================================================ */
async function reloadConsultations(patientId, preselectId = null, preLabel = null) {
  const select = qs("consultationSelect");
  if (!select) return;

  setupSelectOptions(select, [], "id", "label", "-- Select Consultation --");
  if (!patientId) return;

  try {
    const res = await authFetch(`/api/lite/consultations?patient_id=${patientId}`);
    const json = await res.json().catch(() => ({}));
    let rows = json?.data?.records || json?.data || [];

    rows = rows.filter((c) =>
      ["open", "in_progress"].includes((c.status || "").toLowerCase())
    );

    const options = rows.map((c) => {
      const raw = c.consultation_date || c.date;
      const dateStr = raw
        ? new Date(raw).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "(no date)";
      const status = (c.status || "unknown").toLowerCase();
      return { id: c.id, label: c.label || `${dateStr} — ${status}` };
    });

    setupSelectOptions(select, options, "id", "label", "-- Select Consultation --");

    if (preselectId) {
      const match = options.find((o) => o.id === preselectId);
      if (match) select.value = preselectId;
      else if (preLabel) {
        const opt = document.createElement("option");
        opt.value = preselectId;
        opt.textContent = preLabel;
        opt.selected = true;
        select.appendChild(opt);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

/* ============================================================
   🚀 MAIN SETUP
============================================================ */
export async function setupDeliveryRecordFormSubmission({ form }) {
  initPageGuard(
    autoPagePermissionKey(["delivery_records:create", "delivery_records:edit"])
  );
  initLogoutWatcher();
  enableLiveValidation(form);

  const sessionId = sessionStorage.getItem("deliveryRecordEditId");
  const payloadCache = sessionStorage.getItem("deliveryRecordEditPayload");
  const queryId = new URLSearchParams(window.location.search).get("id");

  const deliveryId = sessionId || queryId;
  const isEdit = Boolean(deliveryId || payloadCache);

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form.querySelector("button[type=submit]");
  const cancelBtn = qs("cancelBtn");
  const clearBtn = qs("clearBtn");

  const setUI = (edit) => {
    if (titleEl)
      titleEl.textContent = edit
        ? "Update Delivery Record"
        : "Add Delivery Record";
    if (submitBtn)
      submitBtn.innerHTML = edit
        ? `<i class="ri-save-3-line me-1"></i> Update`
        : `<i class="ri-add-line me-1"></i> Submit`;
  };

  setUI(isEdit);

  /* ================= DOM ================= */
  const orgSelect = qs("organizationSelect");
  const facSelect = qs("facilitySelect");
  const deptSelect = qs("departmentSelect");
  const billableSelect = qs("billableItemSelect");
  const consultationSelect = qs("consultationSelect");

  const patientInput = qs("patientInput");
  const patientId = qs("patientId");
  const patientSuggestions = qs("patientSuggestions");

  const doctorInput = qs("doctorInput");
  const doctorId = qs("doctorId");
  const doctorSuggestions = qs("doctorSuggestions");

  const midwifeInput = qs("midwifeInput");
  const midwifeId = qs("midwifeId");
  const midwifeSuggestions = qs("midwifeSuggestions");

  /* ================= ROLE ================= */
  const role = resolveUserRole();
  const isSuper = role === "superadmin";
  const isOrgAdmin = role === "organization_admin" || role === "admin";

  const showOrg = () =>
    orgSelect?.closest(".form-group")?.classList.remove("hidden");
  const hideOrg = () =>
    orgSelect?.closest(".form-group")?.classList.add("hidden");
  const showFac = () =>
    facSelect?.closest(".form-group")?.classList.remove("hidden");
  const hideFac = () =>
    facSelect?.closest(".form-group")?.classList.add("hidden");

  /* ============================================================
     🌐 DROPDOWNS & SUGGESTIONS
  ============================================================ */
  try {
    if (isSuper) {
      showOrg();
      setupSelectOptions(
        orgSelect,
        await loadOrganizationsLite(),
        "id",
        "name",
        "-- Select Organization --"
      );
    } else {
      hideOrg();
    }

    if (isSuper || isOrgAdmin) {
      showFac();
      setupSelectOptions(
        facSelect,
        await loadFacilitiesLite(
          { organization_id: getOrganizationId() },
          true
        ),
        "id",
        "name",
        "-- Select Facility --"
      );
      if (getFacilityId()) facSelect.value = getFacilityId();
    } else {
      hideFac();
    }

    setupSelectOptions(
      deptSelect,
      await loadDepartmentsLite({}, true),
      "id",
      "name",
      "-- Select Department --"
    );

    setupSelectOptions(
      billableSelect,
      await loadBillableItemsLite({ category: "delivery" }, true),
      "id",
      "name",
      "-- Select Delivery Type --"
    );

    setupSuggestionInputDynamic(
      patientInput,
      patientSuggestions,
      "/api/lite/patients",
      (p) => {
        patientId.value = p?.id || "";
        patientInput.value = p?.label || p?.full_name || "";
        reloadConsultations(patientId.value);
      },
      "label"
    );

    setupSuggestionInputDynamic(
      doctorInput,
      doctorSuggestions,
      "/api/lite/employees",
      (d) => {
        doctorId.value = d?.id || "";
        doctorInput.value = d?.full_name || "";
      }
    );

    setupSuggestionInputDynamic(
      midwifeInput,
      midwifeSuggestions,
      "/api/lite/employees",
      (m) => {
        midwifeId.value = m?.id || "";
        midwifeInput.value = m?.full_name || "";
      }
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load reference data");
  }

  /* ============================================================
     ✏️ PREFILL (EDIT MODE)
  ============================================================ */
  if (isEdit) {
    try {
      showLoading();

      let entry =
        JSON.parse(
          sessionStorage.getItem("deliveryRecordEditPayload") || "null"
        ) ||
        (await (await authFetch(`/api/delivery-records/${deliveryId}`)).json())
          .data;

      if (!entry) throw new Error("Delivery record not found");

      patientId.value = entry.patient_id || "";
      if (entry.patient)
        patientInput.value = `${entry.patient.pat_no || ""} ${
          entry.patient.full_name || ""
        }`.trim();

      doctorId.value = entry.doctor_id || "";
      doctorInput.value = entry.doctor?.full_name || "";

      midwifeId.value = entry.midwife_id || "";
      midwifeInput.value = entry.midwife?.full_name || "";

      qs("deliveryDate").value = normalizeDate(entry.delivery_date);
      qs("deliveryMode").value = entry.delivery_mode || "";
      qs("babyCount").value = entry.baby_count ?? "";
      qs("birthWeight").value = entry.birth_weight ?? "";
      qs("birthLength").value = entry.birth_length ?? "";
      qs("newbornWeight").value = entry.newborn_weight ?? "";
      qs("newbornGender").value = entry.newborn_gender ?? "";
      qs("apgarScore").value = entry.apgar_score ?? "";
      qs("complications").value = entry.complications ?? "";
      qs("notes").value = entry.notes ?? "";
      qs("isEmergency").checked = !!entry.is_emergency;

      if (isSuper && entry.organization_id) orgSelect.value = entry.organization_id;
      if ((isSuper || isOrgAdmin) && entry.facility_id)
        facSelect.value = entry.facility_id;

      if (entry.department_id) deptSelect.value = entry.department_id;
      if (entry.billable_item_id) billableSelect.value = entry.billable_item_id;

      if (entry.patient_id) {
        let label = null;
        if (entry.consultation) {
          const d = entry.consultation.consultation_date;
          const ds = d
            ? new Date(d).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "(no date)";
          label = `${ds} — ${entry.consultation.status}`;
        }
        await reloadConsultations(
          entry.patient_id,
          entry.consultation_id,
          label
        );
      }

      setUI(true);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to load delivery record");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🛡️ SUBMIT (MASTER VALIDATION PARITY)
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    clearFormErrors(form);

    const ruleErrors = validateUsingRules(form);
    if (ruleErrors.length) {
      applyServerErrors(form, ruleErrors);
      return showToast("❌ Fix highlighted fields");
    }

    const payload = {
      organization_id: isSuper ? normalizeUUID(orgSelect.value) : null,
      facility_id: normalizeUUID(facSelect.value),
      patient_id: normalizeUUID(patientId.value),
      doctor_id: normalizeUUID(doctorId.value),
      midwife_id: normalizeUUID(midwifeId.value),
      department_id: normalizeUUID(deptSelect.value),
      billable_item_id: normalizeUUID(billableSelect.value),
      consultation_id: normalizeUUID(consultationSelect?.value),
      delivery_date: normalizeDate(qs("deliveryDate").value),
      delivery_mode: qs("deliveryMode").value || null,
      baby_count: qs("babyCount").value || null,
      birth_weight: qs("birthWeight").value || null,
      birth_length: qs("birthLength").value || null,
      newborn_weight: qs("newbornWeight").value || null,
      newborn_gender: qs("newbornGender").value || null,
      apgar_score: qs("apgarScore").value || null,
      complications: qs("complications").value || null,
      notes: qs("notes").value || null,
      is_emergency: qs("isEmergency").checked,
    };

    try {
      showLoading();
      const res = await authFetch(
        isEdit
          ? `/api/delivery-records/${deliveryId}`
          : `/api/delivery-records`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Submission failed");

      showToast(isEdit ? "✅ Updated" : "✅ Created");

      sessionStorage.clear();
      window.location.href = "/delivery-records-list.html";
    } catch (err) {
      console.error(err);
      showToast("❌ Submission failed");
    } finally {
      hideLoading();
    }
  };

  cancelBtn?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/delivery-records-list.html";
  });

  clearBtn?.addEventListener("click", () => {
    form.reset();
    patientId.value = doctorId.value = midwifeId.value = "";
    setupSelectOptions(
      consultationSelect,
      [],
      "id",
      "label",
      "-- Select Consultation --"
    );
    setUI(false);
  });
}
