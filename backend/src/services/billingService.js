// 📁 backend/src/services/billingService.js
import {
  sequelize,
  AutoBillingRule,
  BillableItem,
  BillableItemPriceHistory,
  Invoice,
  InvoiceItem,
  LabRequestItem,
} from "../models/index.js";
import { logger } from "../utils/logger.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";
import { getTaxRate } from "../constants/tax.js";           // ✅ Liberia tax constants
import { shouldTriggerBilling } from "../constants/billing.js"; // ✅ Consistent static import

/**
 * billingService – Enterprise-grade auto billing engine (now item-aware)
 */
export const billingService = {
  /**
   * Trigger auto billing for a module/entity (legacy: single entity → one invoice item)
   */
  async triggerAutoBilling({ module, entity, user, transaction }) {
    logger.info(
      `[billingService] ▶️ triggerAutoBilling | module=${module}, entityId=${entity?.id}, patient=${entity?.patient_id}`
    );

    if (!entity?.patient_id) {
      logger.warn(`[billingService] ❌ Skipped: No patient_id on entity for module=${module}, entity=${entity?.id}`);
      return null;
    }

    // 1️⃣ Find active auto-billing rule
    const rule = await AutoBillingRule.findOne({
      where: {
        trigger_module: module,
        organization_id: user.organization_id,
        facility_id: user.facility_id,
        status: "active",
      },
      include: [{ model: BillableItem, as: "billableItem" }],
      transaction,
    });

    if (!rule) {
      logger.info(`[billingService] ⚠️ No active auto-billing rule for module=${module}`);
      return null;
    }

    const billableItem = rule.billableItem;
    if (!billableItem) throw new Error(`[billingService] AutoBillingRule=${rule.id} has no linked BillableItem`);

    // 2️⃣ Determine price
    let price = rule.default_price || billableItem.price;
    if (!price) {
      const latest = await BillableItemPriceHistory.findOne({
        where: { billable_item_id: billableItem.id },
        order: [["effective_date", "DESC"]],
        transaction,
      });
      if (latest) price = latest.new_price;
    }
    if (!price) throw new Error(`[billingService] No valid price found for BillableItem=${billableItem.id}`);

    // 3️⃣ Find or create invoice
    const allowedReuseStatuses = ["draft", "issued", "unpaid", "partial"];
    let invoice = await Invoice.findOne({
      where: {
        patient_id: entity.patient_id,
        organization_id: user.organization_id,
        facility_id: user.facility_id,
        status: allowedReuseStatuses,
        is_locked: false,
      },
      transaction,
    });

    if (!invoice) {
      invoice = await Invoice.create(
        {
          patient_id: entity.patient_id,
          organization_id: user.organization_id,
          facility_id: user.facility_id,
          status: "draft",
          currency: billableItem.currency || "USD",
          total: 0,
          total_paid: 0,
          balance: 0,
          created_by_id: user.id,
        },
        { transaction }
      );
    }

    // 4️⃣ Create invoice item
    const taxRate = billableItem.taxable ? getTaxRate("GST") : 0; // 🇱🇷 Liberia GST
    const taxAmount = billableItem.taxable ? parseFloat(price) * (taxRate / 100) : 0;

    const item = await InvoiceItem.create(
      {
        invoice_id: invoice.id,
        billable_item_id: billableItem.id,
        organization_id: user.organization_id,
        facility_id: user.facility_id,
        description: billableItem.name,
        unit_price: price,
        quantity: 1,
        discount_amount: 0,
        tax_amount: taxAmount,
        total_price: parseFloat(price),
        net_amount: parseFloat(price) + taxAmount,
        module,
        entity_id: entity.id,
        created_by_id: user.id,
        status: "applied",
      },
      { transaction }
    );

    // 5️⃣ Recalculate invoice totals (via util)
    await recalcInvoice(invoice.id, transaction);

    logger.info(
      `[billingService] ✅ Auto-billed ${billableItem.name} | invoice=${invoice.id}, item=${item.id}, price=${price}, tax=${taxAmount}`
    );

    return { invoice, item };
  },

  /**
   * 🔥 Bill all LabRequestItems for a given LabRequest
   */
  async billLabRequestItems({ labRequest, user, transaction }) {
    logger.info(`[billingService] ▶️ billLabRequestItems | requestId=${labRequest.id}`);

    if (!labRequest?.patient_id) {
      throw new Error(`[billingService] ❌ LabRequest missing patient_id`);
    }

    const items = await LabRequestItem.findAll({
      where: { lab_request_id: labRequest.id },
      include: [{ model: BillableItem, as: "labTest" }],
      transaction,
    });

    if (!items.length) {
      logger.info(`[billingService] ⚠️ No LabRequestItems found for request=${labRequest.id}`);
      return null;
    }

    // Find or create invoice once
    const allowedReuseStatuses = ["draft", "issued", "unpaid", "partial"];
    let invoice = await Invoice.findOne({
      where: {
        patient_id: labRequest.patient_id,
        organization_id: user.organization_id,
        facility_id: user.facility_id,
        status: allowedReuseStatuses,
        is_locked: false,
      },
      transaction,
    });

    if (!invoice) {
      invoice = await Invoice.create(
        {
          patient_id: labRequest.patient_id,
          organization_id: user.organization_id,
          facility_id: user.facility_id,
          status: "draft",
          currency: "USD",
          total: 0,
          total_paid: 0,
          balance: 0,
          created_by_id: user.id,
        },
        { transaction }
      );
    }

    const invoiceItems = [];
    for (const li of items) {
      if (!li.labTest) continue;

      const price = li.labTest.price || 0;
      const taxRate = li.labTest.taxable ? getTaxRate("GST") : 0;
      const taxAmount = li.labTest.taxable ? parseFloat(price) * (taxRate / 100) : 0;

      const invItem = await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          billable_item_id: li.labTest.id,
          organization_id: user.organization_id,
          facility_id: user.facility_id,
          description: li.labTest.name,
          unit_price: price,
          quantity: 1,
          discount_amount: 0,
          tax_amount: taxAmount,
          total_price: parseFloat(price),
          net_amount: parseFloat(price) + taxAmount,
          module: "lab_request_item",
          entity_id: li.id,
          created_by_id: user.id,
          status: "applied",
        },
        { transaction }
      );

      await li.update({ invoice_item_id: invItem.id }, { transaction });
      invoiceItems.push(invItem);
    }

    // Recalc totals (via util)
    await recalcInvoice(invoice.id, transaction);

    logger.info(
      `[billingService] ✅ Auto-billed ${invoiceItems.length} LabRequestItems | invoice=${invoice.id}`
    );

    return { invoice, items: invoiceItems };
  },

  /**
   * Void charges for a module/entity
   */
  async voidCharges({ module, entityId, user, transaction }) {
    logger.info(`[billingService] ▶️ voidCharges | module=${module}, entity=${entityId}`);

    const items = await InvoiceItem.findAll({
      where: { module, entity_id: entityId, status: "applied" },
      transaction,
    });

    if (!items.length) {
      logger.info(`[billingService] ⚠️ No invoice items to void for module=${module}, entity=${entityId}`);
      return null;
    }

    for (const item of items) {
      await item.update({ status: "voided", updated_by_id: user.id }, { transaction });
      logger.info(`[billingService] Voided item=${item.id}`);
    }

    // Recalc invoices
    const affectedInvoiceIds = [...new Set(items.map(i => i.invoice_id))];
    for (const invoiceId of affectedInvoiceIds) {
      await recalcInvoice(invoiceId, transaction);
    }

    return items;
  },

  /**
   * 🧾 Retrieve all invoices (and their items) for a specific patient
   * Used by patientChartService → buildFullChart()
   */
  async getInvoicesByPatient(patientId, user) {
    try {
      const invoices = await Invoice.findAll({
        where: {
          patient_id: patientId,
          organization_id: user.organization_id,
          facility_id: user.facility_id,
        },
        include: [
          {
            model: InvoiceItem,
            as: "items",
            include: [
              {
                model: LabRequestItem,
                as: "labRequestItems",
                required: false,
              },
            ],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      return invoices;
    } catch (error) {
      logger.error("[billingService.getInvoicesByPatient]", error);
      return [];
    }
  },
  /**
   * 💊 Bill a Pharmacy Transaction (dispensed or partially_dispensed)
   * - Creates/links invoice & invoice item
   * - Triggers recalcInvoice()
   * - 🔒 Quantity source: PrescriptionItem.dispensed_qty (SINGLE SOURCE OF TRUTH)
   */
  async billPharmacyTransaction({ transaction, user, sequelizeTransaction }) {
    try {
      logger.info(
        `[billingService] ▶️ billPharmacyTransaction | txn=${transaction.id}, status=${transaction.status}`
      );

      // ✅ Status gate
      const shouldBill = shouldTriggerBilling(
        "pharmacy-transaction",
        transaction.status
      );
      if (!shouldBill) {
        logger.info(
          `[billingService] ⚠️ Skipped billing for txn=${transaction.id}, invalid status=${transaction.status}`
        );
        return null;
      }

      // ✅ Must have patient
      if (!transaction.patient_id) {
        logger.warn(
          `[billingService] ❌ Skipped: No patient_id for pharmacy txn=${transaction.id}`
        );
        return null;
      }

      // 🔒 SINGLE SOURCE OF TRUTH
      const presItem = await sequelize.models.PrescriptionItem.findByPk(
        transaction.prescription_item_id,
        {
          include: [
            {
              model: sequelize.models.BillableItem,
              as: "billableItem",
            },
          ],
          transaction: sequelizeTransaction,
        }
      );

      if (!presItem?.billableItem) {
        logger.warn(
          `[billingService] ⚠️ No BillableItem linked for txn=${transaction.id}`
        );
        return null;
      }

      const totalDispensed = Number(presItem.dispensed_qty || 0);

      // 🔒 HARD STOP — nothing to bill
      if (totalDispensed <= 0) {
        logger.warn(
          `[billingService] ❌ Skip billing: dispensed_qty=0 for txn=${transaction.id}`
        );
        return null;
      }

      const billableItem = presItem.billableItem;
      const price = Number(billableItem.price || 0);
      const taxRate = billableItem.taxable ? getTaxRate("GST") : 0;
      const taxAmountPerUnit = billableItem.taxable
        ? price * (taxRate / 100)
        : 0;

      // ✅ Find or create invoice
      const allowedReuseStatuses = ["draft", "issued", "unpaid", "partial"];
      let invoice = await Invoice.findOne({
        where: {
          patient_id: transaction.patient_id,
          organization_id: transaction.organization_id,
          facility_id: transaction.facility_id,
          status: allowedReuseStatuses,
          is_locked: false,
        },
        transaction: sequelizeTransaction,
      });

      if (!invoice) {
        invoice = await Invoice.create(
          {
            patient_id: transaction.patient_id,
            organization_id: transaction.organization_id,
            facility_id: transaction.facility_id,
            status: "draft",
            currency: "USD",
            total: 0,
            total_paid: 0,
            balance: 0,
            created_by_id: user.id,
          },
          { transaction: sequelizeTransaction }
        );
      }

      // ✅ Create or update invoice item (IDEMPOTENT)
      let invoiceItem = await InvoiceItem.findOne({
        where: {
          module: "pharmacy-transaction",
          entity_id: transaction.id,
        },
        transaction: sequelizeTransaction,
      });

      const totalPrice = price * totalDispensed;
      const totalTax = taxAmountPerUnit * totalDispensed;
      const netAmount = totalPrice + totalTax;

      if (invoiceItem) {
        await invoiceItem.update(
          {
            quantity: totalDispensed,
            unit_price: price,
            tax_amount: totalTax,
            total_price: totalPrice,
            net_amount: netAmount,
            updated_by_id: user.id,
          },
          { transaction: sequelizeTransaction }
        );
      } else {
        invoiceItem = await InvoiceItem.create(
          {
            invoice_id: invoice.id,
            billable_item_id: billableItem.id,
            organization_id: transaction.organization_id,
            facility_id: transaction.facility_id,
            description: billableItem.name,
            unit_price: price,
            quantity: totalDispensed,
            discount_amount: 0,
            tax_amount: totalTax,
            total_price: totalPrice,
            net_amount: netAmount,
            module: "pharmacy-transaction",
            entity_id: transaction.id,
            created_by_id: user.id,
            status: "applied",
          },
          { transaction: sequelizeTransaction }
        );

        await transaction.update(
          { invoice_item_id: invoiceItem.id },
          { transaction: sequelizeTransaction }
        );
      }

      // ✅ Recalculate invoice totals
      await recalcInvoice(invoice.id, sequelizeTransaction);

      logger.info(
        `[billingService] ✅ Pharmacy txn billed | invoice=${invoice.id}, item=${invoiceItem.id}, qty=${totalDispensed}, price=${price}`
      );

      return { invoice, item: invoiceItem };
    } catch (err) {
      logger.error(
        `[billingService] ❌ Failed to bill pharmacy txn=${transaction?.id}`,
        err
      );
      throw err;
    }
  }

};
