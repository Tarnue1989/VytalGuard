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

      /* 🔑 Trigger Identity */
      module_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: "kebab-case module key (e.g. lab-request)",
      },

      trigger_status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: "status that allows billing (e.g. completed)",
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
        { fields: ["module_key"] },
        { fields: ["trigger_status"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["is_active"] },
      ],
    }
  );

  return BillingTrigger;
};
