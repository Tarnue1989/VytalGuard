// 📁 services/stockService.js
import { Op } from "sequelize";
import {
  sequelize,
  DepartmentStock,
  StockAdjustment,
  StockRequest,
  StockRequestItem,
  StockReturn,
  CentralStock,
  StockLedger,
  MasterItem
} from "../models/index.js";
import {
  STOCK_REQUEST_STATUS,
  STOCK_REQUEST_ITEM_STATUS,
  STOCK_RETURN_STATUS,
  STOCK_LEDGER_TYPE,
  DEPARTMENT_STOCK_STATUS,
} from "../constants/enums.js";

import { inventoryService } from "./inventoryService.js";

/* ============================================================
   1️⃣ Handle Stock Adjustments (workflow-level)
============================================================ */
export async function approveAdjustment(adjustmentId, userId) {
  return sequelize.transaction(async (t) => {
    const adj = await StockAdjustment.findByPk(adjustmentId, { transaction: t });
    if (!adj) throw new Error("StockAdjustment not found");
    if (adj.status !== "draft") throw new Error("Only draft adjustments can be approved");

    adj.status = "approved";
    adj.approved_by_id = userId;
    adj.approved_at = new Date();
    await adj.save({ transaction: t });

    await inventoryService.adjustStock(adj.id, userId, t);
    return adj;
  });
}

/* ============================================================
   2️⃣ Handle Stock Requests (Issuance - Whole Request)
============================================================ */
export async function issueStock(requestId, userId) {
  return sequelize.transaction(async (t) => {
    const request = await StockRequest.findByPk(requestId, {
      include: [
        { 
          model: StockRequestItem, 
          as: "items",
          include: [{ model: MasterItem, as: "masterItem", attributes: ["id", "name", "code"] }]
        }
      ],
      transaction: t,
    });

    if (!request) throw new Error("❌ StockRequest not found");
    if (request.status !== STOCK_REQUEST_STATUS.APPROVED) {
      throw new Error("❌ Only approved requests can be issued");
    }

    for (const item of request.items) {
      let remaining = item.quantity;
      const itemName = item.masterItem?.name || `Item#${item.master_item_id}`;

      // ✅ FEFO: active, unlocked, not expired, with stock
      const centralStocks = await CentralStock.findAll({
        where: {
          master_item_id: item.master_item_id,
          facility_id: request.facility_id,
          quantity: { [Op.gt]: 0 },
          is_locked: false,
          status: "active",
          [Op.or]: [
            { expiry_date: null },
            { expiry_date: { [Op.gt]: new Date() } },
          ],
        },
        order: [["expiry_date", "ASC NULLS LAST"]],
        transaction: t,
      });

      if (!centralStocks.length) {
        throw new Error(`❌ No available central stock for ${itemName}`);
      }

      for (const stock of centralStocks) {
        if (remaining <= 0) break;
        const deduct = Math.min(stock.quantity, remaining);

        // 🔹 Reduce central
        await inventoryService.updateStock(
          stock.id,
          { quantity: sequelize.literal(`quantity - ${deduct}`) },
          { id: userId },
          t
        );
        await stock.reload({ transaction: t });

        // 🔹 Ensure department stock exists
        let deptStock = await DepartmentStock.findOne({
          where: {
            organization_id: request.organization_id,
            facility_id: request.facility_id,
            department_id: request.department_id,
            master_item_id: item.master_item_id,
          },
          transaction: t,
        });

        if (!deptStock) {
          deptStock = await DepartmentStock.create({
            organization_id: request.organization_id,
            facility_id: request.facility_id,
            department_id: request.department_id,
            master_item_id: item.master_item_id,
            quantity: 0,
            status: DEPARTMENT_STOCK_STATUS.ACTIVE,
            created_by_id: userId,
          }, { transaction: t });
        }

        const newDeptQty = deptStock.quantity + deduct;
        await deptStock.update({ quantity: newDeptQty }, { transaction: t });

        // 🔹 Ledger: central out
        await StockLedger.create({
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          master_item_id: item.master_item_id,
          central_stock_id: stock.id,
          stock_request_id: request.id,
          stock_request_item_id: item.id,
          ledger_type: STOCK_LEDGER_TYPE.ISSUE_OUT,
          quantity: deduct,
          balance_after: stock.quantity,
          created_by_id: userId,
        }, { transaction: t });

        // 🔹 Ledger: dept in
        await StockLedger.create({
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          department_id: request.department_id,
          master_item_id: item.master_item_id,
          stock_request_id: request.id,
          stock_request_item_id: item.id,
          ledger_type: STOCK_LEDGER_TYPE.ISSUE_IN,
          quantity: deduct,
          balance_after: newDeptQty,
          created_by_id: userId,
        }, { transaction: t });

        // 🔹 Link first batch to request item
        if (!item.central_stock_id) {
          await item.update({ central_stock_id: stock.id }, { transaction: t });
        }

        remaining -= deduct;
      }

      if (remaining > 0) {
        throw new Error(`❌ Not enough central stock to fulfill ${itemName}. Needed ${item.quantity}, short by ${remaining}`);
      }

      await item.update({
        issued_quantity: item.quantity,
        status: STOCK_REQUEST_ITEM_STATUS.ISSUED,
        issued_by_id: userId,
        issued_at: new Date(),
      }, { transaction: t });
    }

    await request.update(
      { status: STOCK_REQUEST_STATUS.ISSUED, issued_by_id: userId, issued_at: new Date() },
      { transaction: t }
    );

    return request;
  });
}

