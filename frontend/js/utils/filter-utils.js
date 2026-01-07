// 🔍 Filters & Search Logic

/**
 * Filter a list of records by checking multiple nested fields for a search term.
 * @param {Array} list - Array of records
 * @param {string} term - Search term
 * @param {string[]} fields - List of dot-notated field paths to search
 */
export function filterByFields(list, term, fields) {
  const lower = term.toLowerCase();
  return list.filter(item =>
    fields.some(field => {
      const val = field.split('.').reduce((obj, key) => obj?.[key], item);
      return (val || '').toLowerCase().includes(lower);
    })
  );
}

/**
 * Apply dynamic filters to records (text, exact, date-range).
 * @param {Array} records
 * @param {Object} filters - { field: { type, value, ... } }
 */
export function filterRecords(records, filters) {
  return records.filter(entry => {
    return Object.entries(filters).every(([field, rule]) => {
      const value = getNestedField(entry, field);

      if (rule.type === "text") {
        return !rule.value || (value || "").toLowerCase().includes(rule.value.toLowerCase());
      }

      if (rule.type === "exact") {
        return !rule.value || value === rule.value;
      }

      if (rule.type === "date-range") {
        const date = (value || "").split("T")[0];
        const after = !rule.start || date >= rule.start;
        const before = !rule.end || date <= rule.end;
        return after && before;
      }

      return true;
    });
  });
}

/**
 * Safely access a nested field in an object using dot notation.
 * @param {Object} obj
 * @param {string} path - Dot-notated path, e.g., 'createdByUser.full_name'
 * @returns {*} - The value or null
 */
export function getNestedField(obj, path) {
  return path.split('.').reduce((o, key) => (o ? o[key] : null), obj);
}
