// 📁 backend/src/models/Deposit.js
import { DataTypes, Model } from "sequelize";
import { DEPOSIT_STATUS, PAYMENT_METHODS, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class Deposit extends Model {
    static associate(models) {
      Deposit.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      Deposit.belongsTo(models.Invoice, {
        as: "appliedInvoice",
        foreignKey: "applied_invoice_id",
      });

      Deposit.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      Deposit.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      Deposit.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      Deposit.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      Deposit.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }
  }

  Deposit.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      deposit_number: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },

      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      applied_invoice_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      amount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
      },

      applied_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      remaining_balance: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      unapplied_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      refund_amount: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      balance: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
      },

      is_refundable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      method: {
        type: DataTypes.ENUM(...Object.values(PAYMENT_METHODS)),
        allowNull: false,
      },

      transaction_ref: {
        type: DataTypes.STRING,
      },

      status: {
        type: DataTypes.ENUM(...Object.values(DEPOSIT_STATUS)),
        allowNull: false,
        defaultValue: DEPOSIT_STATUS.PENDING,
      },

      notes: {
        type: DataTypes.TEXT,
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

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["applied_invoice_id"] },
        { fields: ["status"] },
      ],
    }
  );

  /* ============================================================
     🔢 AUTO GENERATE NUMBER
  ============================================================ */
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

  return Deposit;
};