// 📁 backend/src/services/pharmacyService.js
import db from "../models/index.js";
import { inventoryService } from "./inventoryService.js";
import {
  PRESCRIPTION_STATUS,
  PRESCRIPTION_ITEM_STATUS,
  PHARMACY_TRANSACTION_TYPE,
  PHARMACY_TRANSACTION_STATUS,
  STOCK_LEDGER_TYPE,
} from "../constants/enums.js";
import { Op } from "sequelize";

export const pharmacyService = {
  /* ============================================================
     🔄 Shared: Sync prescription + item status
     - SINGLE SOURCE OF TRUTH for TOTAL dispensed
     - Billing must rely on this outcome
  ============================================================ */
  async syncPrescriptionStatus(prescriptionItemId, pharmacistId, t) {
    const item = await db.PrescriptionItem.findByPk(
      prescriptionItemId,
      { transaction: t }
    );
    if (!item) return;

    /* ------------------------------------------------------------
       1️⃣ Determine ITEM status (TOTAL dispensed vs prescribed)
    ------------------------------------------------------------ */
    let newItemStatus = "draft";

    if (item.dispensed_qty >= item.quantity) {
      newItemStatus = "dispensed";
    } else if (item.dispensed_qty > 0) {
      newItemStatus = "partially_dispensed";
    } else {
      newItemStatus = "issued";
    }

    /* 🔍 DEBUG LOG — TOTAL DISPENSE & BILLING DECISION */
    console.log("[PHARMACY TOTAL DISPENSE CHECK]", {
      prescription_item_id: item.id,
      prescribed_qty: item.quantity,
      total_dispensed: item.dispensed_qty,
      balance_remaining: item.quantity - item.dispensed_qty,
      item_status_decision: newItemStatus,
      billing_should_trigger: newItemStatus === "dispensed",
    });

    await item.update(
      { status: newItemStatus },
      { transaction: t }
    );

    /* ------------------------------------------------------------
       2️⃣ Resolve PARENT prescription status
    ------------------------------------------------------------ */
    const allItems = await db.PrescriptionItem.findAll({
      where: { prescription_id: item.prescription_id },
      transaction: t,
    });

    const allDispensed = allItems.every(
      (i) => i.status === "dispensed"
    );

    const anyDispensed = allItems.some((i) =>
      ["dispensed", "partially_dispensed"].includes(i.status)
    );

    let newPrescStatus = "issued";
    if (allDispensed) {
      newPrescStatus = "dispensed";
    } else if (anyDispensed) {
      newPrescStatus = "partially_dispensed";
    }

    await db.Prescription.update(
      {
        status: newPrescStatus,
        fulfilled_by: pharmacistId,
        fulfilled_at: anyDispensed ? new Date() : null,
      },
      {
        where: { id: item.prescription_id },
        transaction: t,
      }
    );
  },

  /* ============================================================
    1️⃣ Dispense Medication (Full or Partial)
  ============================================================ */
  async dispenseItem(
    prescriptionItemId,
    qty,
    pharmacistId,
    transaction = null,
    departmentStockId = null
  ) {
    const t = transaction || (await db.sequelize.transaction());
    try {
      const item = await db.PrescriptionItem.findByPk(
        prescriptionItemId,
        {
          include: [{ model: db.BillableItem, as: "billableItem" }],
          transaction: t,
        }
      );

      if (!item) throw new Error("PrescriptionItem not found");
      if (item.status === "cancelled")
        throw new Error("Item is cancelled");
      if (item.status === "dispensed")
        throw new Error("Item already fully dispensed");

      /* 🔒 HARD SAFETY — prevent over-dispense */
      if ((item.dispensed_qty || 0) + qty > item.quantity) {
        throw new Error("Dispense exceeds prescribed quantity");
      }

      /* 🔎 Resolve department stock */
      let deptStock = null;
      if (departmentStockId) {
        deptStock = await db.DepartmentStock.findByPk(
          departmentStockId,
          { transaction: t }
        );
      } else {
        deptStock = await db.DepartmentStock.findOne({
          where: {
            organization_id: item.organization_id,
            facility_id: item.facility_id,
            master_item_id: item.billableItem?.master_item_id,
          },
          transaction: t,
        });
      }

      if (!deptStock) throw new Error("Department stock not found");
      if (deptStock.quantity < qty)
        throw new Error("Insufficient stock in pharmacy");

      /* 🔹 Deduct stock */
      await inventoryService.consumeStock(
        deptStock.id,
        qty,
        pharmacistId,
        t
      );

      /* ❗ NEVER reuse voided transactions */
      let txn = await db.PharmacyTransaction.findOne({
        where: {
          prescription_item_id: item.id,
          status: { [Op.ne]: "voided" },
        },
        transaction: t,
        lock: { level: t.LOCK.UPDATE, of: db.PharmacyTransaction },
      });

      if (!txn) {
        txn = await db.PharmacyTransaction.create(
          {
            organization_id: item.organization_id,
            facility_id: item.facility_id,
            department_id: deptStock.department_id,
            prescription_id: item.prescription_id,
            prescription_item_id: item.id,
            patient_id: item.patient_id,
            department_stock_id: deptStock.id,
            quantity_dispensed: qty,
            type: PHARMACY_TRANSACTION_TYPE.DISPENSE,
            status: qty < item.quantity ? "partially_dispensed" : "dispensed",
            fulfilled_by_id: pharmacistId,
            fulfillment_date: new Date(),
            created_by_id: pharmacistId,
          },
          { transaction: t }
        );
      } else {
        const prevQty = txn.quantity_dispensed || 0;
        const totalTxnQty = prevQty + qty;

        await txn.update(
          {
            department_stock_id: deptStock.id,
            status:
              totalTxnQty < item.quantity
                ? "partially_dispensed"
                : "dispensed",
            fulfilled_by_id: pharmacistId,
            fulfillment_date: new Date(),
            updated_by_id: pharmacistId,
          },
          { transaction: t }
        );
      }

      /* 🔹 Update TOTAL dispensed on prescription item */
      const newTotalDispensed = (item.dispensed_qty || 0) + qty;

      await item.update(
        {
          dispensed_qty: newTotalDispensed,
          dispensed_at: new Date(),
        },
        { transaction: t }
      );

      /* 🔹 Sync prescription + item status (SINGLE SOURCE OF TRUTH) */
      await this.syncPrescriptionStatus(item.id, pharmacistId, t);

      /* 🔔 FINAL GUARANTEE — transaction status is correct */
      let finalTxn = txn;

      if (newTotalDispensed >= item.quantity) {
        await txn.update(
          { status: "dispensed" },
          { transaction: t }
        );

        // 🔄 Reload so controllers & billing see FINAL state
        finalTxn = await db.PharmacyTransaction.findByPk(
          txn.id,
          { transaction: t }
        );
      }

      if (!transaction) await t.commit();
      return finalTxn;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },


  /* ============================================================
     2️⃣ Void Transaction (returns stock + reconciles totals)
  ============================================================ */
  async voidTransaction(transactionId, reason, voidedById, transaction = null) {
    const t = transaction || (await db.sequelize.transaction());
    try {
      const txn = await db.PharmacyTransaction.findByPk(
        transactionId,
        { transaction: t }
      );

      if (!txn) throw new Error("PharmacyTransaction not found");
      if (txn.status === "voided")
        throw new Error("Transaction already voided");

      /* 🔹 Return stock */
      const deptStock = await db.DepartmentStock.findByPk(
        txn.department_stock_id,
        { transaction: t }
      );

      if (deptStock) {
        await deptStock.update(
          { quantity: deptStock.quantity + txn.quantity_dispensed },
          { transaction: t }
        );

        await db.StockLedger.create(
          {
            organization_id: txn.organization_id,
            facility_id: txn.facility_id,
            department_id: txn.department_id,
            master_item_id: deptStock.master_item_id,
            ledger_type: STOCK_LEDGER_TYPE.RETURN_IN,
            quantity: txn.quantity_dispensed,
            balance_after: deptStock.quantity + txn.quantity_dispensed,
            created_by_id: voidedById,
          },
          { transaction: t }
        );
      }

      /* 🔹 Mark transaction as voided */
      await txn.update(
        {
          status: "voided",
          void_reason: reason,
          voided_by_id: voidedById,
          voided_at: new Date(),
        },
        { transaction: t }
      );

      /* 🔁 Recalculate TOTAL dispensed */
      const remainingTxns = await db.PharmacyTransaction.findAll({
        where: {
          prescription_item_id: txn.prescription_item_id,
          status: { [Op.ne]: "voided" },
        },
        transaction: t,
      });

      const recalculatedQty = remainingTxns.reduce(
        (sum, r) => sum + (r.quantity_dispensed || 0),
        0
      );

      await db.PrescriptionItem.update(
        { dispensed_qty: recalculatedQty },
        { where: { id: txn.prescription_item_id }, transaction: t }
      );

      /* 🔹 Re-sync statuses */
      await this.syncPrescriptionStatus(
        txn.prescription_item_id,
        voidedById,
        t
      );

      if (!transaction) await t.commit();
      return txn;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },
};
