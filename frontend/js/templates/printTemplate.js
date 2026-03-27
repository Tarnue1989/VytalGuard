// 📁 printTemplate.js – FINAL (A4 + BASE64 + WATERMARK + CLEAN UI)

import { authFetch } from "../authSession.js";

/* ============================================================
   LOAD BRANDING
============================================================ */
async function loadBranding() {
  const res = await authFetch("/api/organization-branding");
  const json = await res.json();
  return json.data || {};
}

/* ============================================================
   RESOLVE IMAGE (FULL URL)
============================================================ */
function resolveImage(url) {
  if (!url) return "";

  const BASE_URL = window.location.origin;

  if (url.startsWith("http")) return url;

  if (url.startsWith("/uploads/")) {
    return BASE_URL + url;
  }

  return BASE_URL + "/uploads/" + url;
}

/* ============================================================
   🔥 CONVERT IMAGE TO BASE64
============================================================ */
async function toBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Logo load failed:", err);
    return "";
  }
}

/* ============================================================
   LETTERHEAD
============================================================ */
async function buildLetterhead(data) {
  let logoSrc = "";

  if (data?.logo_url) {
    const fullUrl = resolveImage(data.logo_url);
    logoSrc = await toBase64(fullUrl);
  }

  return `
    <div class="letterhead">

      ${
        logoSrc
          ? `<img src="${logoSrc}" />`
          : `<div style="color:red;">NO LOGO</div>`
      }

      <div class="info">
        <div class="org-name">${data.company_name || ""}</div>
        <div>${data.contact?.address || ""}</div>
        <div>${data.contact?.phone || ""}</div>
        <div>${data.contact?.email || ""}</div>
      </div>

    </div>
  `;
}

/* ============================================================
   FOOTER
============================================================ */
function buildFooter(data) {
  return `
    <div class="footer">
      ${data.letterhead_footer || ""}
    </div>
  `;
}

/* ============================================================
   MAIN TEMPLATE
============================================================ */
export async function renderPrintTemplate(contentHTML, options = {}) {
let branding = options.branding;

  // 🔥 SELF-HEALING BRANDING FIX
  if (!branding || !branding.logo_url) {
    try {
      const fresh = await loadBranding();

      if (fresh?.logo_url) {
        branding = fresh;

        // 🔥 SAVE FOR NEXT PRINT
        localStorage.setItem("branding", JSON.stringify(fresh));
      }
    } catch (e) {
      console.warn("Branding fallback failed");
    }
  }

  // Override org name
  if (options?.invoice?.organization?.name) {
    branding.company_name = options.invoice.organization.name;
  }

  const letterhead = await buildLetterhead(branding);

  /* 🔥 WATERMARK */
  const watermark =
    options?.invoice?.status?.toLowerCase() === "paid"
      ? "PAID"
      : options?.invoice?.status?.toLowerCase() === "unpaid"
      ? "UNPAID"
      : "";

  const html = `
    <html>
      <head>
        <title>${options.title || "Document"}</title>

        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #000;
            font-size: 13px;
            position: relative;
          }

          /* 🔥 WATERMARK */
          body::after {
            content: "${watermark}";
            position: fixed;
            top: 40%;
            left: 25%;
            font-size: 80px;
            color: rgba(0,0,0,0.05);
            transform: rotate(-30deg);
            pointer-events: none;
          }

          .letterhead {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 14px;
            border-bottom: 2px solid #0f62fe;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }

          .letterhead img {
            max-height: 80px;
          }

          .org-name {
            font-weight: 600;
            font-size: 18px;
          }

          .info {
            font-size: 12px;
          }

          h1.title {
            text-align: center;
            margin: 10px 0 20px;
            font-size: 20px;
          }

          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 15px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }

          table th, table td {
            border: 1px solid #ddd;
            padding: 6px;
            font-size: 12px;
          }

          table th {
            background: #f5f5f5;
          }

          .totals {
            margin-top: 15px;
            width: 300px;
            margin-left: auto;
          }

          .totals div {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }

          .totals .final {
            font-weight: bold;
            border-top: 1px solid #000;
            padding-top: 5px;
          }

          .footer {
            margin-top: 30px;
            font-size: 11px;
            text-align: center;
            border-top: 1px solid #ccc;
            padding-top: 6px;
          }

          @media print {
            body {
              margin: 0;
              padding: 20px;
            }
          }
        </style>
      </head>

      <body>

        ${letterhead}

        <h1 class="title">${options.title || "Document"}</h1>

        ${contentHTML}

        ${buildFooter(branding)}

      </body>
    </html>
  `;

  return html;
}

/* ============================================================
   PRINT
============================================================ */
export async function printDocument(contentHTML, options = {}) {
  const html = await renderPrintTemplate(contentHTML, options);

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();

  win.focus();
  win.print();
}