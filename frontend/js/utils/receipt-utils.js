// 📁 frontend/js/utils/receipt-utils.js
// ============================================================================
// 🖨️ Unified Receipt Print Utility (Silent + Reliable)
// ----------------------------------------------------------------------------
// 🔹 Keeps your exact footer + layout intact
// 🔹 Fixes early print timing by waiting briefly for styles to load
// 🔹 No toasts, no alerts — pure silent behavior
// ============================================================================

import { getOrgInfo } from "../modules/shared/org-config.js";

export function printReceipt(title, bodyHTML, orgId) {
  const branding = getOrgInfo(orgId) || {};
  const basePath = window.location.origin + "/assets/css/";

  const win = window.open("", "_blank", "width=800,height=1000");
  if (!win) return; // popup blocked silently

  win.document.write(`
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>

        <!-- Load app CSS -->
        <link rel="stylesheet" href="${basePath}main.min.css">
        <link rel="stylesheet" href="${basePath}admin-global.css">
        <link rel="stylesheet" href="${basePath}layout.css">
        <link rel="stylesheet" href="${basePath}theme.css">
        <link rel="stylesheet" href="${basePath}utilities.css">
        <link rel="stylesheet" href="${basePath}print.css">

        <style>
          /* ✅ Header always visible */
          #receiptHeader {
            background: none !important;
            border-bottom: 1px solid #ccc;
            margin-bottom: 6px;
            padding-bottom: 4px;
          }
          #receiptHeader h2,
          #receiptHeader p,
          #receiptHeader small {
            color: #000 !important;
            margin: 0;
            line-height: 1.2;
          }
          #receiptHeader h2 { font-size: 18px; font-weight: bold; }
          #receiptHeader p { font-size: 13px; }
          #receiptHeader small { font-size: 11px; }

          /* ✅ Facility info */
          .facility-info {
            font-size: 12px;
            margin-bottom: 10px;
            color: #333;
          }

          /* ✅ Invoice + Patient Info Grid */
          .invoice-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 20px;
            margin-bottom: 12px;
            font-size: 12px;
          }
          .invoice-meta div { margin: 0; }

          /* ✅ Tables compact */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 4px 0;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 2px 5px;
            font-size: 12px;
            line-height: 1.2;
            color: #000 !important;
          }
          th {
            background: #f4f4f4 !important;
            font-weight: bold;
          }

          /* ✅ Section titles */
          h3.section-title, h5 {
            margin: 8px 0 4px 0;
            font-size: 13px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 2px;
            color: #000 !important;
          }

          /* ✅ Right-aligned Summary */
          .summary {
            display: flex;
            justify-content: flex-end;
            margin-top: 10px;
          }
          .summary table {
            width: auto;
            border: none;
          }
          .summary td {
            border: none;
            padding: 2px 6px;
            font-size: 12px;
            text-align: right;
          }
          .summary td.label {
            font-weight: bold;
          }

          /* ✅ Footer plain (unchanged) */
          #receiptFooter {
            background: none !important;
            color: #444 !important;
            font-size: 11px;
            margin-top: 15px;
            border-top: 1px solid #ccc;
            padding-top: 5px;
          }
        </style>
      </head>
      <body>
        <div id="receiptWrapper" class="container my-2">
          <header id="receiptHeader" class="d-flex justify-content-between align-items-start">
            ${branding.logo ? `<img src="${branding.logo}" alt="Logo" style="height:45px;">` : ""}
            <div class="text-end">
              <h2>${branding.letterhead || title}</h2>
              <p class="fw-bold">${branding.name || ""}</p>
              <small>${branding.address || ""} ${branding.phone ? "| " + branding.phone : ""}</small>
            </div>
          </header>

          ${bodyHTML}

          <footer id="receiptFooter" class="text-center">
            ${branding.footer || "This is a computer-generated receipt. No signature required."}
          </footer>
        </div>
      </body>
    </html>
  `);

  win.document.close();

  // ✅ Safe delayed print (prevents early execution)
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
      win.onafterprint = () => win.close();
    }, 400);
  };
}
