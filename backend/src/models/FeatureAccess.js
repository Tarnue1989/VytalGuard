// 📁 backend/src/models/FeatureAccess.js
import { DataTypes, Model } from "sequelize";
import { FEATURE_ACCESS_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class FeatureAccess extends Model {
    static associate(models) {
      FeatureAccess.belongsTo(models.Organization, { foreignKey: "organization_id", as: "organization" });
      FeatureAccess.belongsTo(models.Facility, { foreignKey: "facility_id", as: "facility" });
      FeatureAccess.belongsTo(models.Role, { foreignKey: "role_id", as: "role" });
      FeatureAccess.belongsTo(models.FeatureModule, { foreignKey: "module_id", as: "module" });

      FeatureAccess.belongsTo(models.User, { foreignKey: "created_by_id", as: "createdBy" });
      FeatureAccess.belongsTo(models.User, { foreignKey: "updated_by_id", as: "updatedBy" });
      FeatureAccess.belongsTo(models.User, { foreignKey: "deleted_by_id", as: "deletedBy" });
    }
  }

  FeatureAccess.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true },
      role_id: { type: DataTypes.UUID, allowNull: false },
      module_id: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.ENUM(...FEATURE_ACCESS_STATUS), allowNull: false, defaultValue: FEATURE_ACCESS_STATUS[0] },
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "FeatureAccess",
      tableName: "feature_accesses",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: { attributes: { exclude: ["deleted_at", "deleted_by_id"] } },
      scopes: {
        withDeleted: { paranoid: false },
        active: { where: { status: "active" } },
        inactive: { where: { status: "inactive" } },
        tenant(orgId, facilityId) {
          const where = {};
          if (orgId) where.organization_id = orgId;
          if (facilityId) where.facility_id = facilityId;
          return { where };
        },
      },
    }
  );

  return FeatureAccess;
};
