// 📁 backend/src/models/FinancialLedger.js
import { DataTypes, Model } from "sequelize";
import {
  LEDGER_TRANSACTION_TYPE,
  LEDGER_STATUS,
  PAYMENT_METHODS,
} from "../constants/enums.js";

export default (sequelize) => {
  class FinancialLedger extends Model {
    static associate(models) {
      // 🔗 Links
      FinancialLedger.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      FinancialLedger.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });
      FinancialLedger.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      FinancialLedger.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });

      // 🔗 Source (polymorphic)
      FinancialLedger.belongsTo(models.Payment, { as: "payment", foreignKey: "payment_id" });
      FinancialLedger.belongsTo(models.Refund, { as: "refund", foreignKey: "refund_id" });
      FinancialLedger.belongsTo(models.Deposit, { as: "deposit", foreignKey: "deposit_id" });
      FinancialLedger.belongsTo(models.DiscountWaiver, { as: "discountWaiver", foreignKey: "discount_waiver_id" });

      // 🔗 Audit
      FinancialLedger.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
    }
  }

  FinancialLedger.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Context
      invoice_id: { type: DataTypes.UUID, allowNull: true },
      patient_id: { type: DataTypes.UUID, allowNull: true },

      // 🔗 Source record (polymorphic)
      payment_id: { type: DataTypes.UUID, allowNull: true },
      refund_id: { type: DataTypes.UUID, allowNull: true },
      deposit_id: { type: DataTypes.UUID, allowNull: true },
      discount_waiver_id: { type: DataTypes.UUID, allowNull: true },
      // 💵 Financial details
      transaction_type: {
        type: DataTypes.ENUM(...Object.values(LEDGER_TRANSACTION_TYPE)), // "credit", "debit"
        allowNull: false,
      },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },

      // 🔹 Payment method (reuse PAYMENT_METHODS)
      method: {
        type: DataTypes.ENUM(...Object.values(PAYMENT_METHODS)),
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM(...Object.values(LEDGER_STATUS)), // "pending", "completed", "voided", etc.
        allowNull: false,
        defaultValue: LEDGER_STATUS.PENDING,
      },
      note: { type: DataTypes.TEXT },

      // 🔗 Audit
      created_by_id: { type: DataTypes.UUID },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "FinancialLedger",
      tableName: "financial_ledger",
      underscored: true,
      timestamps: false,
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["invoice_id"] },
        { fields: ["patient_id"] },
        { fields: ["payment_id"] },
        { fields: ["refund_id"] },
        { fields: ["deposit_id"] },
        { fields: ["discount_waiver_id"] },
        { fields: ["transaction_type"] },
        { fields: ["status"] },
        { fields: ["method"] },
      ],
    }
  );

  return FinancialLedger;
};
