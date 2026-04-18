// 📁 backend/src/models/Account.js
import { DataTypes, Model } from "sequelize";
import { ACCOUNT_TYPES, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class Account extends Model {
    static associate(models) {
      /* ============================================================
         🔹 TENANT LINKS
      ============================================================ */
      Account.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      Account.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      /* ============================================================
         🔹 AUDIT
      ============================================================ */
      Account.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      Account.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      Account.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });

      /* ============================================================
         🔥 LEDGER (SOURCE OF TRUTH)
      ============================================================ */
      Account.hasMany(models.CashLedger, {
        as: "ledgerEntries",
        foreignKey: "account_id",
      });
    }
  }

  Account.init(
    {
      /* ============================================================
         🔹 PRIMARY KEY
      ============================================================ */
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

      // 🔥 UNIQUE PER ORG (NOT GLOBAL)
      account_number: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      // 🔥 ENUM → STRING (ENTERPRISE SAFE)
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [Object.values(ACCOUNT_TYPES)],
        },
      },

      currency: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isIn: [Object.values(CURRENCY)],
        },
      },

      /* ============================================================
         🔹 FINANCIAL
      ============================================================ */

      // ⚠️ Cached only (REAL = ledger sum)
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
        allowNull: true,
      },

      /* ============================================================
         🔹 AUDIT FIELDS
      ============================================================ */
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      deleted_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Account",
      tableName: "accounts",
      underscored: true,
      paranoid: true,
      timestamps: true,

      /* ============================================================
         🔥 INDEXES (ENTERPRISE SAFE)
      ============================================================ */
      indexes: [
        // 🔥 UNIQUE PER ORG (FIXED)
        {
          unique: true,
          fields: ["account_number", "organization_id"],
        },

        {
          fields: ["organization_id"],
        },
        {
          fields: ["facility_id"],
        },
        {
          fields: ["type"],
        },
        {
          fields: ["currency"],
        },
      ],
    }
  );

  return Account;
};