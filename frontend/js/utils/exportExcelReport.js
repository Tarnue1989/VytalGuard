import { authFetch } from "../authSession.js";
import { formatFilters } from "./filterFormatter.js";
import { exportData } from "./export-utils.js";

export async function exportExcelReport({
  endpoint,
  title = "Report",
  filters = {},
  visibleFields = [],
  fieldLabels = {},
  mapRow,        // 🔥 required (module-specific)
  computeTotals, // 🔥 optional
}) {
  try {
    /* ======================================================
       🔥 BUILD QUERY (SAFE + FLEXIBLE)
    ====================================================== */
    const params = new URLSearchParams();
    params.set("limit", 10000);
    params.set("page", 1);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || String(v).trim() === "" || v === "null") return;

      if (k === "dateRange") {
        let from, to;

        if (String(v).includes(" - ")) {
          [from, to] = v.split(" - ");
        } else if (String(v).includes(" to ")) {
          [from, to] = v.split(" to ");
        }

        if (from) params.set("date_from", from.trim());
        if (to) params.set("date_to", to.trim());
      } else {
        params.set(k, v);
      }
    });

    console.log("📤 EXPORT PARAMS:", params.toString());

    /* ======================================================
       🔥 FETCH DATA
    ====================================================== */
    const res = await authFetch(`${endpoint}?${params.toString()}`);
    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.message || "Failed to fetch export data");
    }

    const records = json?.data?.records || [];

    console.log("📊 EXPORT RECORD COUNT:", records.length);

    if (!records.length) {
      alert("⚠️ No records found for current filters");
      return;
    }

    /* ======================================================
       🔥 CLEAN FIELDS
    ====================================================== */
    const cleanFields = visibleFields.filter(
      (f) =>
        f !== "actions" &&
        !["deletedBy", "deleted_at"].includes(f)
    );

    /* ======================================================
       🔥 MAP ROWS + FORMAT HEADERS
    ====================================================== */
    const mapped = records.map((e) => {
      const rawRow = mapRow(e, cleanFields);
      const formattedRow = {};

      cleanFields.forEach((key) => {
        const label =
          fieldLabels[key] ||
          key
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase());

        formattedRow[label] = rawRow[key];
      });

      return formattedRow;
    });

    /* ======================================================
       🔥 TOTALS (OPTIONAL)
    ====================================================== */
    const totals = computeTotals
      ? computeTotals(records)
      : {};

    /* ======================================================
       🔥 FORMAT FILTERS
    ====================================================== */
    const formattedFilters = formatFilters(filters, {
      sample: records[0],
    });

    /* ======================================================
       🔥 EXPORT
    ====================================================== */
    exportData({
      type: "xlsx",
      title,
      data: mapped,
      meta: {
        ...formattedFilters,
        Records: records.length,
        ...totals,
      },
    });

  } catch (err) {
    console.error("❌ EXPORT ERROR:", err);
    alert("❌ Failed to export Excel");
  }
}