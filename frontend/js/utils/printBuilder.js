import { printDocument } from "../templates/printTemplate.js";

/* ============================================================
   🏥 UNIVERSAL CONTENT BUILDER (HOSPITAL FORMAT - FINAL)
   ✔ No duplicate title
   ✔ Clean meta (Org + Facility)
   ✔ Professional table
   ✔ Right-aligned totals
============================================================ */
export function printReport({
  title = "Report",
  columns = [],
  rows = [],
  meta = {},
  totals = [],
  invoice = null,
  context = {},
}) {
  /* ============================================================
     TABLE BUILD
  ============================================================ */
  const tableHead = `
    <th style="padding:6px; border:1px solid #ddd; background:#f5f5f5; text-align:left;">
      S/N
    </th>
    ${columns
      .map(
        (c) =>
          `<th style="padding:6px; border:1px solid #ddd; background:#f5f5f5; text-align:left;">
            ${c.label}
          </th>`
      )
      .join("")}
  `;
  const tableRows = rows
    .map(
      (r, i) => `
        <tr>

          <!-- 🔥 S/N COLUMN -->
          <td style="padding:6px; border:1px solid #ddd;">
            ${i + 1}
          </td>

          ${columns
            .map(
              (c) => `
              <td style="padding:6px; border:1px solid #ddd;">
                ${r[c.key] ?? "—"}
              </td>`
            )
            .join("")}

        </tr>
    `)
    .join("");
  /* ============================================================
     FILTER BLOCK
  ============================================================ */
  const filterBlock = context?.filters
    ? Object.entries(context.filters)
        .filter(([_, v]) => v)
        .map(([k, v]) => `<div><strong>${k}:</strong> ${v}</div>`)
        .join("")
    : "";

  /* ============================================================
     TOTALS BLOCK (RIGHT ALIGNED)
  ============================================================ */
  const totalsBlock = totals.length
    ? `
    <div style="margin-top:20px; display:flex; justify-content:flex-end;">
      <div style="min-width:260px;">
        <div style="font-weight:bold; margin-bottom:8px;">Summary</div>

        ${totals
          .map(
            (t) => `
            <div style="
              display:flex;
              justify-content:space-between;
              padding:4px 0;
              ${t.final ? "font-weight:bold; border-top:1px solid #000;" : ""}
            ">
              <span>${t.label}</span>
              <span>${t.value}</span>
            </div>
          `
          )
          .join("")}

      </div>
    </div>
  `
    : "";

  /* ============================================================
     FINAL HTML STRUCTURE
  ============================================================ */
  const html = `

    <!-- 🔥 META + FILTERS -->
    <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:10px;">

      <div>
        <div><strong>Organization:</strong> ${meta?.Organization || "—"}</div>
        <div><strong>Facility:</strong> ${meta?.Facility || "—"}</div>
        <div><strong>Records:</strong> ${meta?.Records || 0}</div>

        <div style="margin-top:5px;"><strong>Filters:</strong></div>
        ${
          filterBlock
            ? filterBlock
            : `<div style="color:#777;">None</div>`
        }
      </div>

      <div style="text-align:right;">
        <div><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
      </div>

    </div>

    <hr style="margin:10px 0;">

    <!-- 🔥 TABLE -->
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead>
        <tr>${tableHead}</tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <!-- 🔥 TOTALS -->
    ${totalsBlock}

    <!-- 🔥 SIGNATURE SECTION -->
    <div style="
      margin-top:35px;
      display:flex;
      justify-content:space-around;
      text-align:center;
      font-size:12px;
    ">

      <div>
        <div style="border-top:1px solid #000; width:160px; margin:0 auto;"></div>
        <div style="margin-top:5px;">Prepared By</div>
      </div>

      <div>
        <div style="border-top:1px solid #000; width:160px; margin:0 auto;"></div>
        <div style="margin-top:5px;">Checked By</div>
      </div>

      <div>
        <div style="border-top:1px solid #000; width:160px; margin:0 auto;"></div>
        <div style="margin-top:5px;">Approved By</div>
      </div>

    </div>

    <!-- 🔥 PRINT INFO -->
    <div style="margin-top:25px; font-size:11px; color:#555;">
      <div><strong>Printed By:</strong> ${
        context?.printedBy || "System"
      }</div>
      <div><strong>Printed At:</strong> ${
        context?.printedAt || new Date().toLocaleString()
      }</div>
    </div>

  `;

  /* ============================================================
     PRINT
  ============================================================ */
  printDocument(html, {
    title,
    invoice,
  });
}