// 📦 utils/symptom-utils.js
import { COMMON_SYMPTOMS } from "../constants/symptoms.js";

/**
 * Setup symptom checkboxes → textarea sync
 * @param {string} textareaId - The ID of the symptoms textarea
 * @param {string} checkboxSelector - CSS selector for checkboxes
 */
export function setupSymptomCheckboxes(textareaId = "symptoms", checkboxSelector = ".common-symptom") {
  const symptomsInput = document.getElementById(textareaId);
  if (!symptomsInput) return;

  function updateSymptoms() {
    const selected = Array.from(document.querySelectorAll(`${checkboxSelector}:checked`))
      .map(cb => cb.dataset.label || cb.value)
      .join(", ");
    symptomsInput.value = selected;
  }

  document.querySelectorAll(checkboxSelector).forEach(cb => {
    cb.addEventListener("change", updateSymptoms);
  });

  // ✅ Initial sync (in case checkboxes are prefilled on edit)
  updateSymptoms();
}

/**
 * Pre-check common symptom checkboxes based on a stored string
 * @param {string} symptomsValue - Comma-separated symptom string
 * @param {string} checkboxSelector - CSS selector for checkboxes
 */
export function syncSymptomCheckboxes(symptomsValue = "", checkboxSelector = ".common-symptom") {
  const currentSymptoms = (symptomsValue || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  document.querySelectorAll(checkboxSelector).forEach(cb => {
    const label = cb.dataset.label?.trim().toLowerCase();
    cb.checked = currentSymptoms.includes(label);
  });
}

/**
 * Render symptom checkboxes into a container
 * @param {string} containerId - ID of the container div
 * @param {string[]} symptoms - Optional override list
 */
export function renderSymptomCheckboxes(containerId = "symptomCheckboxes", symptoms = COMMON_SYMPTOMS) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = symptoms
    .map(
      (s, idx) => `
        <div class="form-check me-3 mb-2">
          <input 
            class="form-check-input common-symptom" 
            type="checkbox" 
            id="symptom_${idx}" 
            data-label="${s}" 
            value="${s}">
          <label class="form-check-label" for="symptom_${idx}">
            ${s}
          </label>
        </div>`
    )
    .join("");
}
