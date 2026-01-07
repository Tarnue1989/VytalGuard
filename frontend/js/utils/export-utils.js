// 📁 export-utils.js – Enterprise Export (CSV, Excel, PDF)
// Requires: 
//   npm install xlsx
//   <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>

import { showToast } from "./toast-utils.js";
import { getOrgInfo } from "../modules/shared/org-config.js"; // ⬅️ centralized org info
const XLSX = window.XLSX;

/* ============================================================================
   🔄 Flatten Nested Objects
============================================================================ */
function flattenObject(obj, parentKey = "", res = {}) {
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const newKey = parentKey ? `${parentKey}.${key}` : key;
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      flattenObject(val, newKey, res);
    } else {
      res[newKey] = val instanceof Date ? val.toISOString() : val;
    }
  }
  return res;
}

/* ============================================================================
   🏥 Letterhead Builder
============================================================================ */
function buildLetterhead(orgInfo, title) {
  const now = new Date().toLocaleString();
  return {
    // For CSV/Excel
    textBlock: [
      orgInfo?.name || "Organization Name",
      orgInfo?.address || "Address not set",
      orgInfo?.contact || "Contact not set",
      orgInfo?.website || "",
      `Report: ${title}`,
      `Generated At: ${now}`,
      "",
    ],
    // For PDF
    htmlBlock: `
      <div style="font-family: Arial, sans-serif; padding:10px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding-bottom:5px; margin-bottom:10px;">
          <div>
            <h2 style="margin:0; font-size:18px;">${orgInfo?.name || "Organization Name"}</h2>
            <p style="margin:0; font-size:11px;">${orgInfo?.address || ""}</p>
            <p style="margin:0; font-size:11px;">${orgInfo?.contact || ""}</p>
            <p style="margin:0; font-size:11px;">${orgInfo?.website || ""}</p>
          </div>
          ${orgInfo?.logo
            ? `<div><img src="${orgInfo.logo}" alt="Logo" style="height:50px; margin-left:10px;"></div>`
            : ""}
        </div>
        <h3 style="text-align:center; margin:5px 0 10px 0; font-size:16px;">${title}</h3>
      </div>
    `
  };
}

/* ============================================================================
   🚀 Unified Export Function
============================================================================ */
export async function exportData({ type, data, title, orgInfo, selector, orientation }) {
  // ⬅️ If orgInfo not passed, load from config
  const orgMeta = orgInfo || getOrgInfo();

  if (!data?.length && type !== "pdf") {
    return showToast?.("❌ No data to export");
  }

  const { textBlock, htmlBlock } = buildLetterhead(orgMeta, title);

  switch (type) {
    /* -------------------- CSV -------------------- */
    case "csv": {
      const flatData = data.map((row) => flattenObject(row));
      const headers = Object.keys(flatData[0] || {});
      const csvRows = flatData.map((row) =>
        headers.map((f) => JSON.stringify(row[f] ?? "")).join(",")
      );
      const csvContent = `${textBlock.join("\n")}\n${headers.join(",")}\n${csvRows.join("\n")}`;

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `${title}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return showToast?.(`✅ CSV exported: ${title}.csv`);
    }

    /* -------------------- Excel -------------------- */
    case "xlsx": {
      const flatData = data.map((row) => flattenObject(row));
      const worksheet = XLSX.utils.json_to_sheet(flatData);

      // Auto column width
      const colWidths = Object.keys(flatData[0] || {}).map((k) => ({
        wch: Math.max(10, k.length + 2),
      }));
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();

      // Letterhead sheet
      const metaSheet = XLSX.utils.aoa_to_sheet(textBlock.map((l) => [l]));
      XLSX.utils.book_append_sheet(workbook, metaSheet, "Letterhead");

      // Records sheet
      XLSX.utils.book_append_sheet(workbook, worksheet, "Records");

      XLSX.writeFile(workbook, `${title}.xlsx`);
      return showToast?.(`✅ Excel exported: ${title}.xlsx`);
    }

    /* -------------------- PDF -------------------- */
    case "pdf": {
      if (!window.html2pdf) {
        return showToast?.("❌ html2pdf.js not loaded");
      }
      const element = document.querySelector(selector || ".table-container");
      if (!element) return showToast?.("❌ Section not found");

      // Auto or manual orientation
      let finalOrientation = orientation;
      if (!finalOrientation) {
        const rect = element.getBoundingClientRect();
        finalOrientation = rect.width > rect.height ? "landscape" : "portrait";
      }

      const wrappedHtml = `
        ${htmlBlock}
        ${element.outerHTML}
      `;

      const opt = {
        margin: 0.5,
        filename: `${title}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "a4", orientation: finalOrientation },
      };

      return window.html2pdf()
        .set(opt)
        .from(wrappedHtml)
        .toPdf()
        .get("pdf")
        .then(function (pdf) {
          const pageCount = pdf.internal.getNumberOfPages();
          const footerText = `Generated by VytalGuard HMS – ${new Date().toLocaleString()}`;
          pdf.setFontSize(8);
          pdf.setTextColor(100);

          for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageWidth = pdf.internal.pageSize.getWidth();

            // Center footer
            pdf.text(
              footerText,
              pageWidth / 2,
              pageHeight - 10,
              { align: "center" }
            );
          }
        })
        .save();
    }

    default:
      return showToast?.("❌ Invalid export type");
  }
}

/* ============================================================================
   🔙 Legacy Wrappers (for backward compatibility)
============================================================================ */
export function exportToExcel(data, filename = "ExportedData") {
  return exportData({
    type: "xlsx",
    data,
    title: filename,
  });
}

export function exportToPDF(title = "Export", selector = ".table-container", orientation) {
  return exportData({
    type: "pdf",
    title,
    data: [], // not needed for pdf
    selector,
    orientation,
  });
}
