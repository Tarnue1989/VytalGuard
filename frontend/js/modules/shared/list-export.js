// 📁 /js/modules/shared/list-export.js
// 🔄 Reusable binder for export buttons (Excel/CSV + PDF) across all modules

import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { showToast } from "../../utils/toast-utils.js";

/**
 * Bind export buttons for a given module list page
 * @param {Object} opts
 * @param {string} opts.csvBtn - Selector for CSV/Excel export button
 * @param {string} opts.pdfBtn - Selector for PDF export button
 * @param {string} opts.tableSelector - Table container (used for PDF export)
 * @param {string} opts.filename - Base filename for exported files
 * @param {Function} opts.getData - Function that returns the current visible dataset
 * @param {string} [opts.letterheadSelector] - Optional selector for custom letterhead
 */
export function bindListExport({
  csvBtn = "#exportCSVBtn",
  pdfBtn = "#exportPDFBtn",
  tableSelector = ".table-container",
  filename = "Export",
  getData,
  letterheadSelector
}) {
  // CSV / Excel export
  const csvEl = document.querySelector(csvBtn);
  if (csvEl) {
    csvEl.addEventListener("click", () => {
      try {
        const data = getData?.();
        if (!data || !data.length) {
          showToast("❌ No data to export");
          return;
        }
        exportToExcel(data, filename);
      } catch (err) {
        console.error("[Export CSV] Failed:", err);
        showToast("❌ Failed to export to Excel");
      }
    });
  }

  // PDF export
  const pdfEl = document.querySelector(pdfBtn);
  if (pdfEl) {
    pdfEl.addEventListener("click", () => {
      try {
        exportToPDF(filename, tableSelector, null, letterheadSelector);
      } catch (err) {
        console.error("[Export PDF] Failed:", err);
        showToast("❌ Failed to export to PDF");
      }
    });
  }
}
