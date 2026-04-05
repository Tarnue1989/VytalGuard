// 📁 backend/src/models/Department.js
import { DataTypes, Model } from "sequelize";
import { DEPARTMENT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Department extends Model {
    static associate(models) {
      // 🔹 Department → Facility
      Department.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 Department → Organization
      Department.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // 🔹 Department → Head of Department
      Department.belongsTo(models.Employee, {
        as: "head_of_department",
        foreignKey: "head_of_department_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
        constraints: false,
      });

      // 🔹 Audit
      Department.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Department.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Department.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Department.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Relations
      facility_id: { type: DataTypes.UUID, allowNull: true },
      organization_id: { type: DataTypes.UUID, allowNull: false }, // ⬅️ org required (aligns w/ Employee)
      head_of_department_id: { type: DataTypes.UUID, allowNull: true },

      // Identity
      name: { type: DataTypes.STRING(120), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },

      // Status
      status: {
        type: DataTypes.ENUM(...Object.values(DEPARTMENT_STATUS)),
        allowNull: false,
        defaultValue: DEPARTMENT_STATUS.ACTIVE,
      },

      // Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Department",
      tableName: "departments",
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
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        // Scoped uniqueness: Department name unique per organization + facility
        { unique: true, fields: ["organization_id", "facility_id", "name"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["status"] },
      ],
    }
  );

  return Department;
};
