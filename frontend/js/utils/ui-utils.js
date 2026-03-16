// 🧩 UI Behaviors & Layout



/**
 * Get user role from localStorage/sessionStorage
 * Assumes role is stored during login/session
 */
import { showToast } from "./index.js";
import { getUserRole } from './auth-utils.js'; // adjust path if needed
import { FIELD_DEFAULTS } from './role-defaults.js'; // this should be where role-specific field defaults are defined

/**
 * Enables floating label behavior for all inputs, including file previews.
 * @param {HTMLElement} scope - Optional parent element (defaults to document)
 */
export function setupFloatingLabels(scope = document) {
  const wrappers = scope.querySelectorAll(".field-wrapper");

  wrappers.forEach(wrapper => {
    const input = wrapper.querySelector("input, select, textarea");
    const label = wrapper.querySelector(".input-label");
    if (!input || !label) return;

    const update = () => {
      if (input.tagName === "SELECT") {
        label.classList.toggle("show", input.value !== "");
      } else if (input.type === "file") {
        const hasPreview = wrapper.querySelector(".preview-info");
        label.classList.add("show");
        if (!hasPreview && !input.files?.length) {
          label.classList.remove("show");
        }
      } else {
        label.classList.toggle("show", input.value?.trim?.() !== "");
      }
    };

    input.addEventListener("input", update);
    input.addEventListener("change", update);
    update();
  });
}

/**
 * Makes a floating action button draggable on both desktop and mobile.
 * @param {HTMLElement} button - The floating button
 * @param {Function} onClickFallback - Called if no drag happens
 */
export function makeFloatingButtonDraggable(button, onClickFallback = null) {
  let isDragging = false;
  let moved = false;
  let offset = { x: 0, y: 0 };

  button?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    isDragging = true;
    moved = false;
    offset.x = e.clientX - button.getBoundingClientRect().left;
    offset.y = e.clientY - button.getBoundingClientRect().top;
    button.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    moved = true;
    move(e.clientX, e.clientY);
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    button.style.cursor = "grab";
    if (!moved && typeof onClickFallback === "function") onClickFallback();
  });

  button?.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    isDragging = true;
    moved = false;
    offset.x = touch.clientX - button.getBoundingClientRect().left;
    offset.y = touch.clientY - button.getBoundingClientRect().top;
  });

  window.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    moved = true;
    const touch = e.touches[0];
    move(touch.clientX, touch.clientY);
  });

  window.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    if (!moved && typeof onClickFallback === "function") onClickFallback();
  });

  function move(clientX, clientY) {
    let x = clientX - offset.x;
    let y = clientY - offset.y;
    x = Math.max(0, Math.min(x, window.innerWidth - button.offsetWidth));
    y = Math.max(0, Math.min(y, window.innerHeight - button.offsetHeight));
    button.style.left = x + "px";
    button.style.top = y + "px";
    button.style.position = "fixed";
  }
}

/**
 * Setup a toggleable section (e.g., filter panel) with optional chevron icon and persisted state.
 * @param {string} toggleBtnId
 * @param {string} sectionId
 * @param {string} chevronId
 * @param {string} storageKey
 */
export function setupToggleSection(toggleBtnId, sectionId, chevronId = null, storageKey = "") {
  const toggleBtn = document.getElementById(toggleBtnId);
  const section = document.getElementById(sectionId);
  const chevron = chevronId ? document.getElementById(chevronId) : null;

  if (!toggleBtn || !section) return;

  const visible = localStorage.getItem(storageKey) ?? "false";
  const shouldHide = visible === "false";

  section.classList.toggle("hidden", shouldHide);
  toggleBtn.setAttribute("aria-expanded", String(!shouldHide));
  if (chevron) chevron.classList.toggle("rotate", !shouldHide);

  toggleBtn.addEventListener("click", () => {
    const isHidden = section.classList.toggle("hidden");
    localStorage.setItem(storageKey, String(!isHidden));
    toggleBtn.setAttribute("aria-expanded", String(!isHidden));
    if (chevron) chevron.classList.toggle("rotate");
  });

  toggleBtn.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleBtn.click();
    }
  });
}

/**
 * Dynamically toggles Add buttons based on screen size.
 * @param {string} desktopBtnId
 * @param {string} floatBtnId
 */
