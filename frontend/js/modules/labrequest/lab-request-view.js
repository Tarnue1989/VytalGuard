// ============================================================
// 🧾 Lab Request – View Page (Read-Only, Professional)
// Shows:
//  - Lab Request details
//  - Requested lab tests
//  - Lab results (status-based, TABLE VIEW)
// ============================================================

import { authFetch } from "../../authSession.js";
import { showToast, showLoading, hideLoading } from "../../utils/index.js";

/* ============================================================
   🔎 Read ID from URL
============================================================ */
const params = new URLSearchParams(window.location.search);
const labRequestId = params.get("id");

if (!labRequestId) {
  showToast("❌ Missing lab request ID");
  throw new Error("Missing lab request ID in URL");
}

/* ============================================================
   🧩 DOM References (must exist in HTML)
============================================================ */
const backBtnEl = document.getElementById("backBtn");
const statusBadgeEl = document.getElementById("requestStatus");
const requestInfoEl = document.getElementById("requestInfo");
const testsListEl = document.getElementById("testsList");
const resultsSectionEl = document.getElementById("resultsSection");
const resultsContainerEl = document.getElementById("resultsContainer");

/* ============================================================
   🔙 Back Navigation (JS ONLY, SAFE)
============================================================ */
function handleBackNavigation() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    // 🔁 Fallback route (CHANGE if your list page differs)
    window.location.href = "/lab-requests-list.html";
  }
}

if (backBtnEl) {
  backBtnEl.addEventListener("click", handleBackNavigation);
}

/* ============================================================
   🎨 Helpers
============================================================ */
function renderStatusBadge(status) {
  const map = {
    draft: "secondary",
    pending: "info",
    in_progress: "warning",
    completed: "primary",
    verified: "success",
    cancelled: "danger",
    voided: "dark",
  };
  const color = map[status] || "secondary";
  return `<span class="badge bg-${color}">${status}</span>`;
}

function safe(value) {
  return value ?? "—";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ============================================================
   📦 Load Lab Request + Results
============================================================ */
async function loadLabRequestView() {
  try {
    showLoading();

    /* ---------------------------
       1️⃣ Load Lab Request
    --------------------------- */
    const reqRes = await authFetch(`/api/lab-requests/${labRequestId}`);
    const reqJson = await reqRes.json();
    const request = reqJson?.data;

    if (!request) {
      showToast("❌ Lab request not found");
      return;
    }

    // Status badge
    statusBadgeEl.innerHTML = renderStatusBadge(request.status);

    // Patient + request info
    requestInfoEl.innerHTML = `
      <div class="info-item">
        <span>Patient</span>
        <div>${safe(request.patient_label)}</div>
      </div>
      <div class="info-item">
        <span>Doctor</span>
        <div>${safe(request.doctor_label)}</div>
      </div>
      <div class="info-item">
        <span>Department</span>
        <div>${safe(request.department?.name)}</div>
      </div>
      <div class="info-item">
        <span>Request Date</span>
        <div>${formatDate(request.request_date)}</div>
      </div>
      <div class="info-item">
        <span>Status</span>
        <div>${safe(request.status)}</div>
      </div>
      <div class="info-item">
        <span>Emergency</span>
        <div>${request.is_emergency ? "Yes" : "No"}</div>
      </div>
    `;

    /* ---------------------------
       2️⃣ Requested Lab Tests
    --------------------------- */
    const items = Array.isArray(request.items) ? request.items : [];
    testsListEl.innerHTML = items.length
      ? items
          .map(
            (i) =>
              `<li>${safe(i.labTest?.name || i.test || "Lab Test")}</li>`
          )
          .join("")
      : `<li class="text-muted">No lab tests</li>`;

    /* ---------------------------
       3️⃣ Lab Results (TABLE)
    --------------------------- */
    if (["completed", "verified"].includes(request.status)) {
      const resRes = await authFetch(
        `/api/lab-results?lab_request_id=${labRequestId}`
      );
      const resJson = await resRes.json();
      const results = Array.isArray(resJson?.data?.records)
        ? resJson.data.records
        : [];

      resultsSectionEl.classList.remove("d-none");

      resultsContainerEl.innerHTML = results.length
        ? results
            .map((r) => {
              const resultText = safe(r.result);
              const resultLower = String(resultText).toLowerCase();

              let resultClass = "";
              if (["pos", "positive"].includes(resultLower)) {
                resultClass = "text-danger fw-bold";
              } else if (["neg", "negative"].includes(resultLower)) {
                resultClass = "text-success fw-bold";
              }

              return `
                <tr>
                  <td>${safe(r.labRequestItem?.labTest?.name || "Lab Test")}</td>
                  <td class="${resultClass}">${resultText}</td>
                  <td>${safe(r.status)}</td>
                  <td>
                    ${
                      r.verifiedBy
                        ? `${safe(r.verifiedBy.first_name)} ${safe(
                            r.verifiedBy.last_name
                          )}`
                        : "—"
                    }
                  </td>
                </tr>
              `;
            })
            .join("")
        : `
          <tr>
            <td colspan="4" class="text-muted text-center">
              No lab results recorded.
            </td>
          </tr>
        `;
    } else {
      resultsSectionEl.classList.add("d-none");
    }
  } catch (err) {
    console.error("❌ Failed to load lab request view:", err);
    showToast("❌ Failed to load lab request");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🚀 Init
============================================================ */
loadLabRequestView();