/* ============================================================
   2️⃣b Handle Stock Requests (Issuance - Single Item)
============================================================ */
export async function issueStockItem(itemId, userId) {
  return sequelize.transaction(async (t) => {
    const item = await StockRequestItem.findByPk(itemId, {
      include: [
        { model: StockRequest, as: "stockRequest" },
        { model: MasterItem, as: "masterItem", attributes: ["id", "name", "code"] },
      ],
      transaction: t,
    });

    if (!item) throw new Error("❌ StockRequestItem not found");
    if (!item.stockRequest) throw new Error("❌ Parent StockRequest not found");

    const request = item.stockRequest;
    const itemName = item.masterItem?.name || `Item#${item.master_item_id}`;

    if (request.status !== STOCK_REQUEST_STATUS.APPROVED) {
      throw new Error("❌ Only items from approved requests can be issued");
    }

    if (![STOCK_REQUEST_ITEM_STATUS.PENDING, STOCK_REQUEST_ITEM_STATUS.APPROVED].includes(item.status)) {
      throw new Error(`❌ ${itemName} is not in a state that allows issuance`);
    }

    let remaining = item.quantity;

    // ✅ FEFO: active, unlocked, not expired, with stock
    const centralStocks = await CentralStock.findAll({
      where: {
        master_item_id: item.master_item_id,
        facility_id: request.facility_id,
        quantity: { [Op.gt]: 0 },
        is_locked: false,
        status: "active",
        [Op.or]: [
          { expiry_date: null },
          { expiry_date: { [Op.gt]: new Date() } },
        ],
      },
      order: [["expiry_date", "ASC NULLS LAST"]],
      transaction: t,
    });

    if (!centralStocks.length) {
      throw new Error(`❌ No available central stock for ${itemName}`);
    }

    for (const stock of centralStocks) {
      if (remaining <= 0) break;
      const deduct = Math.min(stock.quantity, remaining);

      // 🔹 Deduct from central
      await inventoryService.updateStock(
        stock.id,
        { quantity: sequelize.literal(`quantity - ${deduct}`) },
        { id: userId },
        t
      );
      await stock.reload({ transaction: t });

      // 🔹 Ensure dept stock exists
      let deptStock = await DepartmentStock.findOne({
        where: {
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          department_id: request.department_id,
          master_item_id: item.master_item_id,
        },
        transaction: t,
      });

      if (!deptStock) {
        deptStock = await DepartmentStock.create({
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          department_id: request.department_id,
          master_item_id: item.master_item_id,
          quantity: 0,
          status: DEPARTMENT_STOCK_STATUS.ACTIVE,
          created_by_id: userId,
        }, { transaction: t });
      }

      const newDeptQty = deptStock.quantity + deduct;
      await deptStock.update({ quantity: newDeptQty }, { transaction: t });

      // 🔹 Ledger entries
      await StockLedger.create({
        organization_id: request.organization_id,
        facility_id: request.facility_id,
        master_item_id: item.master_item_id,
        central_stock_id: stock.id,
        stock_request_id: request.id,
        stock_request_item_id: item.id,
        ledger_type: STOCK_LEDGER_TYPE.ISSUE_OUT,
        quantity: deduct,
        balance_after: stock.quantity,
        created_by_id: userId,
      }, { transaction: t });

      await StockLedger.create({
        organization_id: request.organization_id,
        facility_id: request.facility_id,
        department_id: request.department_id,
        master_item_id: item.master_item_id,
        stock_request_id: request.id,
        stock_request_item_id: item.id,
        ledger_type: STOCK_LEDGER_TYPE.ISSUE_IN,
        quantity: deduct,
        balance_after: newDeptQty,
        created_by_id: userId,
      }, { transaction: t });

      // 🔹 Link first batch
      if (!item.central_stock_id) {
        await item.update({ central_stock_id: stock.id }, { transaction: t });
      }

      remaining -= deduct;
    }

    if (remaining > 0) {
      throw new Error(
        `❌ Not enough central stock to fulfill ${itemName}. Needed ${item.quantity}, short by ${remaining}`
      );
    }

    // ✅ Update item
    await item.update({
      issued_quantity: item.quantity,
      status: STOCK_REQUEST_ITEM_STATUS.ISSUED,
      issued_by_id: userId,
      issued_at: new Date(),
    }, { transaction: t });

    // ✅ If all items issued, mark parent request as issued
    const remainingItems = await StockRequestItem.count({
      where: {
        stock_request_id: request.id,
        status: { [Op.not]: STOCK_REQUEST_ITEM_STATUS.ISSUED },
      },
      transaction: t,
    });
    if (remainingItems === 0) {
      await request.update(
        { status: STOCK_REQUEST_STATUS.ISSUED, issued_by_id: userId, issued_at: new Date() },
        { transaction: t }
      );
    }

    return item;
  });
}

