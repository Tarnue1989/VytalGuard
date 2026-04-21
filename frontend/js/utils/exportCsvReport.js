import { exportData } from "./export-utils.js";

export function exportCsvReport({
  title = "Report",
  data = [],
  visibleFields = [],
  fieldLabels = {},
  mapRow,
}) {
  if (!data.length) {
    alert("❌ No data to export");
    return;
  }

  const cleanFields = visibleFields.filter(
    (f) =>
      f !== "actions" &&
      !["deletedBy", "deleted_at"].includes(f)
  );

  const mapped = data.map((entry) => {
    const raw = mapRow(entry, cleanFields);
    const formatted = {};

    cleanFields.forEach((key) => {
      const label =
        fieldLabels[key] ||
        key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());

      formatted[label] = raw[key];
    });

    return formatted;
  });

  exportData({
    type: "csv",
    title,
    data: mapped,
  });
}