export function setupAddButtonResponsiveToggle(desktopBtnId, floatBtnId) {
  const toggleButtons = () => {
    const desktopBtn = document.getElementById(desktopBtnId);
    const floatBtn = document.getElementById(floatBtnId);

    if (window.innerWidth >= 769) {
      if (desktopBtn) desktopBtn.style.display = "inline-block";
      if (floatBtn) floatBtn.style.display = "none";
    } else {
      if (desktopBtn) desktopBtn.style.display = "none";
      if (floatBtn) floatBtn.style.display = "flex";
    }
  };

  toggleButtons();
  window.addEventListener("resize", toggleButtons);
}


/**
 * Renders the field selector dropdown (Universal version)
 * -------------------------------------------------------
 * Keeps same structure & format as the original,
 * but works for multiple dropdowns (main, summary, etc.)
 *
 * @param {Object} sampleRow - Example row (unused but kept for compatibility)
 * @param {string[]} selectedFields - Visible fields
 * @param {function} onUpdate - Callback when selection changes
 * @param {string[]} fieldOrder - All possible field keys
 * @param {Object} fieldLabels - Field labels (module-specific)
 * @param {string} targetId - Optional custom dropdown ID (default: "fieldSelectorDropdown")
 */
export function renderFieldSelector(
  sampleRow,
  selectedFields,
  onUpdate,
  fieldOrder,
  fieldLabels = {},
  targetId = "fieldSelectorDropdown"
) {
  const container = document.getElementById(targetId);
  if (!container) return console.warn(`⚠️ Field selector container not found: #${targetId}`);

  container.innerHTML = "";

  const skipFields = new Set(["id"]);

  // ➕ Controls: Select All / Clear All
  const controls = document.createElement("div");
  controls.className = "field-selector-controls";
  controls.innerHTML = `
    <button type="button" id="${targetId}_selectAllFields">Select All</button>
    <button type="button" id="${targetId}_clearAllFields">Clear All</button>
  `;
  container.appendChild(controls);

  // ✅ Render field list (tighter rows)
  fieldOrder.forEach((key) => {
    if (skipFields.has(key)) return;

    const label =
      fieldLabels[key] ||
      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const isChecked = selectedFields.includes(key);

    const item = document.createElement("label");
    item.className = "dropdown-item";
    item.style.padding = "2px 6px";       // 👈 tighter padding
    item.style.lineHeight = "1.1";        // 👈 reduce vertical spacing
    item.style.fontSize = "0.85rem";      // 👈 slightly smaller font
    item.innerHTML = `
      <input type="checkbox" ${isChecked ? "checked" : ""} data-key="${key}" style="margin-right: 4px; vertical-align: middle;">
      <span style="vertical-align: middle;">${label}</span>
    `;
    container.appendChild(item);
  });

  // ✅ Handle checkbox change
  container.querySelectorAll("input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      const updated = Array.from(container.querySelectorAll("input[type=checkbox]"))
        .filter((i) => i.checked)
        .map((i) => i.dataset.key);

      if (updated.length === 0) {
        showToast?.("⚠️ At least one field must be selected.");
        input.checked = true;
        return;
      }

      onUpdate(updated);
    });
  });

  // ✅ Select All button
  const selectAllBtn = container.querySelector(`#${targetId}_selectAllFields`);
  selectAllBtn?.addEventListener("click", () => {
    const checkboxes = container.querySelectorAll("input[type=checkbox]");
    checkboxes.forEach((cb) => (cb.checked = true));
    const allKeys = Array.from(checkboxes).map((cb) => cb.dataset.key);
    onUpdate(allKeys);
  });

  // ✅ Clear All button
  const clearAllBtn = container.querySelector(`#${targetId}_clearAllFields`);
  clearAllBtn?.addEventListener("click", () => {
    const checkboxes = container.querySelectorAll("input[type=checkbox]");
    checkboxes.forEach((cb) => (cb.checked = false));
    onUpdate([]);
  });

  // ✅ Independent show/hide logic per dropdown
  const toggleBtnId =
    targetId === "summaryFieldSelectorDropdown"
      ? "summaryFieldSelectorBtn"
      : "fieldSelectorBtn";

  const toggleBtn = document.getElementById(toggleBtnId);
  if (toggleBtn && !toggleBtn.dataset.bound) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      container.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!container.contains(e.target) && !toggleBtn.contains(e.target)) {
        container.classList.add("hidden");
      }
    });

    toggleBtn.dataset.bound = "true";
  }
}

// 📌 Format patient as "Name (No)"
export function formatPatientDisplay(patient) {
  if (!patient) return "—";
  return `${patient.full_name || "Unknown"} (${patient.pat_no || "—"})`;
}


