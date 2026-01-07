/* ============================================================
   🧠 FORM UX & ETHICS UTIL (FINAL – BOOTSTRAP SAFE)
   ------------------------------------------------------------
   ✔ No auto-validation on load
   ✔ Errors shown ONLY on submit or backend response
   ✔ Errors clear when user fixes a field
   ✔ Works with input, select, textarea
   ✔ Safe for shared use across ALL forms
============================================================ */

/* ------------------------------------------------------------
   Find the best container to place invalid-feedback
------------------------------------------------------------ */
function getFeedbackContainer(el) {
  return (
    el.closest(".form-group") ||
    el.closest(".mb-3") ||
    el.closest(".mb-2") ||
    el.closest(".col") ||
    el.parentElement
  );
}

/* ------------------------------------------------------------
   Mark a field invalid with message
------------------------------------------------------------ */
export function setFieldError(el, message) {
  if (!el) return;

  el.classList.add("is-invalid");

  const container = getFeedbackContainer(el);
  let feedback = container.querySelector(".invalid-feedback");

  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "invalid-feedback";
    container.appendChild(feedback);
  }

  feedback.textContent = message;
}

/* ------------------------------------------------------------
   Clear error for a single field
------------------------------------------------------------ */
export function clearFieldError(el) {
  if (!el) return;

  el.classList.remove("is-invalid");

  const container = getFeedbackContainer(el);
  const feedback = container.querySelector(".invalid-feedback");
  if (feedback) feedback.remove();
}

/* ------------------------------------------------------------
   Clear ALL errors in a form
------------------------------------------------------------ */
export function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll(".is-invalid").forEach(clearFieldError);
}

/* ------------------------------------------------------------
   Enable live error clearing (NO validation)
------------------------------------------------------------ */
export function enableLiveValidation(form) {
  if (!form) return;

  // text, date, email, number, etc.
  form.querySelectorAll("input, textarea").forEach((el) => {
    el.addEventListener("input", () => {
      if (el.value !== "") clearFieldError(el);
    });
  });

  // selects behave differently
  form.querySelectorAll("select").forEach((el) => {
    el.addEventListener("change", () => {
      if (el.value && el.value !== "") {
        clearFieldError(el);
      }
    });
  });
}

/* ------------------------------------------------------------
   Apply backend validation errors
   Expected format:
   [{ field: "first_name", message: "First Name is required" }]
------------------------------------------------------------ */
export function applyServerErrors(form, errors = []) {
  if (!form || !Array.isArray(errors)) return;

  errors.forEach(({ field, message }) => {
    const el =
      form.querySelector(`#${field}`) ||
      form.querySelector(`[name="${field}"]`);

    if (el) {
      setFieldError(el, message);
    }
  });
}
