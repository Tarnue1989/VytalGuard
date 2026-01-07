// ============================================================
// 🔹 Department Stock Service (Enterprise-Grade)
// ============================================================

import db from "../models/index.js";
import { STOCK_LEDGER_TYPE, DEPARTMENT_STOCK_STATUS } from "../constants/enums.js";

export const departmentStockService = {
  /* ============================================================
     0️⃣ Create Stock
  ============================================================ */
  async createStock(stockData, userId, transaction = null) {
    const t = transaction || await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.create(
        { ...stockData, created_by_id: userId },
        { transaction: t }
      );

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.ISSUE_IN,
        quantity: deptStock.quantity,
        balance_after: deptStock.quantity,
        created_by_id: userId,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return deptStock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     0️⃣ Update Stock
  ============================================================ */
  async updateStock(id, values, user) {
    const t = await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.findByPk(id, { transaction: t });
      if (!deptStock) throw new Error("Department stock not found");
      if (deptStock.status === DEPARTMENT_STOCK_STATUS[1]) {
        throw new Error("Stock is locked and cannot be updated");
      }

      await deptStock.update({ ...values, updated_by_id: user.id }, { transaction: t });

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.STATUS_CHANGE,
        quantity: 0,
        balance_after: deptStock.quantity,
        created_by_id: user.id,
      }, { transaction: t });

      await t.commit();
      return deptStock;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     0️⃣ Toggle Status
  ============================================================ */
  async toggleStatus(id, user, newStatus = null) {
    const t = await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.findByPk(id, { transaction: t });
      if (!deptStock) throw new Error("Department stock not found");

      const targetStatus = newStatus || (deptStock.status === "active" ? "inactive" : "active");
      await deptStock.update({ status: targetStatus, updated_by_id: user.id }, { transaction: t });

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.STATUS_CHANGE,
        quantity: 0,
        balance_after: deptStock.quantity,
        created_by_id: user.id,
      }, { transaction: t });

      await t.commit();
      return deptStock;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     0️⃣ Delete Stock (Soft Delete)
  ============================================================ */
  async deleteStock(id, user) {
    const t = await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.findByPk(id, { transaction: t });
      if (!deptStock) throw new Error("Department stock not found");

      await deptStock.update({ deleted_by_id: user.id }, { transaction: t });
      await deptStock.destroy({ transaction: t });

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.WRITE_OFF,
        quantity: 0,
        balance_after: deptStock.quantity,
        created_by_id: user.id,
      }, { transaction: t });

      await t.commit();
      return deptStock;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     1️⃣ Increase Stock
  ============================================================ */
  async increaseStock(departmentStockId, qty, userId, transaction = null, ledgerType = STOCK_LEDGER_TYPE.ISSUE_IN) {
    const t = transaction || await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.findByPk(departmentStockId, { transaction: t });
      if (!deptStock) throw new Error("Department stock not found");

      const newQty = deptStock.quantity + qty;
      await deptStock.update({ quantity: newQty }, { transaction: t });

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: ledgerType,
        quantity: qty,
        balance_after: newQty,
        created_by_id: userId,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return deptStock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     2️⃣ Decrease Stock
  ============================================================ */
  async decreaseStock(departmentStockId, qty, userId, transaction = null, ledgerType = STOCK_LEDGER_TYPE.CONSUMPTION) {
    const t = transaction || await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.findByPk(departmentStockId, { transaction: t });
      if (!deptStock) throw new Error("Department stock not found");
      if (deptStock.quantity < qty) throw new Error("Insufficient stock in department");

      const newQty = deptStock.quantity - qty;
      await deptStock.update({ quantity: newQty }, { transaction: t });

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: ledgerType,
        quantity: qty,
        balance_after: newQty,
        created_by_id: userId,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return deptStock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     3️⃣ Adjust Stock
  ============================================================ */
  async adjustStock(departmentStockId, qty, userId, transaction = null) {
    const t = transaction || await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.findByPk(departmentStockId, { transaction: t });
      if (!deptStock) throw new Error("Department stock not found");

      await deptStock.update({ quantity: qty }, { transaction: t });

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.ADJUSTMENT,
        quantity: qty,
        balance_after: qty,
        created_by_id: userId,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return deptStock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     4️⃣ Lock Stock
  ============================================================ */
  async lockStock(departmentStockId, userId, transaction = null) {
    const t = transaction || await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.findByPk(departmentStockId, { transaction: t });
      if (!deptStock) throw new Error("Department stock not found");

      await deptStock.update({ status: DEPARTMENT_STOCK_STATUS[1] }, { transaction: t });

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.LOCK,
        quantity: 0,
        balance_after: deptStock.quantity,
        created_by_id: userId,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return deptStock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     5️⃣ Unlock Stock
  ============================================================ */
  async unlockStock(departmentStockId, userId, transaction = null) {
    const t = transaction || await db.sequelize.transaction();
    try {
      const deptStock = await db.DepartmentStock.findByPk(departmentStockId, { transaction: t });
      if (!deptStock) throw new Error("Department stock not found");

      await deptStock.update({ status: DEPARTMENT_STOCK_STATUS[0] }, { transaction: t });

      await db.StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        department_stock_id: deptStock.id,
        master_item_id: deptStock.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.UNLOCK,
        quantity: 0,
        balance_after: deptStock.quantity,
        created_by_id: userId,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return deptStock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     🔄 BULK OPERATIONS
  ============================================================ */
  async bulkUpdateStocks(payloads, user) {
    const updated = [], skipped = [];
    for (const payload of payloads) {
      try {
        const record = await this.updateStock(payload.id, payload, user);
        updated.push(record);
      } catch (err) {
        skipped.push({ id: payload.id, reason: err.message });
      }
    }
    return { updated, skipped };
  },

  async bulkDeleteStocks(ids, user) {
    const deleted = [], skipped = [];
    for (const id of ids) {
      try {
        const record = await this.deleteStock(id, user);
        deleted.push(record);
      } catch (err) {
        skipped.push({ id, reason: err.message });
      }
    }
    return { deleted, skipped };
  },

  async bulkToggleStatus(ids, user) {
    const toggled = [], skipped = [];
    for (const id of ids) {
      try {
        const record = await this.toggleStatus(id, user);
        toggled.push(record);
      } catch (err) {
        skipped.push({ id, reason: err.message });
      }
    }
    return { toggled, skipped };
  },
};
