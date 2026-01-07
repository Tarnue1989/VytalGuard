// 📁 backend/src/jobs/reconcileInventory.js
import db from "../models/index.js";
import { STOCK_LEDGER_TYPE } from "../constants/enums.js";

export async function reconcileInventory() {
  const errors = [];

  // 1️⃣ Check CentralStock
  const centralStocks = await db.CentralStock.findAll();
  for (const stock of centralStocks) {
    const ledgerSum = await db.StockLedger.sum("quantity", {
      where: { central_stock_id: stock.id },
    });

    const lastLedger = await db.StockLedger.findOne({
      where: { central_stock_id: stock.id },
      order: [["created_at", "DESC"]],
    });

    if (ledgerSum !== stock.quantity) {
      errors.push({
        type: "CentralStock mismatch",
        stock_id: stock.id,
        expected: ledgerSum,
        found: stock.quantity,
        last_ledger: lastLedger?.toJSON(),
      });
    }
  }

  // 2️⃣ Check DepartmentStock
  const deptStocks = await db.DepartmentStock.findAll();
  for (const stock of deptStocks) {
    const ledgerSum = await db.StockLedger.sum("quantity", {
      where: { department_id: stock.department_id, master_item_id: stock.master_item_id },
    });

    if (ledgerSum !== stock.quantity) {
      errors.push({
        type: "DepartmentStock mismatch",
        stock_id: stock.id,
        expected: ledgerSum,
        found: stock.quantity,
      });
    }
  }

  return errors;
}

// Run standalone (for cron jobs)
if (require.main === module) {
  (async () => {
    const issues = await reconcileInventory();
    if (issues.length) {
      console.error("❌ Inventory reconciliation found issues:", issues);
      process.exit(1);
    } else {
      console.log("✅ Inventory reconciliation passed");
      process.exit(0);
    }
  })();
}
