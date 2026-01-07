// 📁 backend/src/utils/fieldVisibility.js

/**
 * filterFields – remove fields not visible to the current role
 * @param {Object|Array} data - record(s) to filter
 * @param {Array<string>} visibleFields - allowed fields
 */
export function filterFields(data, visibleFields = []) {
  if (!data) return null;

  const filterObj = (obj) => {
    const result = {};
    for (const field of visibleFields) {
      if (obj[field] !== undefined) {
        result[field] = obj[field];
      }
    }
    return result;
  };

  if (Array.isArray(data)) {
    return data.map(filterObj);
  }
  return filterObj(data);
}

/**
 * applyRoleVisibility – enforce role-based defaults
 * @param {Object} options
 * @param {string} options.role - user role (e.g. "admin", "nurse")
 * @param {Object} options.FIELD_DEFAULTS - map of role → default fields
 * @param {Object|Array} options.data - record(s) to filter
 */
export function applyRoleVisibility({ role, FIELD_DEFAULTS, data }) {
  const visibleFields = FIELD_DEFAULTS[role] || FIELD_DEFAULTS["default"] || [];
  return filterFields(data, visibleFields);
}
