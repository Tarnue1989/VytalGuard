// /js/utils/field-visibility.js

export function setupVisibleFields({ moduleKey, userRole, defaultFields, allowedFields }) {
  const storageKey = `${moduleKey}VisibleFields`;
  let visibleFields = [];

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(stored) && stored.length > 0) {
      visibleFields = stored.filter(f => allowedFields.includes(f));
    }

    if (!visibleFields || visibleFields.length === 0) {
      visibleFields = [...(defaultFields[userRole] || allowedFields)];
      console.warn(`⚠️ No valid visibleFields for ${moduleKey}. Falling back to defaults:`, visibleFields);
    }
  } catch {
    visibleFields = [...(defaultFields[userRole] || allowedFields)];
    console.warn(`⚠️ Error loading stored visibleFields for ${moduleKey}. Using fallback.`);
  }

  visibleFields = visibleFields.filter(f => allowedFields.includes(f));
  localStorage.setItem(storageKey, JSON.stringify(visibleFields));

  return visibleFields;
}
