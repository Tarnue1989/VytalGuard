/* ============================================================
   🔎 Global Auto Search Utility (MASTER)
   - Debounced live search
   - Enter key support
   - Page reset to 1
============================================================ */
export function setupAutoSearch(inputEl, onSearch, delay = 350) {
  if (!inputEl || typeof onSearch !== "function") return;

  let timer = null;

  // Live typing (debounce)
  inputEl.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      onSearch(1);
    }, delay);
  });

  // Enter key → immediate
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(timer);
      onSearch(1);
    }
  });
}

/* ============================================================
   🔎 Auto Filters Utility (OPT-IN)
   - Select filters
   - Date range
   - Reuses page reset logic
============================================================ */
export function setupAutoFilters({
  searchInput,
  selectInputs = [],
  dateRangeInput = null,
  onChange,
  debounceMs = 350,
}) {
  if (typeof onChange !== "function") return;

  /* ---------- SEARCH (optional, debounced) ---------- */
  if (searchInput) {
    let timer;
    searchInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChange(1), debounceMs);
    });

    searchInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        clearTimeout(timer);
        onChange(1);
      }
    });
  }

  /* ---------- SELECT FILTERS ---------- */
  selectInputs.forEach(el => {
    el?.addEventListener("change", () => onChange(1));
  });

  /* ---------- DATE RANGE ---------- */
  if (dateRangeInput && window.$) {
    $(dateRangeInput)
      .on("apply.daterangepicker", () => onChange(1))
      .on("cancel.daterangepicker", () => {
        dateRangeInput.value = "";
        onChange(1);
      });
  }
}
