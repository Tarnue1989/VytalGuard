// 📁 backend/src/models/CurrencyRate.js

import { DataTypes, Model, Op } from "sequelize";
import { CURRENCY_RATE_STATUS, CURRENCY } from "../constants/enums.js";

export default (sequelize) => {
  class CurrencyRate extends Model {
    static associate(models) {
      // 🔗 Org / Facility scope
      CurrencyRate.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      CurrencyRate.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      CurrencyRate.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      CurrencyRate.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      CurrencyRate.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }
  }

  CurrencyRate.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🔗 TENANT SCOPE
      ============================================================ */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // ✅ allow NULL for org-level fallback
      facility_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      /* ============================================================
         💱 CURRENCY PAIR
      ============================================================ */
      from_currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
          isIn: [Object.values(CURRENCY)],
        },
      },

      to_currency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: {
          isIn: [Object.values(CURRENCY)],
        },
      },

      rate: {
        type: DataTypes.DECIMAL(12, 6),
        allowNull: false,
        validate: {
          min: 0,
        },
      },

      effective_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_DATE"),
      },

      /* ============================================================
         🔁 LIFECYCLE
      ============================================================ */
      status: {
        type: DataTypes.ENUM(...Object.values(CURRENCY_RATE_STATUS)),
        allowNull: false,
        defaultValue: CURRENCY_RATE_STATUS.ACTIVE,
      },

      /* ============================================================
         🧾 AUDIT
      ============================================================ */
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "CurrencyRate",
      tableName: "currency_rates",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",

      defaultScope: {
        attributes: { exclude: ["deleted_at", "deleted_by_id"] },
      },

      /* ============================================================
         🔍 SCOPES (NO HARDCODING)
      ============================================================ */
      scopes: {
        withDeleted: { paranoid: false },

        active: {
          where: { status: CURRENCY_RATE_STATUS.ACTIVE },
        },

        inactive: {
          where: { status: CURRENCY_RATE_STATUS.INACTIVE },
        },

        // ✅ Tenant-aware WITH fallback (CRITICAL for fxService)
        tenant(orgId, facilityId) {
          return {
            where: {
              organization_id: orgId,
              ...(facilityId
                ? {
                    [Op.or]: [
                      { facility_id: facilityId },
                      { facility_id: null },
                    ],
                  }
                : {}),
            },
          };
        },
      },

      /* ============================================================
         ⚡ INDEXES (OPTIMIZED)
      ============================================================ */
      indexes: [
        { fields: ["organization_id"], name: "idx_currency_rates_org_id" },
        { fields: ["facility_id"], name: "idx_currency_rates_facility_id" },

        // 🔥 optimized lookup for fxService
        {
          fields: [
            "organization_id",
            "facility_id",
            "from_currency",
            "to_currency",
            "status",
          ],
          name: "idx_currency_rates_lookup",
        },

        { fields: ["effective_date"], name: "idx_currency_rates_effective_date" },
      ],

      /* ============================================================
         🔐 UNIQUE RULE
      ============================================================ */
      uniqueKeys: {
        unique_rate_per_day: {
          fields: [
            "organization_id",
            "facility_id",
            "from_currency",
            "to_currency",
            "effective_date",
          ],
        },
      },

      /* ============================================================
         🧠 HOOKS
      ============================================================ */
      hooks: {
        beforeValidate(instance) {
          if (
            instance.from_currency &&
            instance.to_currency &&
            instance.from_currency === instance.to_currency
          ) {
            throw new Error(
              "from_currency and to_currency cannot be the same"
            );
          }
        },
      },
    }
  );

  return CurrencyRate;
};