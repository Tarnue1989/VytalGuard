import { printFinanceSummary } from "./finance-print.js";

export function setupFinanceActions() {
  document.getElementById("financePrintBtn")
    ?.addEventListener("click", () => {
      printFinanceSummary(window.financeSummaryData);
    });
}