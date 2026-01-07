import { printFinanceReport } from "./finance-print.js";

export function setupFinanceActions() {
  document.getElementById("financePrintBtn")
    ?.addEventListener("click", () => printFinanceReport());
}
