export function enableColumnResize(table, onResizeDone = () => {}) {
  if (!table) return;

  const ths = Array.from(table.querySelectorAll("thead th"));
  const rows = Array.from(table.querySelectorAll("tbody tr"));

  let lastClickTime = 0;

  ths.forEach((th, index) => {
    if (th.querySelector(".resize-handle")) return;

    const handle = document.createElement("div");
    handle.className = "resize-handle";
    th.appendChild(handle);

    let startX, startWidth;
    let isDragging = false;

    /* ============================
       MOUSEDOWN (POSSIBLE DRAG)
       ============================ */
    handle.addEventListener("mousedown", e => {
      const now = Date.now();

      // ⛔ If this is part of a double-click, DO NOT drag
      if (now - lastClickTime < 250) {
        return;
      }

      isDragging = true;
      startX = e.pageX;
      startWidth = th.offsetWidth;

      function onMove(ev) {
        if (!isDragging) return;
        const newWidth = Math.max(80, startWidth + (ev.pageX - startX));
        applyWidth(newWidth);
      }

      function onUp() {
        isDragging = false;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        onResizeDone();
      }

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    /* ============================
       DOUBLE CLICK → AUTO FIT ✅
       ============================ */
    handle.addEventListener("dblclick", e => {
      e.preventDefault();
      e.stopPropagation();

      lastClickTime = Date.now();
      isDragging = false;

      let maxWidth = th.scrollWidth;

      rows.forEach(row => {
        const cell = row.children[index];
        if (cell) {
          maxWidth = Math.max(maxWidth, cell.scrollWidth);
        }
      });

      applyWidth(maxWidth + 16); // padding buffer
      onResizeDone();
    });

    /* ============================
       APPLY WIDTH TO COLUMN
       ============================ */
    function applyWidth(px) {
      th.style.width = px + "px";
      rows.forEach(row => {
        const cell = row.children[index];
        if (cell) cell.style.width = px + "px";
      });
    }
  });
}
