// 📁 backend/src/models/Ward.js
import { DataTypes, Model } from "sequelize";
import { WARD_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Ward extends Model {
    static associate(models) {
      // Org / Facility
      Ward.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Ward.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Department link
      Ward.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });

      // Rooms
      Ward.hasMany(models.Room, { as: "rooms", foreignKey: "ward_id" });

      // Audit
      Ward.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Ward.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Ward.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Ward.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID },

      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(WARD_STATUS)),
        allowNull: false,
        defaultValue: WARD_STATUS.ACTIVE,
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Ward",
      tableName: "wards",
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
        { fields: ["organization_id"], name: "idx_wards_org_id" },
        { fields: ["facility_id"], name: "idx_wards_facility_id" },
        { fields: ["department_id"], name: "idx_wards_department_id" },
        { fields: ["status"], name: "idx_wards_status" },
      ],
      uniqueKeys: {
        unique_ward_per_facility: {
          fields: ["organization_id", "facility_id", "name"],
        },
      },
    }
  );

  return Ward;
};
