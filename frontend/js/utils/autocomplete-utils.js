// 🔍 Autocomplete & Typeahead Inputs

import { showToast } from './toast-utils.js';

/**
 * Type-to-search suggestion list for general purpose use.
 */
export function setupSuggestionInput(input, container, list, onSelect, labelKey = "name") {
  let selectedIndex = -1;
  let currentSuggestions = [];
  let debounceTimer;

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const value = input.value.toLowerCase().trim();
      container.innerHTML = "";
      container.style.display = "block";
      selectedIndex = -1;

      currentSuggestions = list.filter(item => {
        const field = (item[labelKey] || "").toString().toLowerCase();
        return field.includes(value);
      }).slice(0, 10);

      if (currentSuggestions.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No match found";
        li.classList.add("disabled");
        li.style.color = "#888";
        li.style.cursor = "default";
        container.appendChild(li);
        return;
      }

      currentSuggestions.forEach((item, index) => {
        const li = document.createElement("li");

        // 🔁 Smarter label formatting
        let label = "Unnamed";
        if (labelKey === "full_name" && item.pat_no && item.full_name) {
          label = `${item.pat_no} - ${item.full_name}`;
        } else if (item[labelKey]) {
          label = item[labelKey];
        } else if (item.full_name) {
          label = item.full_name;
        }

        li.textContent = label;
        li.classList.add("suggestion-item");

        li.addEventListener("click", () => {
          onSelect(item);
          container.innerHTML = "";
          container.style.display = "none";
        });

        container.appendChild(li);
      });
    }, 200);
  });

  input.addEventListener("keydown", (e) => {
    const items = container.querySelectorAll("li:not(.disabled)");
    if (!items.length) return;

    if (e.key === "ArrowDown") {
      selectedIndex = (selectedIndex + 1) % items.length;
      updateHighlight(items);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateHighlight(items);
      e.preventDefault();
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      items[selectedIndex].click();
      e.preventDefault();
    } else if (e.key === "Escape") {
      container.innerHTML = "";
      container.style.display = "none";
      selectedIndex = -1;
    }
  });

  document.addEventListener("click", e => {
    if (!container.contains(e.target) && e.target !== input) {
      container.innerHTML = "";
      container.style.display = "none";
    }
  });

  function updateHighlight(items) {
    items.forEach((li, idx) => {
      li.classList.toggle("highlight", idx === selectedIndex);
    });
  }
}

/**
 * Type-to-search patient selection with hidden ID field.
 */
export function setupPatientAutocomplete(inputId, hiddenId, suggestionsId, allPatients, onSelect) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  const suggestionBox = document.getElementById(suggestionsId);

  input.addEventListener("input", () => {
    const keyword = input.value.toLowerCase();
    const matches = allPatients.filter(p =>
      (p.full_name || "").toLowerCase().includes(keyword) ||
      (p.pat_no || "").toLowerCase().includes(keyword)
    );

    suggestionBox.innerHTML = "";
    if (matches.length && keyword.length > 0) {
      suggestionBox.style.display = "block";
      matches.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.pat_no} - ${p.full_name}`;
        li.dataset.id = p.id;
        li.onclick = () => {
          input.value = `${p.pat_no} - ${p.full_name}`;
          hidden.value = p.id;
          suggestionBox.style.display = "none";
          if (typeof onSelect === "function") onSelect(p.id);
        };
        suggestionBox.appendChild(li);
      });
    } else {
      suggestionBox.style.display = "none";
    }
  });

  window.addEventListener("click", e => {
    if (!e.target.closest(".autocomplete-wrapper")) {
      suggestionBox.style.display = "none";
    }
  });
}

/**
 * Type-to-search surgeon autocomplete with hidden ID field.
 */
export function setupSurgeonAutocomplete(inputId, hiddenId, suggestionsId, allSurgeons, onSelect) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  const suggestionBox = document.getElementById(suggestionsId);

  if (!input || !hidden || !suggestionBox) return;

  input.addEventListener("input", () => {
    const keyword = input.value.toLowerCase();
    const matches = allSurgeons.filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(keyword)
    );

    suggestionBox.innerHTML = "";
    if (matches.length && keyword.length > 0) {
      suggestionBox.style.display = "block";
      matches.forEach(s => {
        const li = document.createElement("li");
        li.textContent = `${s.first_name} ${s.last_name}`;
        li.dataset.id = s.id;
        li.onclick = () => {
          input.value = `${s.first_name} ${s.last_name}`;
          hidden.value = s.id;
          suggestionBox.style.display = "none";
          if (typeof onSelect === "function") onSelect(s.id);
        };
        suggestionBox.appendChild(li);
      });
    } else {
      suggestionBox.style.display = "none";
    }
  });

  window.addEventListener("click", e => {
    if (!e.target.closest(".autocomplete-wrapper")) {
      suggestionBox.style.display = "none";
    }
  });
}

/**
 * Create a list item for suggestion dropdowns.
 */
export function createSuggestionListItem(text, onClick) {
  const li = document.createElement("li");
  li.textContent = text;
  li.addEventListener("mousedown", onClick);
  return li;
}
