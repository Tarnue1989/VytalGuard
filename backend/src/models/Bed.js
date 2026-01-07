// 📁 backend/src/models/Bed.js
import { DataTypes, Model } from "sequelize";
import { BED_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Bed extends Model {
    static associate(models) {
      // 🔗 Relations
      Bed.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });

      // Org / Facility
      Bed.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Bed.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      Bed.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Bed.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Bed.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Bed.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      room_number: { type: DataTypes.STRING, allowNull: true },
      bed_number: { type: DataTypes.STRING, allowNull: true },
      department_id: { type: DataTypes.UUID, allowNull: true },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...BED_STATUS),
        allowNull: false,
        defaultValue: BED_STATUS[0], // "available"
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Bed",
      tableName: "beds",
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
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["department_id"] },
        { fields: ["room_number"] },
        { fields: ["bed_number"] },
        { fields: ["status"] },
      ],
      uniqueKeys: {
        unique_bed_per_room: {
          fields: ["organization_id", "facility_id", "room_number", "bed_number"],
        },
      },
    }
  );

  return Bed;
};
