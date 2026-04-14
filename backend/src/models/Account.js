// 📁 backend/src/models/Account.js
import { DataTypes, Model } from "sequelize";
import { ACCOUNT_TYPES, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class Account extends Model {
    static associate(models) {
      Account.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Account.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      Account.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Account.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Account.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔥 Ledger = SOURCE OF TRUTH
      Account.hasMany(models.CashLedger, {
        as: "ledgerEntries",
        foreignKey: "account_id",
      });
    }
  }

  Account.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🔹 CORE
      ============================================================ */
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // 🔥 NEW: ACCOUNT NUMBER (VERY IMPORTANT)
      account_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },

      type: {
        type: DataTypes.ENUM(...Object.values(ACCOUNT_TYPES)),
        allowNull: false,
      },

      currency: {
        type: DataTypes.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      /* ============================================================
         🔹 FINANCIAL
      ============================================================ */

      // ⚠️ Cached only (real balance = ledger sum)
      balance: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      /* ============================================================
         🔹 TENANT
      ============================================================ */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      facility_id: {
        type: DataTypes.UUID,
      },

      /* ============================================================
         🔹 AUDIT
      ============================================================ */
      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,
    },
    {
      sequelize,
      modelName: "Account",
      tableName: "accounts",
      underscored: true,
      paranoid: true,
      timestamps: true,

      /* ============================================================
         🔥 INDEXES (ENTERPRISE)
      ============================================================ */
      indexes: [
        {
          unique: true,
          fields: ["account_number"],
        },
        {
          fields: ["organization_id"],
        },
        {
          fields: ["facility_id"],
        },
      ],
    }
  );

  return Account;
};