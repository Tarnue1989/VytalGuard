import { DataTypes, Model } from "sequelize";
import { DEPOSIT_REFUND_STATUS } from "../constants/enums.js";

// Lifecycle shortcuts
const DR = DEPOSIT_REFUND_STATUS;

export default (sequelize) => {
  class RefundDeposit extends Model {
    static associate(models) {

      /* ============================================================
         🔗 MAIN RELATIONSHIPS
      ============================================================ */
      RefundDeposit.belongsTo(models.Deposit, {
        as: "deposit",
        foreignKey: "deposit_id",
      });

      RefundDeposit.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      RefundDeposit.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      RefundDeposit.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      /* ============================================================
         👤 AUDIT TRAIL USERS
      ============================================================ */
      RefundDeposit.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      RefundDeposit.belongsTo(models.User, { as: "approvedBy",  foreignKey: "approved_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "reviewedBy",  foreignKey: "reviewed_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "rejectedBy",  foreignKey: "rejected_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "processedBy", foreignKey: "processed_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "voidedBy",    foreignKey: "voided_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "cancelledBy",foreignKey: "cancelled_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "reversedBy", foreignKey: "reversed_by_id" });
      RefundDeposit.belongsTo(models.User, { as: "restoredBy", foreignKey: "restored_by_id" });
    }
  }

  RefundDeposit.init(
    {
      /* ============================================================
         🔑 KEYS
      ============================================================ */
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: sequelize.literal("gen_random_uuid()"),
      },

      deposit_id: { type: DataTypes.UUID, allowNull: false },
      patient_id: { type: DataTypes.UUID, allowNull: false },

      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      /* ============================================================
         💵 REFUND INFO
      ============================================================ */
      refund_amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },

      method: { type: DataTypes.STRING, allowNull: false },
      reason: { type: DataTypes.TEXT },

      // ✅ FIX: persistent lifecycle reason tracking
      reason_log: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      status: {
        type: DataTypes.ENUM(...Object.values(DEPOSIT_REFUND_STATUS)),
        allowNull: false,
        defaultValue: DR.PENDING,
      },

      /* ============================================================
         🎯 FULL AUDIT FIELDS
      ============================================================ */
      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,

      approved_by_id: DataTypes.UUID,
      approved_at: DataTypes.DATE,

      reviewed_by_id: DataTypes.UUID,
      reviewed_at: DataTypes.DATE,

      rejected_by_id: DataTypes.UUID,
      rejected_at: DataTypes.DATE,

      processed_by_id: DataTypes.UUID,
      processed_at: DataTypes.DATE,

      voided_by_id: DataTypes.UUID,
      voided_at: DataTypes.DATE,

      cancelled_by_id: DataTypes.UUID,
      cancelled_at: DataTypes.DATE,

      reversed_by_id: DataTypes.UUID,
      reversed_at: DataTypes.DATE,

      restored_by_id: DataTypes.UUID,
      restored_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "RefundDeposit",
      tableName: "refund_deposits",
      underscored: true,
      paranoid: true,

      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["deposit_id"] },
        { fields: ["patient_id"] },
        { fields: ["status"] },
        { fields: ["method"] },
      ],
    }
  );

  /* ============================================================
     🔥 BEFORE CREATE — Auto inherit patient/org/facility
  ============================================================ */
  RefundDeposit.beforeCreate(async (refund) => {
    const { Deposit } = await import("../models/index.js");

    const deposit = await Deposit.findByPk(refund.deposit_id);
    if (!deposit) throw new Error("Invalid deposit_id for refund");

    refund.organization_id = deposit.organization_id;
    refund.facility_id = deposit.facility_id;
    refund.patient_id = deposit.patient_id;
  });

  /* ============================================================
    🔥 AFTER UPDATE — Auto lifecycle stamping (SAFE)
    ❌ NO update(), NO save(), NO recursion
  ============================================================ */
  RefundDeposit.afterUpdate((refund, options) => {
    if (!refund.changed("status")) return;

    const userId = options?.user?.id || null;
    const now = new Date();

    const map = {
      [DR.REVIEW]:    ["reviewed_by_id",  "reviewed_at"],
      [DR.APPROVED]:  ["approved_by_id",  "approved_at"],
      [DR.REJECTED]:  ["rejected_by_id",  "rejected_at"],
      [DR.PROCESSED]: ["processed_by_id", "processed_at"],
      [DR.VOIDED]:    ["voided_by_id",    "voided_at"],
      [DR.CANCELLED]: ["cancelled_by_id", "cancelled_at"],
      [DR.REVERSED]:  ["reversed_by_id",  "reversed_at"],
      [DR.RESTORED]:  ["restored_by_id",  "restored_at"],
    };

    const fields = map[refund.status];
    if (!fields) return;

    const [byField, atField] = fields;

    // ✅ ONLY mutate the instance in memory
    refund.set(byField, userId);
    refund.set(atField, now);
  });

  return RefundDeposit;
};
