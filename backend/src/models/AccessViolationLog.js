// 📁 backend/src/models/AccessViolationLog.js
import { DataTypes, Model } from "sequelize";
import { ACCESS_VIOLATION_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class AccessViolationLog extends Model {
    static associate(models) {
      // 🔗 Who triggered the violation
      AccessViolationLog.belongsTo(models.User, { as: "user", foreignKey: "user_id" });

      // Org / Facility
      AccessViolationLog.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      AccessViolationLog.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit trail
      AccessViolationLog.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      AccessViolationLog.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      AccessViolationLog.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  AccessViolationLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: true },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // Core details
      user_id: { type: DataTypes.UUID },
      action: { type: DataTypes.STRING, allowNull: false }, // e.g., "delete", "update"
      reason: { type: DataTypes.STRING },

      // Request context (🔐 added for compliance/security)
      ip_address: { type: DataTypes.STRING },        // Source IP of the request
      user_agent: { type: DataTypes.STRING },        // Client/browser making the request

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...ACCESS_VIOLATION_STATUS),
        allowNull: false,
        defaultValue: ACCESS_VIOLATION_STATUS[0], // "logged"
      },

      // Audit (who recorded the log)
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "AccessViolationLog",
      tableName: "access_violation_logs",
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
        { fields: ["user_id"] },
        { fields: ["action"] },
        { fields: ["status"] },
        { fields: ["ip_address"] },   // index for security audits
      ],
    }
  );

  return AccessViolationLog;
};