/* ============================================================
   3️⃣ Handle Stock Returns
============================================================ */
export async function approveReturn(returnId, userId) {
  return sequelize.transaction(async (t) => {
    const ret = await StockReturn.findByPk(returnId, { transaction: t });
    if (!ret) throw new Error("StockReturn not found");
    if (ret.status !== STOCK_RETURN_STATUS.PENDING) {
      throw new Error("Only pending returns can be approved");
    }

    const deptStock = await DepartmentStock.findOne({
      where: {
        organization_id: ret.organization_id,
        facility_id: ret.facility_id,
        department_id: ret.department_id,
        master_item_id: ret.master_item_id,
      },
      transaction: t,
    });

    if (!deptStock || deptStock.quantity < ret.quantity) {
      throw new Error("Insufficient department stock to return");
    }

    const newDeptQty = deptStock.quantity - ret.quantity;
    await deptStock.update({ quantity: newDeptQty }, { transaction: t });

    if (ret.central_stock_id) {
      await inventoryService.updateStock(
        ret.central_stock_id,
        { quantity: sequelize.literal(`quantity + ${ret.quantity}`) },
        { id: userId },
        t
      );
    }

    await ret.update(
      { status: "approved", approved_by_id: userId, approved_at: new Date() },
      { transaction: t }
    );

    return ret;
  });
}

export const stockService = {
  approveAdjustment,
  issueStock,
  issueStockItem,
  approveReturn,
};
