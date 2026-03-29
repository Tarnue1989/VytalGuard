// 📁 backend/src/models/Deposit.js
import { DataTypes, Model } from "sequelize";
import { DEPOSIT_STATUS, PAYMENT_METHODS } from "../constants/enums.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";

/* ============================================================
   🔖 Local enum map
============================================================ */
const DS = {
  PENDING: DEPOSIT_STATUS[0],
  CLEARED: DEPOSIT_STATUS[1],
  APPLIED: DEPOSIT_STATUS[2],
  CANCELLED: DEPOSIT_STATUS[3],
};

export default (sequelize) => {
  class Deposit extends Model {
    static associate(models) {
      Deposit.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      Deposit.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Deposit.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      Deposit.belongsTo(models.Invoice, { as: "appliedInvoice", foreignKey: "applied_invoice_id" });

      Deposit.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Deposit.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Deposit.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Deposit.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔢 Number
      deposit_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },

      // 🔗 Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      applied_invoice_id: { type: DataTypes.UUID, allowNull: true },

      // 💵 Deposit info
      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },

      applied_amount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
      remaining_balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

      refund_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      unapplied_amount: {
        type: DataTypes.VIRTUAL(DataTypes.DECIMAL(12, 2), ["amount", "applied_amount", "refund_amount"]),
        get() {
          const amt = parseFloat(this.getDataValue("amount") || 0);
          const applied = parseFloat(this.getDataValue("applied_amount") || 0);
          const refunded = parseFloat(this.getDataValue("refund_amount") || 0);
          return amt - applied - refunded;
        },
      },

      method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
      transaction_ref: { type: DataTypes.STRING },

      status: {
        type: DataTypes.ENUM(...DEPOSIT_STATUS),
        allowNull: false,
        defaultValue: DS.PENDING,
      },

      notes: { type: DataTypes.TEXT },
      reason: { type: DataTypes.TEXT },

      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Deposit",
      tableName: "deposits",
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
        pending:   { where: { status: DS.PENDING, deleted_at: null } },
        cleared:   { where: { status: DS.CLEARED, deleted_at: null } },
        applied:   { where: { status: DS.APPLIED, deleted_at: null } },
        cancelled: { where: { status: DS.CANCELLED, deleted_at: null } },
        tenant(facilityId) {
          return facilityId ? { where: { facility_id: facilityId } } : {};
        },
      },

      indexes: [
        { fields: ["patient_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["status"] },
        { fields: ["deposit_number"], unique: true }, // ✅ important
      ],
    }
  );

  /* ============================================================
     🔁 Hooks
  ============================================================ */

  // ✅ Generate number (MATCH INVOICE PATTERN)
  Deposit.beforeValidate(async (deposit) => {
    if (!deposit.deposit_number) {
      const last = await Deposit.findOne({
        where: {
          organization_id: deposit.organization_id,
          facility_id: deposit.facility_id,
        },
        order: [["created_at", "DESC"]],
      });

      let seq = 1;

      if (last?.deposit_number) {
        const match = last.deposit_number.match(/(\d+)$/);
        if (match) seq = parseInt(match[1], 10) + 1;
      }

      const year = new Date().getFullYear();
      deposit.deposit_number = `DEP-${year}-${String(seq).padStart(5, "0")}`;
    }
  });

  // ✅ Initialize balance
  Deposit.beforeCreate((deposit) => {
    deposit.remaining_balance = deposit.amount;
  });

  // ✅ Validate + maintain balance
  Deposit.beforeUpdate((deposit) => {
    const amount = parseFloat(deposit.amount || 0);
    const applied = parseFloat(deposit.applied_amount || 0);
    const refunded = parseFloat(deposit.refund_amount || 0);

    if (applied + refunded > amount) {
      throw new Error("Applied + refunded cannot exceed deposit amount");
    }

    deposit.remaining_balance = amount - applied - refunded;
  });

  // ✅ Recalculate invoice
  Deposit.afterUpdate(async (deposit, options) => {
    if (deposit.status === DS.APPLIED && deposit.applied_invoice_id) {
      await recalcInvoice(deposit.applied_invoice_id, options?.transaction);
    }
  });

  return Deposit;
};