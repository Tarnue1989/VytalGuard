/* ============================================================
   🧲 TABLE COLUMN DRAG & DROP (UI ONLY)
   ============================================================
   - Reorders visibleFields
   - Persists per module (localStorage)
   - Safe with sorting, pagination, resize
   ============================================================ */

export function enableColumnDrag({
  table,
  visibleFields,
  storageKey,
  onReorder,
}) {
  if (!table || !Array.isArray(visibleFields)) return;

  let draggedKey = null;

  const ths = table.querySelectorAll("thead th");

  ths.forEach((th) => {
    const key = th.dataset.key;
    if (!key || key === "actions") return;

    th.draggable = true;

    th.addEventListener("dragstart", (e) => {
      draggedKey = key;
      e.dataTransfer.effectAllowed = "move";
    });

    th.addEventListener("dragover", (e) => {
      e.preventDefault();
      th.classList.add("drag-over");
    });

    th.addEventListener("dragleave", () => {
      th.classList.remove("drag-over");
    });

    th.addEventListener("drop", (e) => {
      e.preventDefault();
      th.classList.remove("drag-over");

      if (!draggedKey || draggedKey === key) return;

      const from = visibleFields.indexOf(draggedKey);
      const to = visibleFields.indexOf(key);

      if (from === -1 || to === -1) return;

      // 🔁 reorder array
      visibleFields.splice(to, 0, visibleFields.splice(from, 1)[0]);

      // 💾 persist
      localStorage.setItem(storageKey, JSON.stringify(visibleFields));

      // 🔄 callback
      onReorder?.(visibleFields);
    });
  });
}
