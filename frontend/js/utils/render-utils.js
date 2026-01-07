// 📄 Pagination, Exporting, and Display Modals

import { showToast } from './toast-utils.js';

/**
 * Render pagination buttons dynamically.
 * @param {HTMLElement} container
 * @param {number} currentPage
 * @param {number} totalPages
 * @param {function} onPageClick
 */
// ============================================================
// 🔢 Pagination Renderer (Enterprise Standard)
// ============================================================
export function renderPaginationControls(
  container,
  currentPage,
  totalPages,
  onPageChange
) {
  if (!container) return;
  container.innerHTML = "";

  // Previous
  if (currentPage > 1) {
    const prev = document.createElement("button");
    prev.textContent = "Previous";
    prev.onclick = () => onPageChange(currentPage - 1);
    container.appendChild(prev);
  }

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;

    if (i === currentPage) {
      // ✅ THIS WAS MISSING — REQUIRED FOR CSS
      btn.classList.add("active");
      btn.setAttribute("aria-current", "page");
      btn.disabled = true;
    } else {
      btn.onclick = () => onPageChange(i);
    }

    container.appendChild(btn);
  }

  // Next
  if (currentPage < totalPages) {
    const next = document.createElement("button");
    next.textContent = "Next";
    next.onclick = () => onPageChange(currentPage + 1);
    container.appendChild(next);
  }
}


/**
 * Export a DOM element as a PDF using jsPDF + html2canvas.
 * @param {HTMLElement} element
 * @param {string} filename
 */
export async function exportElementToPDF(element, filename = "document.pdf") {
  const { jsPDF } = window.jspdf;

  try {
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const ratio = Math.min(pageWidth / imgProps.width, pageHeight / imgProps.height);

    const imgWidth = imgProps.width * ratio;
    const imgHeight = imgProps.height * ratio;

    pdf.addImage(imgData, "PNG", (pageWidth - imgWidth) / 2, 10, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (err) {
    console.error("❌ PDF export failed:", err);
    showToast("❌ Failed to export PDF.");
  }
}

/**
 * Export a table to CSV.
 * @param {string} tableId
 * @param {string} filename
 */
export function exportTableToCSV(tableId, filename = "export.csv") {
  const table = document.getElementById(tableId)?.closest("table");
  if (!table) return;

  const rows = Array.from(table.querySelectorAll("tr"));
  const csv = rows.map(row => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    return cells.map(cell =>
      `"${cell.innerText.replace(/"/g, '""')}"`
    ).join(",");
  }).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export an array of objects to Excel using SheetJS.
 * @param {Array} data
 * @param {string} filename
 */
export function exportToExcel(data, filename = "export.xlsx") {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, filename);
  } catch (err) {
    console.error("❌ Excel export failed:", err);
    showToast("❌ Failed to export Excel.");
  }
}

/**
 * Open a print dialog for a specific element by ID.
 * @param {string} elementId
 */
export function printElement(elementId) {
  const content = document.getElementById(elementId)?.innerHTML;
  if (!content) return;

  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>Print</title></head>
    <body style="font-family:Arial,sans-serif;">${content}</body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
  win.close();
}

/**
 * Opens a reusable view modal with title and HTML content.
 * @param {string} title
 * @param {string} contentHtml
 */
export function openViewModal(title = "Record Details", contentHtml = "—") {
  const viewModal = document.getElementById("viewModal");
  const viewDetailsBody = document.getElementById("viewDetailsBody");
  const heading = viewModal.querySelector("h2");
  const closeBtn = document.getElementById("closeViewModal");

  if (!viewModal || !viewDetailsBody || !heading || !closeBtn) return;

  heading.textContent = title;
  viewDetailsBody.innerHTML = contentHtml;
  viewModal.classList.remove("hidden");

  closeBtn.onclick = () => viewModal.classList.add("hidden");
}

/**
 * Safely render text (prevent null/undefined and sanitize HTML)
 * Used by all renderers (patientchart, centralstock, etc.)
 */
export function safeText(value) {
  if (value === null || value === undefined) return "—";
  return String(value)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim();
}
