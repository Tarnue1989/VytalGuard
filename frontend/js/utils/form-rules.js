// 📁 utils/form-rules.js
// =============================================
// Reusable Form Rules Engine (Enterprise Pattern)
// =============================================

export function validateFormByRules({ form, rules }) {
  let firstInvalid = null;

  rules.forEach(rule => {
    const el = document.getElementById(rule.id);
    if (!el) return;

    // Reset previous error state
    el.classList.remove("is-invalid");

    // Conditional rule
    if (typeof rule.when === "function" && !rule.when()) return;

    const value =
      el.type === "checkbox" || el.type === "radio"
        ? el.checked
        : el.value?.trim();

    if (!value) {
      el.classList.add("is-invalid");
      if (!firstInvalid) firstInvalid = { el, rule };
    }
  });

  if (firstInvalid) {
    firstInvalid.el.focus();
    throw new Error(firstInvalid.rule.message || "Required field missing");
  }

  return true;
}
