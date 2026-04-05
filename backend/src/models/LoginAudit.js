// 📁 backend/src/models/LoginAudit.js
import { DataTypes, Model } from "sequelize";
import { LOGIN_AUDIT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class LoginAudit extends Model {
    static associate(models) {
      // 🔗 User who logged in
      LoginAudit.belongsTo(models.User, { as: "user", foreignKey: "user_id" });

      // Org / Facility scope
      LoginAudit.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      LoginAudit.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      LoginAudit.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      LoginAudit.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      LoginAudit.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  LoginAudit.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Who + When
      user_id: { type: DataTypes.UUID, allowNull: false },
      login_time: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      logout_time: { type: DataTypes.DATE },

      // Context
      ip_address: { type: DataTypes.STRING(100) },
      device_info: { type: DataTypes.STRING },
      user_agent: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(LOGIN_AUDIT_STATUS)),
        allowNull: false,
        defaultValue: LOGIN_AUDIT_STATUS.SUCCESS,
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "LoginAudit",
      tableName: "login_audits",
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
        { fields: ["user_id"] },
        { fields: ["login_time"] },
        { fields: ["status"] },
      ],
    }
  );

  return LoginAudit;
};