// ✅ Format a date string into a readable format
// ✅ DATE ONLY — NO TIME EVER
export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
// ✅ Format full date-time (YYYY-MM-DD HH:mm:ss)
export function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatClinicalDate(dateStr) {
  if (!dateStr) return "—";

  const [year, month, day] = dateStr.split("-");

  const months = [
    "Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.",
    "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."
  ];

  return `${months[Number(month) - 1]} ${Number(day)}, ${year}`;
}
// ============================================================
// 💵 Global Currency Formatter
// ------------------------------------------------------------
// Always returns properly formatted currency like:
// $1,250.00
// ============================================================
export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "$0.00";

  const num = Number(value);
  if (isNaN(num)) return "$0.00";

  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

/**
 * Setup field selector for a given module (e.g., organization, patients).
 * Keeps field selections in localStorage scoped by module.
 *
 * @param {Object} opts
 * @param {string} opts.module - Module key (e.g., "organization").
 * @param {Object} opts.fieldLabels - Mapping of field keys -> labels.
 * @param {string[]} opts.fieldOrder - Array of possible field keys (in order).
 * @param {string[]} opts.defaultFields - Role-specific default fields.
 */
export function setupFieldSelector({ module, fieldLabels, fieldOrder, defaultFields }) {
  const storageKey = `fieldSelector_${module}`;

  // Load saved fields or fallback to defaults
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    saved = [];
  }

  const selectedFields = saved.length > 0 ? saved : defaultFields;

  // Callback to update storage + re-render
  const handleUpdate = (updated) => {
    if (!updated.length) {
      showToast?.("⚠️ At least one field must be selected.");
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(updated));
    // 🔁 re-render field selector UI
    renderFieldSelector({}, updated, handleUpdate, fieldOrder, fieldLabels);
  };

  // Initial render
  renderFieldSelector({}, selectedFields, handleUpdate, fieldOrder, fieldLabels);

  return selectedFields; // return currently active fields
}


// 📁 utils/ui-utils.js
import { authFetch } from "../authSession.js";

/**
 * Generic suggestion dropdown for text inputs
 * @param {Object} config
 * @param {HTMLInputElement} config.inputEl - The visible input
 * @param {HTMLInputElement} config.hiddenEl - Hidden field storing selected ID
 * @param {HTMLElement} config.suggestionBoxEl - <ul> container for suggestions
 * @param {string} config.apiEndpoint - API endpoint for search
 * @param {string} config.labelField - Field name to display
 * @param {string} config.valueField - Field name for ID
 */
export function setupSuggestionInput({
  inputEl,
  hiddenEl,
  suggestionBoxEl,
  apiEndpoint,
  labelField,
  valueField,
}) {
  if (!inputEl || !hiddenEl || !suggestionBoxEl) return;

  // Clear on manual edit
  inputEl.addEventListener("input", async () => {
    hiddenEl.value = "";
    const query = inputEl.value.trim();
    if (!query) {
      suggestionBoxEl.innerHTML = "";
      return;
    }

    try {
      const res = await authFetch(`${apiEndpoint}?q=${encodeURIComponent(query)}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed");

      suggestionBoxEl.innerHTML = "";

      if (Array.isArray(result.data) && result.data.length > 0) {
        result.data.forEach((item) => {
          const li = document.createElement("li");
          li.classList.add("suggestion-item");
          li.textContent = item[labelField];
          li.dataset.value = item[valueField];

          li.addEventListener("click", () => {
            inputEl.value = item[labelField];
            hiddenEl.value = item[valueField];
            suggestionBoxEl.innerHTML = "";
          });

          suggestionBoxEl.appendChild(li);
        });
      }
    } catch (err) {
      console.error("❌ Suggestion fetch failed", err);
      suggestionBoxEl.innerHTML = "";
    }
  });

  // Hide suggestions on blur
  inputEl.addEventListener("blur", () => {
    setTimeout(() => (suggestionBoxEl.innerHTML = ""), 150);
  });
}

/* ============================================================
   🧭 TOOLTIP INITIALIZER (Global)
   ------------------------------------------------------------
   Enables Bootstrap tooltips safely for dynamic content.
   Reusable across all pages & modules.
============================================================ */
export function initTooltips(scope = document) {
  if (!window.bootstrap) return;

  const triggers = [...scope.querySelectorAll("[data-bs-toggle='tooltip']")];

  triggers.forEach((el) => {
    // 🧠 Avoid double-initializing existing instances
    if (!bootstrap.Tooltip.getInstance(el)) {
      new bootstrap.Tooltip(el);
    }
  });
}
