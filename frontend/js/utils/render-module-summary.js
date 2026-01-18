import { formatSummaryObject } from "./summary-utils.js";

/**
 * ============================================================
 * 📊 MODULE SUMMARY RENDERER (GLOBAL | FUTURE-PROOF)
 * ------------------------------------------------------------
 * ✔ Currency vs count is explicit
 * ✔ Totals are clearly labeled
 * ✔ Object-safe (no [object Object])
 * ✔ Badge / pill compatible
 * ✔ Zero module-specific logic
 * ============================================================
 */
export function renderModuleSummary(
  summary = {},
  containerId = "moduleSummary",
  options = {}
) {
  const el = document.getElementById(containerId);
  if (!el || typeof summary !== "object") return;

  const {
    moduleLabel = "RECORDS", // appointments, deposits, invoices, etc.
  } = options;

  el.classList.add("module-summary");

  /* ================= STATUS → CLASS MAP ================= */
  const mapClass = (k) => {
    const key = k.toLowerCase();
    if (/success|approved|completed|active/.test(key)) return "summary--success";
    if (/pending|scheduled|progress/.test(key)) return "summary--warning";
    if (/cancelled|rejected|failed|no_show/.test(key)) return "summary--danger";
    if (/verified|finalized/.test(key)) return "summary--info";
    if (/voided|deleted/.test(key)) return "summary--muted";
    if (/total/.test(key)) return "summary--total";
    return "";
  };

  /* ================= VALUE FORMATTER ================= */
  const fmt = (k, v) => {
    if (v === null || v === undefined) return "—";

    // ✅ Object-safe summaries (gender_breakdown, status maps)
    if (typeof v === "object") {
      return formatSummaryObject(v, {
        separator: " / ",
        emptyValue: "—",
        transformKey: (x) => x.replace(/_/g, " ").toUpperCase(),
      });
    }

    const lower = k.toLowerCase();

    const isCurrency =
      /amount|balance|value|sum|applied|remaining/.test(lower);

    const isCount =
      /_count$|^count$|total$|total_count$/.test(lower);

    if (isCurrency && !isNaN(v)) {
      return `$${Number(v).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    if (isCount) {
      return Number(v).toLocaleString();
    }

    return v;
  };

  /* ================= LABEL FORMATTER ================= */
  const labelize = (k) => {
    if (k === "total" || k === "total_count") {
      return `TOTAL ${moduleLabel.toUpperCase()}`;
    }
    return k.replace(/_/g, " ").toUpperCase();
  };

  /* ================= EMPTY ================= */
  const keys = Object.keys(summary);
  if (!keys.length) {
    el.innerHTML = `<div class="text-muted small">No summary data</div>`;
    return;
  }

  /* ================= RENDER ================= */
  el.innerHTML = `
    <div class="summary-grid">
      ${keys
        .map(
          (k, i) => `
          <span class="summary-item ${mapClass(k)}">
            <span class="summary-label">${labelize(k)}</span>
            <span class="summary-value">${fmt(k, summary[k])}</span>
          </span>
          ${i < keys.length - 1 ? `<span class="summary-divider">|</span>` : ""}
        `
        )
        .join("")}
    </div>
  `;
}
