// 📁 patientchart-actions.js – Full Permission-Driven Action Handlers for Patient Charts
// ============================================================================
// 🔹 Enterprise Edition (aligned with consultation-actions.js / centralstock-actions.js)
// 🔹 Handles: View / Summary / Cache / Notes / Print
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";

// ✅ Render full per-visit chart (modal view)
import { renderCard as renderFullChartCard } from "./patientchart-view-render.js";

// ✅ Optional: Printing support (PDF or direct print view)
import { printPatientChart } from "./patientchart-print.js";

/**
 * Sets up action handlers for Patient Chart module (view, summary, cache, notes, print)
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("patientChartTableBody");
  const cardContainer = document.getElementById("patientChartList");

  // Cache latest entries globally for quick lookup
  window.latestPatientChartEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission Handling
  ============================================================ */
  function normalizePermissions(perms) {
    if (!perms) return [];
    if (typeof perms === "string") {
      try {
        return JSON.parse(perms);
      } catch {
        return perms.split(",").map((p) => p.trim());
      }
    }
    return Array.isArray(perms) ? perms : [];
  }

  const userPerms = new Set(normalizePermissions(user?.permissions || []));
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some((r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"));

  const hasPerm = (key) => isSuperAdmin || userPerms.has(key.trim().toLowerCase());

  /* ============================================================
     ⚙️ Handler Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestPatientChartEntries || entries || []).find(
        (x) => String(x.patient_id || x.id) === String(id)
      ) || null;

    // Fallback fetch if missing
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/patient-chart/patient/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Patient chart not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Patient chart data missing");
    const cls = btn.classList;

    // --- View full chart ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("patientcharts:view"))
        return showToast("⛔ You don't have permission to view charts");
      return handleView(entry);
    }

    // --- View summary ---
    if (cls.contains("summary-btn")) {
      if (!hasPerm("patientcharts:summary"))
        return showToast("⛔ You don't have permission to view summary");
      return handleSummary(entry);
    }

    // --- Refresh / Revalidate cache ---
    if (cls.contains("refresh-btn")) {
      if (!hasPerm("patientcharts:invalidate_cache"))
        return showToast("⛔ You don't have permission to refresh cache");
      return await handleCacheRevalidate(id);
    }

    // --- Delete cache entry (admin only) ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("patientcharts:invalidate_cache"))
        return showToast("⛔ You don't have permission to delete cache");
      return await handleCacheDelete(id);
    }

    // --- Open notes section ---
    if (cls.contains("notes-btn")) {
      if (!hasPerm("patientchart_notes:view"))
        return showToast("⛔ You don't have permission to view notes");
      return handleViewNotes(entry);
    }

    // --- Print chart ---
    if (cls.contains("print-btn")) {
      if (!hasPerm("patientcharts:view"))
        return showToast("⛔ You don't have permission to print charts");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     🩺 Core Handlers
  ============================================================ */

  // 🔍 View Full Chart (Tabbed)
  function handleView(entry) {
    const html = renderFullChartCard(entry, visibleFields, user);
    openViewModal("Patient Chart", html);

    // ✅ Optional client audit hook
    if (window.auditService?.logClientAction) {
      window.auditService.logClientAction({
        module: "patientchart",
        action: "view",
        entityId: entry.patient_id || entry.id,
        user,
      });
    }
  }

  // 📄 View Summary (Redirects to summary page)
  async function handleSummary(entry) {
    const patientId = entry.patient_id || entry.id;
    if (!patientId) return showToast("❌ No patient ID found for summary");

    // Save context for next page
    sessionStorage.setItem("selectedPatientChartId", patientId);

    // Redirect to summary page
    window.location.href = `/patientchart-summary.html?patient_id=${patientId}`;
  }

  // 🔁 Revalidate cache (auto-refresh + delay)
  async function handleCacheRevalidate(patientId) {
    const confirmed = await showConfirm("Revalidate this patient's chart cache?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/patient-chart/patient/${patientId}/cache/invalidate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to revalidate cache");

      showToast("✅ Cache revalidation triggered");

      // ⏳ short wait so backend refresh completes
      await new Promise((r) => setTimeout(r, 1000));

      // 🔁 reload list
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to revalidate cache");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete cache entry (invalidate)
  async function handleCacheDelete(patientId) {
    const confirmed = await showConfirm("Delete this patient's chart cache?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/patient-chart/patient/${patientId}/cache/invalidate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete chart cache");

      showToast("✅ Chart cache invalidated");
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete cache");
    } finally {
      hideLoading();
    }
  }

  // 🗒️ View Notes (redirect)
  function handleViewNotes(entry) {
    const id = entry.patient_id || entry.id;
    sessionStorage.setItem("patientChartId", id);
    window.location.href = `/pages/patientchartnote.html?patient_id=${id}`;
  }

  // 🖨️ Print chart
  async function handlePrint(entry) {
    try {
      showLoading();
      await printPatientChart(entry);
    } catch (err) {
      console.error(err);
      showToast("❌ Failed to print patient chart");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 Global Helpers & Window Bindings
  ============================================================ */
  const findEntry = (id) =>
    (window.latestPatientChartEntries || entries || []).find(
      (x) => String(x.patient_id || x.id) === String(id)
    );

  window.viewChart = (id) => {
    if (!hasPerm("patientcharts:view"))
      return showToast("⛔ No permission to view chart");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Chart not found for viewing");
  };

  window.viewSummary = (id) => {
    if (!hasPerm("patientcharts:summary"))
      return showToast("⛔ No permission to view summary");
    const entry = findEntry(id);
    if (entry) handleSummary(entry);
    else showToast("❌ Chart not found for summary");
  };

  window.refreshCache = async (id) => {
    if (!hasPerm("patientcharts:invalidate_cache"))
      return showToast("⛔ No permission to revalidate cache");
    await handleCacheRevalidate(id);
  };

  window.openNotes = (id) => {
    if (!hasPerm("patientchart_notes:view"))
      return showToast("⛔ No permission to view notes");
    const entry = findEntry(id);
    if (entry) handleViewNotes(entry);
  };

  window.printChart = (id) => {
    if (!hasPerm("patientcharts:view"))
      return showToast("⛔ No permission to print chart");
    const entry = findEntry(id);
    if (entry) handlePrint(entry);
  };
}
