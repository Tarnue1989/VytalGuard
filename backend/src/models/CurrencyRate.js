// 📁 backend/src/models/CurrencyRate.js
import { DataTypes, Model } from "sequelize";
import { CURRENCY_RATE_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class CurrencyRate extends Model {
    static associate(models) {
      // Org / Facility scope
      CurrencyRate.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      CurrencyRate.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      CurrencyRate.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      CurrencyRate.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      CurrencyRate.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  CurrencyRate.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      from_currency: { type: DataTypes.STRING(10), allowNull: false },
      to_currency: { type: DataTypes.STRING(10), allowNull: false },
      rate: { type: DataTypes.DECIMAL(12, 6), allowNull: false },
      effective_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_DATE"),
      },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...CURRENCY_RATE_STATUS),
        allowNull: false,
        defaultValue: CURRENCY_RATE_STATUS[0], // "active"
      },

      // Audit
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
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { status: "active" } },
        inactive: { where: { status: "inactive" } },
        // 🔑 Needed for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin fallback (no filter)
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"], name: "idx_currency_rates_org_id" },
        { fields: ["facility_id"], name: "idx_currency_rates_facility_id" },
        { fields: ["from_currency", "to_currency"], name: "idx_currency_rates_currency_pair" },
        { fields: ["effective_date"], name: "idx_currency_rates_effective_date" },
        { fields: ["status"], name: "idx_currency_rates_status" },
      ],
      uniqueKeys: {
        unique_rate_per_day: {
          fields: ["organization_id", "facility_id", "from_currency", "to_currency", "effective_date"],
        },
      },
    }
  );

  return CurrencyRate;
};
