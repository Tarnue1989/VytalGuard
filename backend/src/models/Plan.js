// 📁 backend/src/models/Plan.js
import { DataTypes, Model } from "sequelize";
import { PLAN_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Plan extends Model {
    static associate(models) {
      Plan.hasMany(models.OrganizationPlan, { foreignKey: "plan_id", as: "organizationPlans" });
      Plan.hasMany(models.PlanModule, { foreignKey: "plan_id", as: "modules" });

      // 🔹 Audit relationships
      Plan.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Plan.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Plan.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Plan.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

      status: {
        type: DataTypes.ENUM(...Object.values(PLAN_STATUS)),
        allowNull: false,
        defaultValue: PLAN_STATUS.ACTIVE,
      },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Plan",
      tableName: "plans",
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
      },
      indexes: [
        { fields: ["name"], unique: true },
        { fields: ["status"] },
      ],
    }
  );

  return Plan;
};
