// 📘 patientchart-print.js – Optimized Continuous Flow Edition
// ------------------------------------------------------------
// ✅ Continuous content (no hard page breaks)
// ✅ Fixed footer on each page
// ✅ Auto page numbering (Page X of Y)
// ------------------------------------------------------------

import { formatDate, formatDateTime } from "../../utils/ui-utils.js";
import { safeText } from "../../utils/render-utils.js";

export function printPatientChart(chart = {}) {
  if (!chart || !chart.patient) {
    alert("❌ Patient chart data is missing");
    return;
  }

  const snapshot = chart.chart_snapshot || {};
  const data = { ...chart, ...snapshot };

  const p = data.patient || {};
  const org = data.organization || {};
  const fac = data.facility || {};
  const doctor = data.attending_physician || {};
  const printedBy = data.printed_by || {};
  const visits = data.visits || [];
  const timeline = data.timeline || [];
  const printDate = formatDateTime(new Date());

  const printWindow = window.open("", "_blank");

  /* ============================================================
     🏥 HEADER
  ============================================================ */
  const header = `
    <header style="border-bottom:2px solid #333; padding-bottom:5px; margin-bottom:15px; text-align:center;">
      <h2 style="margin:0;">${safeText(fac.name || org.name || "Health Facility")}</h2>
      ${
        fac.address || fac.phone || fac.email
          ? `<p style="margin:2px 0; font-size:12px; color:#333;">
               ${safeText(fac.address || "")}${fac.phone ? " | " + safeText(fac.phone) : ""}${
              fac.email ? " | " + safeText(fac.email) : ""
            }
             </p>`
          : ""
      }
      <small style="color:#666;">Printed on ${printDate}</small>
    </header>
  `;

  /* ============================================================
     👤 PATIENT INFO
  ============================================================ */
  const patientBlock = `
    <section>
      <h3 style="background:#f5f5f5; padding:4px; border:1px solid #ccc; text-transform:uppercase;">Patient Information</h3>
      <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:5px;">
        <tr><td style="width:30%;"><strong>Name:</strong></td><td>${safeText(p.full_name)}</td>
            <td><strong>Gender:</strong></td><td>${safeText(p.gender || "—")}</td></tr>
        <tr><td><strong>Date of Birth:</strong></td><td>${p.date_of_birth ? formatDate(p.date_of_birth) : "—"}</td>
            <td><strong>Age:</strong></td><td>${safeText(p.age || "—")}</td></tr>
        <tr><td><strong>Patient ID / MRN:</strong></td><td>${safeText(p.pat_no || p.id)}</td>
            <td><strong>Insurance #:</strong></td><td>${safeText(p.insurance_number || "—")}</td></tr>
        <tr><td><strong>Organization:</strong></td><td>${safeText(org.name || "—")}</td>
            <td><strong>Facility:</strong></td><td>${safeText(fac.name || "—")}</td></tr>
        <tr><td><strong>Address:</strong></td><td>${safeText(p.home_address || "—")}</td>
            <td><strong>Phone:</strong></td><td>${safeText(p.phone_number || "—")}</td></tr>
        ${
          doctor?.full_name
            ? `<tr><td><strong>Attending Physician:</strong></td><td colspan="3">${safeText(
                doctor.full_name
              )}${doctor.specialty ? " (" + safeText(doctor.specialty) + ")" : ""}</td></tr>`
            : ""
        }
      </table>
    </section>
  `;

  /* ============================================================
     🩺 VISIT SUMMARIES
  ============================================================ */
  const visitBlocks = visits.length
    ? visits
        .map((v, i) => {
          const vitals = renderVisitVitals(v.vitals);
          const labs = renderVisitLabs(v.labs);
          const notes = renderVisitNotes(v.notes);
          const doctorName =
            typeof v.doctor === "object" ? v.doctor?.full_name : v.doctor || "—";
          return `
          <div class="record-card">
            <h4 style="margin:0 0 5px; color:#2b5aa3;">Visit ${i + 1} – ${formatDateTime(v.date)}</h4>
            <p><strong>Doctor:</strong> ${safeText(doctorName)}</p>
            <p><strong>Diagnosis:</strong> ${safeText(v.diagnosis || "—")}</p>
            <p><strong>Treatment:</strong> ${safeText(v.treatment || "—")}</p>
            ${vitals}${labs}${notes}
          </div>`;
        })
        .join("")
    : `<p style="font-style:italic; color:#777;">No recorded visits.</p>`;

  const visitSection = `
    <section>
      <h3 style="background:#f5f5f5; padding:4px; border:1px solid #ccc; text-transform:uppercase;">Visit Summaries</h3>
      ${visitBlocks}
    </section>
  `;

  /* ============================================================
     🔬 OTHER CLINICAL SECTIONS
  ============================================================ */
  const labsSection = data.labs?.length
    ? renderListSection("Lab Results", data.labs, (l) =>
        `${safeText(l.department?.name || l.test_name || "—")}: ${safeText(
          l.result || "Pending"
        )} ${l.status ? "(" + safeText(l.status) + ")" : ""}`
      )
    : "";

  const vitalsSection = data.vitals?.length
    ? renderListSection("Vital Signs", data.vitals, (v) =>
        `${formatDateTime(v.recorded_at)} — BP ${
          v.bp || `${v.systolic || ""}/${v.diastolic || ""}`
        }, HR ${v.pulse || "—"}, Temp ${v.temperature || "—"}°C, SpO₂ ${
          v.spo2 || "—"
        }%`
      )
    : "";

  const ultrasoundSection = data.ultrasounds?.length
    ? renderListSection("Ultrasound Records", data.ultrasounds, (u) =>
        `${formatDate(u.scan_date)} — ${safeText(u.findings || "No findings")}`
      )
    : "";

  const deliveriesSection = data.deliveries?.length
    ? renderListSection("Delivery Records", data.deliveries, (d) =>
        `${formatDate(d.delivery_date)} — ${safeText(
          d.delivery_type || "Delivery"
        )} | Outcome: ${safeText(d.outcome || "—")}`
      )
    : "";

  const medsSection = data.medications?.length
    ? renderListSection("Medications", data.medications, (m) =>
        `${safeText(m.drug_name)} ${safeText(m.dosage || "")} ${
          m.frequency ? "(" + safeText(m.frequency) + ")" : ""
        }`
      )
    : "";

  const timelineSection = timeline.length
    ? renderListSection(
        "Chronological Timeline",
        timeline,
        (t) =>
          `${formatDateTime(t.date)} – <em>${safeText(t.type)}</em>: ${safeText(
            t.summary || "No details"
          )}`
      )
    : "";

  /* ============================================================
     🖋️ FOOTER WITH PAGE NUMBER
  ============================================================ */
  const footer = `
    <footer class="print-footer">
      <div class="footer-content">
        <span><strong>Printed by:</strong> ${safeText(printedBy.full_name || "—")}</span>
        &nbsp; | &nbsp;
        <span><strong>Role:</strong> ${safeText(printedBy.role || "—")}</span>
        &nbsp; | &nbsp;
        <span><strong>Date:</strong> ${formatDateTime(data.printed_at || new Date())}</span>
        <span class="page-number"></span>
      </div>
      <div style="text-align:center; margin-top:2px; color:#555;">
        <small>© ${new Date().getFullYear()} ${safeText(org.name || fac.name || "VytalGuard Health System")}</small>
      </div>
    </footer>
  `;

  /* ============================================================
     ✨ FINAL PRINT DOCUMENT
  ============================================================ */
  printWindow.document.write(`
    <html>
      <head>
        <title>Patient Chart – ${safeText(p.full_name)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color:#000; background:#fff; }
          table td { padding: 3px 5px; vertical-align: top; }
          h3 { margin-top:20px; font-size:14px; color:#222; }
          ul { margin:5px 0; padding-left:15px; }
          
          @media print {
            html, body {
              margin: 0;
              padding: 0;
              height: auto;
              counter-reset: page 0;
            }

            section {
              page-break-inside: avoid;
              margin-bottom: 10px;
            }

            .record-card {
              page-break-inside: avoid;
              break-inside: avoid;
              border: 1px solid #ddd;
              border-radius: 6px;
              padding: 8px;
              margin-bottom: 8px;
            }

            footer.print-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              height: 45px;
              font-size: 11px;
              color: #555;
              border-top: 1px solid #ccc;
              background: #fff;
              padding: 4px 15px;
            }

            /* reserve bottom space so footer never overlaps */
            body::after {
              content: "";
              display: block;
              height: 55px;
            }

            /* ✅ working page numbering */
            .page-number::after {
              counter-increment: page;
              content: " | Page " counter(page) " of " counter(pages);
              float: right;
              color: #666;
            }

            @page {
              size: A4 portrait;
              margin: 0.8in 0.7in 0.9in 0.7in;
              counter-reset: page 0;
            }
          }

        </style>
      </head>
      <body>
        ${header}
        ${patientBlock}
        ${visitSection}
        ${labsSection}
        ${vitalsSection}
        ${ultrasoundSection}
        ${deliveriesSection}
        ${medsSection}
        ${timelineSection}
        ${footer}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 1500);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

/* ============================================================
   🔧 SHARED HELPERS
============================================================ */
function renderListSection(title, items, mapFn) {
  return `
    <section>
      <h3 style="background:#f5f5f5; padding:4px; border:1px solid #ccc; text-transform:uppercase;">${safeText(title)}</h3>
      <ul style="font-size:13px;">
        ${items.map(mapFn).map((li) => `<li>${li}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderVisitVitals(vitals = []) {
  if (!vitals?.length) return "";
  const v = vitals[0];
  return `
    <div style="margin-top:8px;">
      <strong>Vitals:</strong>
      <ul style="margin:2px 0 6px 15px; font-size:13px;">
        <li>BP: ${safeText(v.bp || `${v.systolic || ""}/${v.diastolic || ""}` || "—")}</li>
        <li>Pulse: ${safeText(v.pulse || "—")} bpm</li>
        <li>Temp: ${safeText(v.temperature || "—")} °C</li>
        <li>Resp Rate: ${safeText(v.resp_rate || "—")}</li>
        <li>O₂ Sat: ${safeText(v.spo2 || "—")}%</li>
      </ul>
    </div>
  `;
}

function renderVisitLabs(labs = []) {
  if (!labs?.length) return "";
  return `
    <div style="margin-top:8px;">
      <strong>Lab Results:</strong>
      <ul style="margin:2px 0 6px 15px; font-size:13px;">
        ${labs
          .map(
            (l) =>
              `<li>${safeText(l.test_name)}: ${safeText(l.result || "Pending")} ${
                l.status ? `(${safeText(l.status)})` : ""
              }</li>`
          )
          .join("")}
      </ul>
    </div>
  `;
}

function renderVisitNotes(notes = []) {
  if (!notes?.length) return "";
  return `
    <div style="margin-top:8px;">
      <strong>Notes:</strong>
      <ul style="margin:2px 0 6px 15px; font-size:13px;">
        ${notes
          .map(
            (n) =>
              `<li><em>${formatDateTime(n.created_at)}</em> – ${safeText(
                n.author_name || n.author?.full_name || "Staff"
              )}: ${safeText(n.content || n.note || "")}</li>`
          )
          .join("")}
      </ul>
    </div>
  `;
}
