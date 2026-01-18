// utils/export-helpers.js
export function buildExportRows(entries, visibleFields) {
  return entries.map(e => {
    const row = {};
    visibleFields.forEach(f => {
      if (f !== "actions") row[f] = e?.[f] ?? "";
    });
    return row;
  });
}
