// 📦 finance-print.js – FINAL (Enterprise-safe)

import { printReceipt } from "../../utils/receipt-utils.js";
import { getOrgInfo } from "../shared/org-config.js";

export function printFinanceReport() {
  const org = getOrgInfo();
  const content = document.getElementById("financeReportWrapper");

  if (!content) return;

  printReceipt(
    "Finance Report",
    content.innerHTML,
    org?.id
  );
}
