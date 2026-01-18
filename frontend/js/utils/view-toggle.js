/* ============================================================
   🧭 View Toggle Utility (Table / Card)
   ------------------------------------------------------------
   - Syncs active button UI
   - No side effects
   - Renderer-agnostic
============================================================ */

export function syncViewToggleUI({
  mode,
  tableBtnId = "tableViewBtn",
  cardBtnId = "cardViewBtn",
}) {
  const tableBtn = document.getElementById(tableBtnId);
  const cardBtn = document.getElementById(cardBtnId);

  if (!tableBtn || !cardBtn) return;

  tableBtn.classList.toggle("active", mode === "table");
  cardBtn.classList.toggle("active", mode === "card");
}
