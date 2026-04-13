// 📁 ledger-actions.js
// ============================================================================
// 📊 Ledger Actions – MASTER (Audit-safe, aligned with deposits-actions)
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
} from "../../../utils/index.js";

import { authFetch } from "../../../authSession.js";
import { renderLedgerDetail } from "./ledger-render.js";

/* ============================================================ */
export function setupLedgerActionHandlers({
  entries,
  currentPage,
  loadEntries,
}) {
  const tableBody = document.getElementById("ledgerTableBody");
  const cardContainer = document.getElementById("ledgerList");

  // cache entries
  window.latestLedgerEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestLedgerEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    /* fallback fetch */
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/cash-ledger/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Ledger record not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Ledger data missing");

    const classList = btn.classList;

    if (classList.contains("view-btn")) return handleView(entry);
  }

  /* ---------------------- handlers ---------------------- */

  function handleView(entry) {
    let role = (localStorage.getItem("userRole") || "").trim().toLowerCase();

    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    const html = renderLedgerDetail(entry, role);

    const modal = document.getElementById("viewModal");
    modal.querySelector("#viewModalTitle").textContent = "Ledger Details";
    modal.querySelector("#viewModalBody").innerHTML = html;
    modal.classList.remove("hidden");
  }

  /* ---------------------- modal helpers ---------------------- */

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add("hidden");

    const form = modal.querySelector("form");
    if (form) form.reset();
  }

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  /* ---------------------- global helpers ---------------------- */

  window.viewLedger = (id) => {
    const btn = document.querySelector(`.view-btn[data-id="${id}"]`);
    if (btn) btn.click();
    else showToast("❌ View button not found");
  };
}