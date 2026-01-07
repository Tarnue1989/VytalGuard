// export-utils.js – Excel/CSV and PDF export helpers

import { showToast } from './toast-utils.js';

/* ============================================================================
   ✅ Export to Excel or CSV File
   ---------------------------------------------------------------------------
   Converts an array of objects into a CSV string and triggers download.
   Fallbacks to empty string for missing fields.
   Uses showToast() if available for better UX.
============================================================================ */
export function exportToExcel(data, filename = "ExportedData") {
  if (!data || !data.length) {
    showToast?.("❌ No data to export");
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = data.map(row =>
    headers.map(field => JSON.stringify(row[field] ?? "")).join(",")
  );
  const csvContent = [headers.join(","), ...csvRows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ============================================================================
   📄 Export HTML Block to PDF
   ---------------------------------------------------------------------------
   Requires html2pdf.js in the page:
   <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
============================================================================ */
export function exportToPDF(title = "Export", selector = ".table-container", orientation) {
  const element = document.querySelector(selector);
  if (!element) return showToast("❌ Section not found");

  // Auto orientation if not specified
  if (!orientation) {
    const rect = element.getBoundingClientRect();
    orientation = rect.width > rect.height ? "landscape" : "portrait";
  }

  const opt = {
    margin: 0.5,
    filename: `${title.replace(/\s+/g, '_').toLowerCase()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      scrollY: 0,
      useCORS: true,
      windowWidth: document.body.scrollWidth
    },
    jsPDF: {
      unit: 'in',
      format: 'a4',
      orientation
    }
  };

  window.html2pdf().set(opt).from(element).save();
}
