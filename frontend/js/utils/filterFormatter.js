export function formatFilters(filters = {}, options = {}) {
  const {
    sample = {},   // optional entry (for names)
    map = {},      // optional custom label overrides
  } = options;

  const formatted = {};

  // 🔥 helper: format date nicely
  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date)) return d;

    return date.toLocaleDateString("en-US", {
      month: "short",   // Apr
      day: "numeric",   // 20
      year: "numeric",  // 2026
    });
  };

  Object.entries(filters).forEach(([key, value]) => {
    if (!value || String(value).trim() === "") return;

    switch (key) {
      case "status":
        formatted[map.status || "Status"] =
          String(value).toUpperCase();
        break;

      case "organization_id":
        formatted[map.organization || "Organization"] =
          sample?.organization?.name || value;
        break;

      case "facility_id":
        formatted[map.facility || "Facility"] =
          sample?.facility?.name || value;
        break;

      case "dateRange": {
        // 🔥 convert "03/22/2026 - 04/20/2026"
        const [from, to] = String(value).split(" - ");

        formatted[map.dateRange || "Date Range"] =
          `${formatDate(from)} → ${formatDate(to)}`;
        break;
      }

      case "patient_id":
        formatted[map.patient || "Patient"] =
          sample?.patient
            ? `${sample.patient.first_name || ""} ${sample.patient.last_name || ""}`.trim()
            : value;
        break;

      case "method":
        formatted[map.method || "Method"] = value;
        break;

      case "currency":
        formatted[map.currency || "Currency"] = value;
        break;

      case "search":
        formatted[map.search || "Search"] = value;
        break;

      default:
        // ignore raw/internal fields (keeps output clean)
        break;
    }
  });

  return formatted;
}