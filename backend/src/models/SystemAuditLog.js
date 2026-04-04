// 📁 backend/src/models/SystemAuditLog.js
import { DataTypes, Model } from "sequelize";
import { SYSTEM_AUDIT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class SystemAuditLog extends Model {
    static associate(models) {
      // Org / Facility
      SystemAuditLog.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      SystemAuditLog.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit users
      SystemAuditLog.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      SystemAuditLog.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      SystemAuditLog.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  SystemAuditLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Core details
      table_name: { type: DataTypes.STRING, allowNull: false },
      record_id: { type: DataTypes.UUID },
      action: { type: DataTypes.STRING, allowNull: false }, // e.g., "INSERT", "UPDATE", "DELETE"
      changes: { type: DataTypes.JSON },

      // Request context (🔐 added for compliance/security)
      ip_address: { type: DataTypes.STRING },
      user_agent: { type: DataTypes.STRING },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(SYSTEM_AUDIT_STATUS)),
        allowNull: false,
        defaultValue: SYSTEM_AUDIT_STATUS.LOGGED,
      },
      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "SystemAuditLog",
      tableName: "system_audit_logs",
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
        { fields: ["table_name"] },
        { fields: ["record_id"] },
        { fields: ["action"] },
        { fields: ["status"] },
        { fields: ["ip_address"] },
      ],
    }
  );

  return SystemAuditLog;
};
