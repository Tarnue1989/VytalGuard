// 📁 backend/src/models/Payment.js
import { DataTypes, Model } from "sequelize";
import { PAYMENT_METHODS, PAYMENT_STATUS, CURRENCY } from "../constants/enums.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";

/* ============================================================
   🔖 Local enum map
============================================================ */
const PS = {
  PENDING: PAYMENT_STATUS.PENDING,
  COMPLETED: PAYMENT_STATUS.COMPLETED,
  FAILED: PAYMENT_STATUS.FAILED,
  CANCELLED: PAYMENT_STATUS.CANCELLED,
};

export default (sequelize) => {
  class Payment extends Model {
    static associate(models) {
      // 🔹 Parent Invoice
      Payment.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🔹 Patient
      Payment.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });

      // 🔹 Refunds
      Payment.hasMany(models.Refund, { as: "refunds", foreignKey: "payment_id" });

      // 🔹 Org / Facility
      Payment.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Payment.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔥🔥🔥 ACCOUNT FIX (THIS WAS MISSING)
      Payment.belongsTo(models.Account, {
        as: "account",
        foreignKey: "account_id",
      });

      // 🔹 Audit
      Payment.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Payment.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Payment.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Payment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      payment_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },

      invoice_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // 🔥 REQUIRED
      account_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      facility_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },

      method: {
        type: DataTypes.ENUM(...Object.values(PAYMENT_METHODS)),
        allowNull: false,
      },

      status: {
        type: DataTypes.ENUM(...Object.values(PAYMENT_STATUS)),
        allowNull: false,
        defaultValue: PAYMENT_STATUS.PENDING,
      },

      transaction_ref: {
        type: DataTypes.STRING,
      },

      is_deposit: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },

      reason: {
        type: DataTypes.TEXT,
      },

      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "Payment",
      tableName: "payments",
      underscored: true,
      paranoid: true,
      timestamps: true,

      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },

      scopes: {
        withDeleted: { paranoid: false },
        pending: { where: { status: PS.PENDING, deleted_at: null } },
        completed: { where: { status: PS.COMPLETED, deleted_at: null } },
        failed: { where: { status: PS.FAILED, deleted_at: null } },
        cancelled: { where: { status: PS.CANCELLED, deleted_at: null } },
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"], name: "idx_payments_org_id" },
        { fields: ["facility_id"], name: "idx_payments_facility_id" },
        { fields: ["invoice_id"], name: "idx_payments_invoice_id" },
        { fields: ["patient_id"], name: "idx_payments_patient_id" },
        { fields: ["status"], name: "idx_payments_status" },
        { fields: ["method"], name: "idx_payments_method" },
        { fields: ["payment_number"], unique: true },
      ],
    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */

  Payment.beforeValidate(async (payment) => {
    const { Invoice } = await import("../models/index.js");

    if (!payment.organization_id || !payment.facility_id) {
      const invoice = await Invoice.findByPk(payment.invoice_id);
      if (!invoice) throw new Error("Invalid invoice_id for payment");

      payment.organization_id = invoice.organization_id;
      payment.facility_id = invoice.facility_id;
      payment.patient_id = invoice.patient_id;

      // 🔥 ensure currency matches invoice
      payment.currency = invoice.currency;
    }

    if (!payment.payment_number) {
      const last = await Payment.findOne({
        where: {
          organization_id: payment.organization_id,
          facility_id: payment.facility_id,
        },
        order: [["created_at", "DESC"]],
      });

      let seq = 1;

      if (last?.payment_number) {
        const match = last.payment_number.match(/(\d+)$/);
        if (match) seq = parseInt(match[1], 10) + 1;
      }

      const year = new Date().getFullYear();
      payment.payment_number = `PAY-${year}-${String(seq).padStart(5, "0")}`;
    }
  });

  Payment.afterCreate(async (payment, options) => {
    if (payment.status === PS.COMPLETED && payment.invoice_id) {
      await recalcInvoice(payment.invoice_id, options?.transaction);
    }
  });

  Payment.afterUpdate(async (payment, options) => {
    if (payment.status === PS.COMPLETED && payment.invoice_id) {
      await recalcInvoice(payment.invoice_id, options?.transaction);
    }
  });

  return Payment;
};