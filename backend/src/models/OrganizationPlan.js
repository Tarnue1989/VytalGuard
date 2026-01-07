// 📁 backend/src/models/OrganizationPlan.js
import { DataTypes, Model } from "sequelize";
import { ORG_PLAN_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class OrganizationPlan extends Model {
    static associate(models) {
      OrganizationPlan.belongsTo(models.Organization, {
        foreignKey: "organization_id",
        as: "organization",
      });
      OrganizationPlan.belongsTo(models.Plan, { foreignKey: "plan_id", as: "plan" });

      // 🔹 Audit relationships
      OrganizationPlan.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      OrganizationPlan.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      OrganizationPlan.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  OrganizationPlan.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      plan_id: { type: DataTypes.UUID, allowNull: false },
      start_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      end_date: { type: DataTypes.DATE, allowNull: true },

      status: {
        type: DataTypes.ENUM(...ORG_PLAN_STATUS),
        allowNull: false,
        defaultValue: ORG_PLAN_STATUS[0], // "active"
      },

      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "OrganizationPlan",
      tableName: "organization_plans",
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
        expired: { where: { status: "expired" } },
      },
    }
  );

  return OrganizationPlan;
};
