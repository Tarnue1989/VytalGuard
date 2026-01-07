// 📁 backend/src/models/AutoBillingRule.js
import { DataTypes, Model } from "sequelize";
import {
  AUTO_BILLING_CHARGE_MODE,
  AUTO_BILLING_RULE_STATUS,
} from "../constants/enums.js";

export default (sequelize) => {
  class AutoBillingRule extends Model {
    static associate(models) {
      // 🔗 Tenant hierarchy
      AutoBillingRule.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      AutoBillingRule.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔗 Feature & Billable links
      AutoBillingRule.belongsTo(models.FeatureModule, {
        as: "featureModule",
        foreignKey: "trigger_feature_module_id",
      });
      AutoBillingRule.belongsTo(models.BillableItem, {
        as: "billableItem",
        foreignKey: "billable_item_id",
      });

      // 🔹 Audit trail
      AutoBillingRule.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });
      AutoBillingRule.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });
      AutoBillingRule.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }
  }

  AutoBillingRule.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ============================================================
         🏢 Tenant Scope
      ============================================================ */
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      /* ============================================================
         ⚙️ Billing Configuration
      ============================================================ */
      trigger_feature_module_id: {
        type: DataTypes.UUID,
        allowNull: true, // optional for legacy/manual rules
        comment: "Foreign key → FeatureModule.id",
      },

      trigger_module: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "Readable key, kebab-case (e.g. 'lab-results', 'consultations')",
      },

      billable_item_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "Linked BillableItem",
      },

      auto_generate: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: "Whether to auto-apply this rule when trigger fires",
      },

      charge_mode: {
        type: DataTypes.ENUM(...AUTO_BILLING_CHARGE_MODE),
        allowNull: false,
        defaultValue: AUTO_BILLING_CHARGE_MODE[0],
      },

      default_price: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        validate: { min: 0 },
      },

      /* ============================================================
         🩺 Lifecycle
      ============================================================ */
      status: {
        type: DataTypes.ENUM(...AUTO_BILLING_RULE_STATUS),
        allowNull: false,
        defaultValue: AUTO_BILLING_RULE_STATUS[0], // "active"
      },

      /* ============================================================
         🧾 Audit Trail
      ============================================================ */
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "AutoBillingRule",
      tableName: "auto_billing_rules",
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
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["billable_item_id"] },
        { fields: ["trigger_feature_module_id"] },
        { fields: ["trigger_module"] },
        { fields: ["status"] },
      ],
    }
  );

  return AutoBillingRule;
};
