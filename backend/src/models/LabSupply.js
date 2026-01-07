// 📁 backend/src/models/LabSupply.js
import { DataTypes, Model } from "sequelize";
import { LAB_SUPPLY_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class LabSupply extends Model {
    static associate(models) {
      // Org / Facility
      LabSupply.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      LabSupply.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      LabSupply.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      LabSupply.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      LabSupply.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  LabSupply.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      name: { type: DataTypes.STRING(150), allowNull: false },
      unit: { type: DataTypes.STRING },
      quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
      reorder_level: { type: DataTypes.INTEGER, defaultValue: 0 },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...LAB_SUPPLY_STATUS),
        allowNull: false,
        defaultValue: LAB_SUPPLY_STATUS[0], // "active"
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "LabSupply",
      tableName: "lab_supplies",
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
        active: { where: { deleted_at: null } },

        // 🔑 Tenant scope → required for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard superadmin case
          return { where: { facility_id: facilityId } };
        },
      },      
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["name"] },
        { fields: ["status"] },
      ],
    }
  );

  return LabSupply;
};
