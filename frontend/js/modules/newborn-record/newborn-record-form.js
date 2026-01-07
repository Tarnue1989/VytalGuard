// 📁 newborn-record-form.js – Handles add/edit form for Newborn Record
import { showToast, showLoading, hideLoading } from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import {
  loadFacilitiesLite,
  loadOrganizationsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
  loadDeliveryRecordsLite
} from "../../utils/data-loaders.js";

// 🔎 Extract query param
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// 🛠 Normalize any message into a string
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

// 🛡️ Validate form fields before sending
function validateNewbornForm(form) {
  const labels = {
    motherId: "Mother",
    deliveryRecordId: "Delivery Record",
    gender: "Gender",
    facilitySelect: "Facility",
  };

  const required = ["motherId", "deliveryRecordId", "gender", "facilitySelect"];
  for (const id of required) {
    const el = form.querySelector(`#${id}`);
    if (el && !el.value.trim()) {
      showToast(`❌ ${labels[id] || id} is required`);
      el.focus();
      return false;
    }
  }
  return true;
}

// 🔽 Delivery Record dropdown (populated after selecting Mother)
const deliverySelect = document.getElementById("deliveryRecordId");

export async function loadDeliveriesForMother(motherId, prefillId = null) {
  if (!deliverySelect) return;
  deliverySelect.innerHTML = `<option value="">-- Select Delivery Record --</option>`;

  if (!motherId) return;

  try {
    const deliveries = await loadDeliveryRecordsLite({ patient_id: motherId });

    // Build nicer labels
    deliveries.forEach((d) => {
      d.label = `${d.delivery_type || "Delivery"} on ${d.date?.split("T")[0] || ""} (${d.status})`;
    });

    setupSelectOptions(deliverySelect, deliveries, "id", "label", "-- Select Delivery Record --");

    // Prefill if editing
    if (prefillId) {
      deliverySelect.value = prefillId;
    }
  } catch (err) {
    console.error("❌ Failed to load deliveries:", err);
    showToast("❌ Failed to load delivery records");
  }
}

// 🚀 Initialize Newborn Record form
export async function setupNewbornRecordFormSubmission({ form }) {
  const sessionId = sessionStorage.getItem("newbornRecordEditId");
  const queryId = getQueryParam("id");
  const recordId = sessionId || queryId;
  const isEdit = !!recordId;

  const userRole = (localStorage.getItem("userRole") || "").trim().toLowerCase();

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");

  function setAddModeUI() {
    if (titleEl) titleEl.textContent = "Add Newborn Record";
    if (submitBtn) submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Newborn Record`;
  }
  function setEditModeUI() {
    if (titleEl) titleEl.textContent = "Edit Newborn Record";
    if (submitBtn) submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Newborn Record`;
  }

  if (isEdit) setEditModeUI();
  else setAddModeUI();

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");

  // 🔽 Load org/fac based on role
  async function loadAssignments() {
    try {
      if (userRole === "superadmin") {
        const orgs = await loadOrganizationsLite();
        if (orgSelect) {
          setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
          orgSelect.closest(".form-group").style.display = "";

          orgSelect.onchange = async () => {
            const orgId = orgSelect.value;
            facSelect.innerHTML = `<option value="">-- Select Facility --</option>`;
            if (orgId) {
              const facs = await loadFacilitiesLite({ organization_id: orgId });
              setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
            }
          };
        }
        if (facSelect) facSelect.innerHTML = `<option value="">-- Select Facility --</option>`;
      } else {
        if (orgSelect) orgSelect.closest(".form-group").style.display = "none";
        const facs = await loadFacilitiesLite();
        if (facSelect) setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      }
    } catch (err) {
      console.error("❌ Failed to load assignments:", err);
      showToast("❌ Failed to load reference lists");
    }
  }
  await loadAssignments();

  // 🔎 Suggestion input: Mother (Patient)
  const motherInput = document.getElementById("motherInput");
  const motherSuggestions = document.getElementById("motherSuggestions");
  const motherHidden = document.getElementById("motherId");

  if (motherInput && motherSuggestions && motherHidden) {
    setupSuggestionInputDynamic(
      motherInput,
      motherSuggestions,
      "/api/lite/patients",
      (selected) => {
        motherHidden.value = selected?.id || "";
        if (selected) {
          motherInput.value =
            selected.label ||
            (selected.pat_no && selected.full_name
              ? `${selected.pat_no} - ${selected.full_name}`
              : selected.full_name || selected.pat_no || "");
        }

        // 🔹 When mother is selected, load her deliveries
        loadDeliveriesForMother(selected?.id);
      },
      "label"
    );
  }

  // 🔎 Prefill if editing
  if (isEdit) {
    let entry = null;
    try {
      const raw = sessionStorage.getItem("newbornRecordEditPayload");
      if (raw) entry = JSON.parse(raw);

      if (!entry) {
        showLoading();
        const res = await authFetch(`/api/newborn-records/${recordId}`);
        entry = (await res.json())?.data;
        if (!res.ok || !entry) throw new Error("❌ Failed to load newborn record");
      }

      console.log("🟡 [Newborn Prefill] Loaded entry:", entry);

      [
        "gender",
        "birth_weight",
        "birth_length",
        "head_circumference",
        "apgar_score_1min",
        "apgar_score_5min",
        "measurement_notes",
        "complications",
        "notes",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = entry[id] || "";
      });

      // IDs
      const orgId = entry.organization_id || entry.organization?.id;
      const facId = entry.facility_id || entry.facility?.id;

      if (orgId && orgSelect) {
        const orgs = await loadOrganizationsLite();
        setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");
        orgSelect.value = orgId;
      }

      if (facId && facSelect) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {});
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
        facSelect.value = facId;
      }

      // Prefill mother
      if (motherInput && entry.mother) {
        motherInput.value = `${entry.mother.pat_no} – ${entry.mother.first_name} ${entry.mother.last_name}`;
        motherHidden.value = entry.mother.id;

        // 🔹 Prefill deliveries for this mother
        if (entry.deliveryRecord) {
          await loadDeliveriesForMother(entry.mother.id, entry.deliveryRecord.id);
        }
      }
    } catch (err) {
      console.error("❌ Prefill error:", err);
      showToast(err.message || "❌ Could not load newborn record");
    } finally {
      hideLoading();
    }
  }

  // 🚀 Submit handler
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    if (!validateNewbornForm(form)) {
      return;
    }

    const url = isEdit ? `/api/newborn-records/${recordId}` : `/api/newborn-records`;
    const method = isEdit ? "PUT" : "POST";

    // 🔑 Convert form data to plain object
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      showLoading();
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      if (isEdit) {
        showToast("✅ Newborn record updated successfully");
        sessionStorage.removeItem("newbornRecordEditId");
        sessionStorage.removeItem("newbornRecordEditPayload");
        window.location.href = "/newborn-records-list.html";
      } else {
        showToast("✅ Newborn record added successfully");
        form.reset();
        setAddModeUI();
      }
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  // 🚪 Clear button
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("newbornRecordEditId");
    sessionStorage.removeItem("newbornRecordEditPayload");
    form.reset();
    setAddModeUI();
  });

  // 🚪 Cancel button
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("newbornRecordEditId");
    sessionStorage.removeItem("newbornRecordEditPayload");
    window.location.href = "/newborn-records-list.html";
  });
}
