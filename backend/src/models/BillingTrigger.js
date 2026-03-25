// 📁 backend/src/models/BillingTrigger.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class BillingTrigger extends Model {
    static associate(models) {
      BillingTrigger.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });

      BillingTrigger.belongsTo(models.Facility, {
        foreignKey: "facility_id",
        as: "facility",
      });

      // 🔗 AUTHORITATIVE FEATURE LINK
      BillingTrigger.belongsTo(models.FeatureModule, {
        foreignKey: "feature_module_id",
        as: "featureModule",
      });

      BillingTrigger.belongsTo(models.User, {
        foreignKey: "created_by_id",
        as: "createdBy",
      });

      BillingTrigger.belongsTo(models.User, {
        foreignKey: "updated_by_id",
        as: "updatedBy",
      });
    }
  }

  BillingTrigger.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* 🔑 Trigger Identity (FK-DRIVEN) */
      feature_module_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: "Foreign key → feature_modules.id",
      },

      // 🔥 REQUIRED (matches DB + controller)
      module_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "Display key for module (e.g. appointments, lab_requests)",
      },

      trigger_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "Entity status that allows billing (e.g. completed)",
      },

      /* 🏢 Tenant Scope */
      organization_id: {
        type: DataTypes.UUID,
        allowNull: true, // NULL = system default
      },

      facility_id: {
        type: DataTypes.UUID,
        allowNull: true, // NULL = org-level
      },

      /* ⚙️ Control */
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      /* 🧾 Audit */
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "BillingTrigger",
      tableName: "billing_triggers",
      underscored: true,

      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",

      indexes: [
        { fields: ["feature_module_id"] },
        { fields: ["module_key"] }, // 🔥 added
        { fields: ["trigger_status"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["is_active"] },

        // 🔥 PREVENT DUPLICATES (IMPORTANT)
        {
          unique: true,
          fields: [
            "feature_module_id",
            "trigger_status",
            "organization_id",
            "facility_id",
          ],
        },
      ],
    }
  );

  return BillingTrigger;
};