// 📦 patientchartnote-form.js – Secure & Role-Aware Patient Chart Note Form (Inline + Standalone)

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
  loadPatientsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔧 Helpers
============================================================ */
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

/* ============================================================
   🚀 Setup Patient Chart Note Form
============================================================ */
export function openNoteFormModal({ patient_id, note = null, onSuccess }) {
  // Create modal container dynamically (reusable)
  let modalEl = document.getElementById("noteModal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "noteModal";
    modalEl.className = "modal fade";
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content rounded-3 shadow">
          <div class="modal-header">
            <h5 class="modal-title">${note ? "Edit Note" : "Add Note"}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="noteForm">
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label">Note Type <span class="text-danger">*</span></label>
                  <select id="noteTypeSelect" class="form-select" required>
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="admin">Admin</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Status</label>
                  <select id="noteStatusSelect" class="form-select">
                    <option value="draft">Draft</option>
                    <option value="verified">Verified</option>
                    <option value="voided">Voided</option>
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label">Content <span class="text-danger">*</span></label>
                  <textarea id="noteContent" class="form-control" rows="5" placeholder="Enter note details..." required></textarea>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">
                <i class="ri-save-3-line me-1"></i> Save Note
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  // Initialize Bootstrap modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  // Pre-fill if editing
  if (note) {
    document.getElementById("noteTypeSelect").value = note.note_type || "doctor";
    document.getElementById("noteStatusSelect").value = note.status || "draft";
    document.getElementById("noteContent").value = note.content || "";
  }

  // 🔐 Auth
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const form = document.getElementById("noteForm");
  const isEdit = !!note;

  /* ============================================================
     💾 Submit Handler
  ============================================================ */
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return;

    const payload = {
      note_type: document.getElementById("noteTypeSelect").value,
      status: document.getElementById("noteStatusSelect").value,
      content: document.getElementById("noteContent").value.trim(),
    };

    if (!payload.content) return showToast("❌ Note content is required");

    try {
      showLoading();

      const url = isEdit
        ? `/api/patient-chart/notes/${note.id}`
        : `/api/patient-chart/patient/${patient_id}/notes`;
      const method = isEdit ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(isEdit ? "✅ Note updated successfully" : "✅ Note added successfully");
      modal.hide();
      form.reset();

      if (typeof onSuccess === "function") onSuccess();
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  // Clear modal on close
  modalEl.addEventListener("hidden.bs.modal", () => {
    form.reset();
  });
}

/* ============================================================
   🧠 Standalone Note Form Loader (optional)
============================================================ */
export async function setupPatientChartNoteForm({ form }) {
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  const queryParams = new URLSearchParams(window.location.search);
  const patient_id = queryParams.get("patient_id");

  if (!patient_id) return showToast("❌ Missing patient ID");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const content = document.getElementById("noteContent").value.trim();
    const note_type = document.getElementById("noteTypeSelect").value || "doctor";
    const status = document.getElementById("noteStatusSelect").value || "draft";
    if (!content) return showToast("❌ Note content required");

    try {
      showLoading();
      const res = await authFetch(`/api/patient-chart/patient/${patient_id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, note_type, status }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast("✅ Note created successfully");
      form.reset();
    } catch (err) {
      console.error("❌ Submission error:", err);
      showToast(err.message || "❌ Failed to save note");
    } finally {
      hideLoading();
    }
  };
}
