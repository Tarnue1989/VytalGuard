export function mapDataForExport(entries, visibleFields, labels = {}) {
  return entries.map(row => {
    const out = {};
    visibleFields.forEach(f => {
      if (f === "actions") return; // auto-skip UI-only column
      out[labels[f] || f] = row?.[f] ?? "";
    });
    return out;
  });
}
