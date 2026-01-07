// ============================================================================
// ⚙️ VytalGuard – Report Actions (Unified Master Pattern)
// Handles filter toggle, unified export buttons, and table utilities
// ============================================================================

import { showToast } from "../../utils/index.js";
import { initTooltips } from "../../utils/ui-utils.js";
import { exportData } from "../../utils/export-utils.js"; // ✅ unified enterprise export

// -----------------------------------------------------------------------------
// 📦 Initialization
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTooltips();
  bindFilterToggle();
  bindExportButtons();
});

// -----------------------------------------------------------------------------
// 🎚️ Filter Collapse Toggle (Show / Hide Filters)
// -----------------------------------------------------------------------------
function bindFilterToggle() {
  const btn = document.getElementById("toggleFilterBtn");
  const body = document.getElementById("filterCollapse");
  const icon = document.getElementById("filterChevron");

  if (!btn || !body) return;

  btn.addEventListener("click", () => {
    const isHidden = body.classList.toggle("hidden");
    icon.classList.toggle("fa-chevron-down", isHidden);
    icon.classList.toggle("fa-chevron-up", !isHidden);
  });
}

// -----------------------------------------------------------------------------
// 📤 Export Handlers (Unified Enterprise Export)
// -----------------------------------------------------------------------------
function bindExportButtons() {
  const tableSelector = ".print-table";
  const moduleInput = document.getElementById("moduleTypeInput");

  // 🏷️ Dynamic export title (e.g., "Consultation Report")
  const getExportTitle = () => {
    const raw = moduleInput?.value?.trim() || "Enterprise Report";
    return raw
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/_/g, " ")
      .trim() + " Report";
  };

  // 🧩 Table to JSON converter
  const extractTableData = (selector) => {
    const table = document.querySelector(selector);
    if (!table) return [];

    const headers = Array.from(table.querySelectorAll("thead th")).map((h) =>
      h.textContent.trim()
    );
    const rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td"));
      const record = {};
      cells.forEach((td, i) => {
        record[headers[i] || `Column ${i + 1}`] = td.textContent.trim();
      });
      return record;
    });
    return rows;
  };

  // ---------------------------------------------------------------------------
  // CSV Export
  // ---------------------------------------------------------------------------
  document.getElementById("exportCSVBtn")?.addEventListener("click", async () => {
    const rows = extractTableData(tableSelector);
    await exportData({
      type: "csv",
      title: getExportTitle(),
      data: rows,
    });
  });

  // ---------------------------------------------------------------------------
  // Excel Export
  // ---------------------------------------------------------------------------
  document.getElementById("exportExcelBtn")?.addEventListener("click", async () => {
    const rows = extractTableData(tableSelector);
    await exportData({
      type: "xlsx",
      title: getExportTitle(),
      data: rows,
    });
  });

  // ---------------------------------------------------------------------------
  // PDF Export
  // ---------------------------------------------------------------------------
  document.getElementById("exportPDFBtn")?.addEventListener("click", async () => {
    await exportData({
      type: "pdf",
      title: getExportTitle(),
      selector: ".table-container",
    });
  });
}

// -----------------------------------------------------------------------------
// 🔁 Future Hooks (Pagination, Refresh, etc.)
// -----------------------------------------------------------------------------
export function refreshReportTable() {
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }
}
