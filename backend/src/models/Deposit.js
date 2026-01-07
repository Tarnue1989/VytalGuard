// 📁 backend/src/models/Deposit.js
import { DataTypes, Model } from "sequelize";
import { DEPOSIT_STATUS, PAYMENT_METHODS } from "../constants/enums.js";
import { recalcInvoice } from "../utils/invoiceUtil.js"

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
      // 🔹 Patient + Tenant scope
      Deposit.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      Deposit.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Deposit.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Applied to invoice (optional)
      Deposit.belongsTo(models.Invoice, { as: "appliedInvoice", foreignKey: "applied_invoice_id" });

      // 🔹 Audit trail
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

      // 🆕 Step 1: Refund amount added
      refund_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      // 🆕 Unapplied amount (amount not applied and not refunded)
      unapplied_amount: { 
        type: DataTypes.VIRTUAL(DataTypes.DECIMAL(12, 2), ["amount", "applied_amount", "refund_amount"]),
        get() {
          const amt = parseFloat(this.getDataValue("amount") || 0);
          const applied = parseFloat(this.getDataValue("applied_amount") || 0);
          const refunded = parseFloat(this.getDataValue("refund_amount") || 0);

          return amt - applied - refunded;  // 🔥 Correct new formula
        }
      },


      method: { type: DataTypes.ENUM(...PAYMENT_METHODS), allowNull: false },
      transaction_ref: { type: DataTypes.STRING },

      // 📌 Lifecycle
      status: {
        type: DataTypes.ENUM(...DEPOSIT_STATUS),
        allowNull: false,
        defaultValue: DS.PENDING,
      },
      notes: { type: DataTypes.TEXT },
      reason: { type: DataTypes.TEXT },

      // 🔹 Audit
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
      ],
    }
  );

  /* ============================================================
     🔁 Hooks (No refund logic yet — Step 1 only)
  ============================================================ */

  Deposit.beforeCreate((deposit) => {
    deposit.remaining_balance = deposit.amount;
  });

  // ✅ Ensure applied + refund ≤ amount and update balance correctly
  Deposit.beforeUpdate((deposit) => {
    const amount = parseFloat(deposit.amount || 0);
    const applied = parseFloat(deposit.applied_amount || 0);
    const refunded = parseFloat(deposit.refund_amount || 0);

    if (applied + refunded > amount) {
      throw new Error("Applied amount + refunded amount cannot exceed deposit amount");
    }

    deposit.remaining_balance = amount - applied - refunded;
  });


  Deposit.afterUpdate(async (deposit, options) => {
    if (deposit.status === DS.APPLIED && deposit.applied_invoice_id) {
      await recalcInvoice(deposit.applied_invoice_id, options?.transaction);
    }
  });

  return Deposit;
};
