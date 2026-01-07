// 📁 inventoryService.js
import { sequelize, CentralStock, StockLedger, StockRequest, StockRequestItem, DepartmentStock, StockReturn, StockAdjustment } from "../models/index.js";
import { STOCK_LEDGER_TYPE, CENTRAL_STOCK_STATUS } from "../constants/enums.js";
import { Op } from "sequelize";

export const inventoryService = {
  /* ============================================================
     1️⃣ Add Stock from Supplier (Procurement → CentralStock)
  ============================================================ */
  async addStockFromSupplier(stockData, userId, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const centralStock = await CentralStock.create(
        { ...stockData, created_by_id: userId },
        { transaction: t }
      );

      await StockLedger.create({
        organization_id: stockData.organization_id,
        facility_id: stockData.facility_id,
        master_item_id: stockData.master_item_id,
        central_stock_id: centralStock.id,
        ledger_type: STOCK_LEDGER_TYPE.PURCHASE,
        quantity: stockData.quantity,
        balance_after: centralStock.quantity,
        created_by_id: userId,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return centralStock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
    2️⃣ Request Stock (Department → Central)
    ✅ Merge duplicates instead of failing on unique constraint
  ============================================================ */
  async requestStock(requestData, items, userId, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const request = await StockRequest.create(
        { ...requestData, created_by_id: userId },
        { transaction: t }
      );

      for (const item of items) {
        const existing = await StockRequestItem.findOne({
          where: {
            stock_request_id: request.id,
            master_item_id: item.master_item_id,
          },
          transaction: t,
        });

        if (existing) {
          // 🔄 Merge quantities if duplicate item exists
          await existing.update(
            {
              quantity: existing.quantity + item.quantity,
              remarks: item.remarks || existing.remarks,
              updated_by_id: userId,
            },
            { transaction: t }
          );
        } else {
          // ➕ Create new request item
          await StockRequestItem.create(
            {
              ...item,
              stock_request_id: request.id,
              organization_id: request.organization_id,
              facility_id: request.facility_id,
              created_by_id: userId,
            },
            { transaction: t }
          );
        }
      }

      if (!transaction) await t.commit();
      return request;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },


  /* ============================================================
     3️⃣ Approve & Issue Stock (Central → Department)
  ============================================================ */
  async approveAndIssueStock(requestId, issuedById, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const request = await StockRequest.findByPk(requestId, {
        include: [{ model: StockRequestItem, as: "items" }],
        transaction: t,
      });
      if (!request) throw new Error("StockRequest not found");

      for (const item of request.items) {
        const central = await CentralStock.findOne({
          where: { master_item_id: item.master_item_id, facility_id: request.facility_id },
          transaction: t,
        });
        if (!central) throw new Error("CentralStock not found for item");
        if (central.quantity < item.quantity) throw new Error("Insufficient stock");

        // Reduce central
        const newCentralQty = central.quantity - item.quantity;
        await central.update({ quantity: newCentralQty }, { transaction: t });

        // Increase department stock
        const [deptStock] = await DepartmentStock.findOrCreate({
          where: {
            organization_id: request.organization_id,
            facility_id: request.facility_id,
            department_id: request.department_id,
            master_item_id: item.master_item_id,
          },
          defaults: { quantity: 0, created_by_id: issuedById },
          transaction: t,
        });
        const newDeptQty = deptStock.quantity + item.quantity;
        await deptStock.update({ quantity: newDeptQty }, { transaction: t });

        // Ledger entries
        await StockLedger.create({
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          master_item_id: item.master_item_id,
          central_stock_id: central.id,
          stock_request_id: request.id,
          stock_request_item_id: item.id,
          ledger_type: STOCK_LEDGER_TYPE.ISSUE_OUT,
          quantity: item.quantity,
          balance_after: newCentralQty,
          created_by_id: issuedById,
        }, { transaction: t });

        await StockLedger.create({
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          department_id: request.department_id,
          master_item_id: item.master_item_id,
          stock_request_id: request.id,
          stock_request_item_id: item.id,
          ledger_type: STOCK_LEDGER_TYPE.ISSUE_IN,
          quantity: item.quantity,
          balance_after: newDeptQty,
          created_by_id: issuedById,
        }, { transaction: t });
      }

      await request.update({
        status: "issued",
        issued_by_id: issuedById,
        issued_at: new Date(),
      }, { transaction: t });

      if (!transaction) await t.commit();
      return request;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     4️⃣ Return Stock (Department → Central)
  ============================================================ */
  async returnStock(returnId, approvedById, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stockReturn = await StockReturn.findByPk(returnId, { transaction: t });
      if (!stockReturn) throw new Error("StockReturn not found");

      // Dept stock
      const deptStock = await DepartmentStock.findOne({
        where: {
          organization_id: stockReturn.organization_id,
          facility_id: stockReturn.facility_id,
          department_id: stockReturn.department_id,
          master_item_id: stockReturn.master_item_id,
        },
        transaction: t,
      });
      if (!deptStock) throw new Error("DepartmentStock not found");
      if (deptStock.quantity < stockReturn.quantity) {
        throw new Error("Return quantity exceeds department stock");
      }

      const newDeptQty = deptStock.quantity - stockReturn.quantity;
      await deptStock.update({ quantity: newDeptQty }, { transaction: t });

      // Central stock
      const central = await CentralStock.findByPk(stockReturn.central_stock_id, { transaction: t });
      if (!central) throw new Error("CentralStock not found");

      const newCentralQty = central.quantity + stockReturn.quantity;
      await central.update({ quantity: newCentralQty }, { transaction: t });

      // Ledger entries
      await StockLedger.create({
        organization_id: stockReturn.organization_id,
        facility_id: stockReturn.facility_id,
        department_id: stockReturn.department_id,
        master_item_id: stockReturn.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.RETURN_OUT,
        quantity: stockReturn.quantity,
        balance_after: newDeptQty,
        created_by_id: approvedById,
      }, { transaction: t });

      await StockLedger.create({
        organization_id: stockReturn.organization_id,
        facility_id: stockReturn.facility_id,
        master_item_id: stockReturn.master_item_id,
        central_stock_id: central.id,
        ledger_type: STOCK_LEDGER_TYPE.RETURN_IN,
        quantity: stockReturn.quantity,
        balance_after: newCentralQty,
        created_by_id: approvedById,
      }, { transaction: t });

      await stockReturn.update({
        status: "approved",
        approved_by_id: approvedById,
        approved_at: new Date(),
      }, { transaction: t });

      if (!transaction) await t.commit();
      return stockReturn;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     5️⃣ Adjust Stock (Central correction)
  ============================================================ */
  async adjustStock(adjustmentId, approvedById, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const adjustment = await StockAdjustment.findByPk(adjustmentId, { transaction: t });
      if (!adjustment) throw new Error("StockAdjustment not found");

      await adjustment.update({
        status: "approved",
        approved_by_id: approvedById,
        approved_at: new Date(),
      }, { transaction: t });

      const central = await CentralStock.findByPk(adjustment.central_stock_id, { transaction: t });

      await StockLedger.create({
        organization_id: adjustment.organization_id,
        facility_id: adjustment.facility_id,
        master_item_id: central.master_item_id,
        central_stock_id: central.id,
        stock_adjustment_id: adjustment.id,
        ledger_type: STOCK_LEDGER_TYPE.ADJUSTMENT,
        quantity: adjustment.quantity,
        balance_after: central.quantity,
        created_by_id: approvedById,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return adjustment;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     6️⃣ Consume Stock (Department usage)
  ============================================================ */
  async consumeStock(deptStockId, qty, userId, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const deptStock = await DepartmentStock.findByPk(deptStockId, { transaction: t });
      if (!deptStock) throw new Error("DepartmentStock not found");
      if (deptStock.quantity < qty) throw new Error("Insufficient department stock");

      const newDeptQty = deptStock.quantity - qty;
      await deptStock.update({ quantity: newDeptQty }, { transaction: t });

      await StockLedger.create({
        organization_id: deptStock.organization_id,
        facility_id: deptStock.facility_id,
        department_id: deptStock.department_id,
        master_item_id: deptStock.master_item_id,
        ledger_type: STOCK_LEDGER_TYPE.CONSUMPTION,
        quantity: qty,
        balance_after: newDeptQty,
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
     7️⃣ Update Stock (manual correction or workflow usage)
  ============================================================ */
  async updateStock(stockId, updates, user, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stock = await CentralStock.findByPk(stockId, { transaction: t });
      if (!stock) throw new Error("CentralStock not found");
      if (stock.is_locked) throw new Error("Stock is locked and cannot be updated");

      // 🚫 Restrict unsafe fields
      const safeUpdates = { ...updates };
      delete safeUpdates.status;
      delete safeUpdates.is_locked;

      const oldQty = stock.quantity;

      // 🔹 Apply update
      await stock.update({ ...safeUpdates, updated_by_id: user.id }, { transaction: t });

      // 📝 If quantity updated, compute diff safely
      if (safeUpdates.quantity !== undefined) {
        await stock.reload({ transaction: t }); // refresh after literal update
        const newQty = stock.quantity;
        const qtyDiff = newQty - oldQty;

        await StockLedger.create({
          organization_id: stock.organization_id,
          facility_id: stock.facility_id,
          master_item_id: stock.master_item_id,
          central_stock_id: stock.id,
          ledger_type: STOCK_LEDGER_TYPE.ADJUSTMENT,
          quantity: qtyDiff,
          balance_after: newQty,
          created_by_id: user.id,
        }, { transaction: t });
      }

      if (!transaction) await t.commit();
      return stock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
    8️⃣ Toggle Stock Status (fixed for enum object)
  ============================================================ */
  async toggleStockStatus(stockId, user, explicitStatus = null, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stock = await CentralStock.findByPk(stockId, { transaction: t });
      if (!stock) throw new Error("CentralStock not found");
      if (stock.is_locked) throw new Error("Stock is locked");

      // ✅ Safe toggle logic for enum object
      const currentStatus = (stock.status || "").toLowerCase();
      let newStatus = explicitStatus;

      if (!newStatus) {
        newStatus =
          currentStatus === CENTRAL_STOCK_STATUS.ACTIVE
            ? CENTRAL_STOCK_STATUS.INACTIVE
            : CENTRAL_STOCK_STATUS.ACTIVE;
      }

      await stock.update({ status: newStatus, updated_by_id: user.id }, { transaction: t });

      await StockLedger.create({
        organization_id: stock.organization_id,
        facility_id: stock.facility_id,
        master_item_id: stock.master_item_id,
        central_stock_id: stock.id,
        ledger_type: STOCK_LEDGER_TYPE.STATUS_CHANGE,
        quantity: 0,
        balance_after: stock.quantity,
        created_by_id: user.id,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return stock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },


  /* ============================================================
     9️⃣ Restore Stock
  ============================================================ */
  async restoreStock(stockId, user, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stock = await CentralStock.findByPk(stockId, { paranoid: false, transaction: t });
      if (!stock) throw new Error("CentralStock not found");
      if (!stock.deleted_at) throw new Error("Stock is not deleted");
      if (stock.is_locked) throw new Error("Stock is locked");

      await stock.restore({ transaction: t });
      await stock.update({ updated_by_id: user.id }, { transaction: t });

      await StockLedger.create({
        organization_id: stock.organization_id,
        facility_id: stock.facility_id,
        master_item_id: stock.master_item_id,
        central_stock_id: stock.id,
        ledger_type: STOCK_LEDGER_TYPE.RESTORE,
        quantity: 0,
        balance_after: stock.quantity,
        created_by_id: user.id,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return stock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     🔟 Delete Stock (soft delete)
  ============================================================ */
  async deleteStock(stockId, user, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stock = await CentralStock.findByPk(stockId, { transaction: t });
      if (!stock) throw new Error("CentralStock not found");
      if (stock.is_locked) throw new Error("Stock is locked");

      await stock.update({ deleted_by_id: user.id }, { transaction: t });
      await stock.destroy({ transaction: t });

      await StockLedger.create({
        organization_id: stock.organization_id,
        facility_id: stock.facility_id,
        master_item_id: stock.master_item_id,
        central_stock_id: stock.id,
        ledger_type: STOCK_LEDGER_TYPE.WRITE_OFF,
        quantity: stock.quantity,
        balance_after: 0,
        created_by_id: user.id,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return stock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     1️⃣1️⃣ Lock Stock
  ============================================================ */
  async lockStock(stockId, user, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stock = await CentralStock.findByPk(stockId, { transaction: t });
      if (!stock) throw new Error("CentralStock not found");
      if (stock.is_locked) throw new Error("Already locked");

      await stock.update({ is_locked: true, updated_by_id: user.id }, { transaction: t });

      await StockLedger.create({
        organization_id: stock.organization_id,
        facility_id: stock.facility_id,
        master_item_id: stock.master_item_id,
        central_stock_id: stock.id,
        ledger_type: STOCK_LEDGER_TYPE.LOCK,
        quantity: 0,
        balance_after: stock.quantity,
        created_by_id: user.id,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return stock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     1️⃣2️⃣ Unlock Stock
  ============================================================ */
  async unlockStock(stockId, user, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stock = await CentralStock.findByPk(stockId, { transaction: t });
      if (!stock) throw new Error("CentralStock not found");
      if (!stock.is_locked) throw new Error("Not locked");

      await stock.update({ is_locked: false, updated_by_id: user.id }, { transaction: t });

      await StockLedger.create({
        organization_id: stock.organization_id,
        facility_id: stock.facility_id,
        master_item_id: stock.master_item_id,
        central_stock_id: stock.id,
        ledger_type: STOCK_LEDGER_TYPE.UNLOCK,
        quantity: 0,
        balance_after: stock.quantity,
        created_by_id: user.id,
      }, { transaction: t });

      if (!transaction) await t.commit();
      return stock;
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
    1️⃣3️⃣ Bulk Toggle Stock Status (fixed for enum object)
  ============================================================ */
  async bulkToggleStockStatus(ids, user, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stocks = await CentralStock.findAll({
        where: { id: { [Op.in]: ids } },
        transaction: t,
      });
      if (stocks.length === 0) throw new Error("No matching stocks");

      const toggled = [];
      const skipped = [];
      const ledgerEntries = [];

      for (const stock of stocks) {
        if (stock.is_locked) {
          skipped.push({ id: stock.id, reason: "Locked" });
          continue;
        }

        const currentStatus = (stock.status || "").toLowerCase();
        const newStatus =
          currentStatus === CENTRAL_STOCK_STATUS.ACTIVE
            ? CENTRAL_STOCK_STATUS.INACTIVE
            : CENTRAL_STOCK_STATUS.ACTIVE;

        await stock.update({ status: newStatus, updated_by_id: user.id }, { transaction: t });

        ledgerEntries.push({
          organization_id: stock.organization_id,
          facility_id: stock.facility_id,
          master_item_id: stock.master_item_id,
          central_stock_id: stock.id,
          ledger_type: STOCK_LEDGER_TYPE.STATUS_CHANGE,
          quantity: 0,
          balance_after: stock.quantity,
          created_by_id: user.id,
        });

        toggled.push({ id: stock.id, from: stock.status, to: newStatus });
      }

      if (ledgerEntries.length > 0) {
        await StockLedger.bulkCreate(ledgerEntries, { transaction: t });
      }

      if (!transaction) await t.commit();
      return { toggled, skipped };
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },
  /* ============================================================
     1️⃣4️⃣ Bulk Restore Stocks
  ============================================================ */
  async bulkRestoreStocks(ids, user, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stocks = await CentralStock.findAll({
        where: { id: { [Op.in]: ids } },
        transaction: t,
        paranoid: false,
      });
      if (stocks.length === 0) throw new Error("No matching stocks");

      const restored = [];
      const skipped = [];
      const ledgerEntries = [];

      for (const stock of stocks) {
        if (!stock.deleted_at) {
          skipped.push({ id: stock.id, reason: "Not deleted" });
          continue;
        }
        if (stock.is_locked) {
          skipped.push({ id: stock.id, reason: "Locked" });
          continue;
        }

        await stock.restore({ transaction: t });
        await stock.update({ updated_by_id: user.id }, { transaction: t });

        ledgerEntries.push({
          organization_id: stock.organization_id,
          facility_id: stock.facility_id,
          master_item_id: stock.master_item_id,
          central_stock_id: stock.id,
          ledger_type: STOCK_LEDGER_TYPE.RESTORE,
          quantity: 0,
          balance_after: stock.quantity,
          created_by_id: user.id,
        });

        restored.push(stock);
      }

      if (ledgerEntries.length > 0) {
        await StockLedger.bulkCreate(ledgerEntries, { transaction: t });
      }

      if (!transaction) await t.commit();
      return { restored, skipped };
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },

  /* ============================================================
     1️⃣5️⃣ Bulk Delete Stocks
  ============================================================ */
  async bulkDeleteStocks(ids, user, transaction = null) {
    const t = transaction || await sequelize.transaction();
    try {
      const stocks = await CentralStock.findAll({ where: { id: { [Op.in]: ids } }, transaction: t });
      if (stocks.length === 0) throw new Error("No matching stocks");

      const deleted = [];
      const skipped = [];
      const ledgerEntries = [];

      for (const stock of stocks) {
        if (stock.is_locked) {
          skipped.push({ id: stock.id, reason: "Locked" });
          continue;
        }

        await stock.update({ deleted_by_id: user.id }, { transaction: t });
        await stock.destroy({ transaction: t });

        ledgerEntries.push({
          organization_id: stock.organization_id,
          facility_id: stock.facility_id,
          master_item_id: stock.master_item_id,
          central_stock_id: stock.id,
          ledger_type: STOCK_LEDGER_TYPE.WRITE_OFF,
          quantity: stock.quantity,
          balance_after: 0,
          created_by_id: user.id,
        });

        deleted.push(stock);
      }

      if (ledgerEntries.length > 0) {
        await StockLedger.bulkCreate(ledgerEntries, { transaction: t });
      }

      if (!transaction) await t.commit();
      return { deleted, skipped };
    } catch (err) {
      if (!transaction) await t.rollback();
      throw err;
    }
  },
};
