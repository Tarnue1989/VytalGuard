// 📁 frontend/js/utils/receipt-utils.js
// ============================================================================
// 🖨️ Unified Receipt Print Utility (Enterprise-Grade | FINAL)
// ----------------------------------------------------------------------------
// ✔ Silent (no alerts, no toasts)
// ✔ Print-safe (delayed rendering)
// ✔ CSS isolated (receipt-print.css)
// ✔ Neutral, audit-compliant layout
// ✔ Reusable across all receipt types
// ============================================================================

import { getOrgInfo } from "../modules/shared/org-config.js";

export function printReceipt(title, bodyHTML, orgId) {
  const branding = getOrgInfo(orgId) || {};
  const basePath = window.location.origin + "/assets/css/";

  const win = window.open("", "_blank", "width=820,height=1050");
  if (!win) return; // popup blocked — enterprise-safe

  win.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>

        <!-- Core App Styles -->
        <link rel="stylesheet" href="${basePath}main.min.css">
        <link rel="stylesheet" href="${basePath}admin-global.css">
        <link rel="stylesheet" href="${basePath}layout.css">
        <link rel="stylesheet" href="${basePath}utilities.css">
        <link rel="stylesheet" href="${basePath}print.css">

        <!-- Receipt Styles -->
        <link rel="stylesheet" href="${basePath}receipt-print.css">
      </head>

      <body>
        <div id="receiptWrapper" class="container my-2">

          <!-- HEADER -->
          <header id="receiptHeader" class="d-flex justify-content-between align-items-start">
            ${
              branding.logo
                ? `<img src="${branding.logo}" alt="Logo" style="height:45px;">`
                : ""
            }
            <div class="text-end">
              <h2>${branding.letterhead || title}</h2>
              <p>${branding.name || ""}</p>
              <small>
                ${branding.address || ""}
                ${branding.phone ? " | " + branding.phone : ""}
              </small>
            </div>
          </header>

          <!-- BODY -->
          ${bodyHTML}

          <!-- FOOTER -->
          <footer id="receiptFooter">
            ${
              branding.footer ||
              "This is a computer-generated receipt. No signature required."
            }
          </footer>

        </div>
      </body>
    </html>
  `);

  win.document.close();

  // ✅ Delay print to ensure CSS is fully applied
  win.onload = () => {
    setTimeout(() => {
      win.focus();
      win.print();
      win.onafterprint = () => win.close();
    }, 400);
  };
}
