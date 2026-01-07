// 📁 backend/src/models/PlanModule.js
import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class PlanModule extends Model {
    static associate(models) {
      PlanModule.belongsTo(models.Plan, { foreignKey: "plan_id", as: "plan" });
      PlanModule.belongsTo(models.FeatureModule, { foreignKey: "module_id", as: "module" });

      // 🔹 Audit relationships
      PlanModule.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      PlanModule.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      PlanModule.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  PlanModule.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },
      plan_id: { type: DataTypes.UUID, allowNull: false },
      module_id: { type: DataTypes.UUID, allowNull: false },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "PlanModule",
      tableName: "plan_modules",
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
      },
      indexes: [
        { fields: ["plan_id"] },
        { fields: ["module_id"] },
        { fields: ["enabled"] },
      ],
      uniqueKeys: {
        unique_plan_module: {
          fields: ["plan_id", "module_id"],
        },
      },
    }
  );

  return PlanModule;
};
