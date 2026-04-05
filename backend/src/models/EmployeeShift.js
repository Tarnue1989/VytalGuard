// 📁 backend/src/models/EmployeeShift.js
import { DataTypes, Model } from "sequelize";
import { EMPLOYEE_SHIFT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class EmployeeShift extends Model {
    static associate(models) {
      // 🔗 Relations
      EmployeeShift.belongsTo(models.Employee, { as: "employee", foreignKey: "employee_id" });

      // Org / Facility
      EmployeeShift.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      EmployeeShift.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      EmployeeShift.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      EmployeeShift.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      EmployeeShift.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  EmployeeShift.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      employee_id: { type: DataTypes.UUID, allowNull: false },
      day_of_week: { type: DataTypes.STRING, allowNull: false },
      shift_start_time: { type: DataTypes.TIME, allowNull: false },
      shift_end_time: { type: DataTypes.TIME, allowNull: false },
      
      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(EMPLOYEE_SHIFT_STATUS)),
        allowNull: false,
        defaultValue: EMPLOYEE_SHIFT_STATUS.ACTIVE,
      },
      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "EmployeeShift",
      tableName: "employee_shifts",
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
        { fields: ["employee_id"] },
        { fields: ["day_of_week"] },
        { fields: ["status"] },
      ],
      uniqueKeys: {
        unique_employee_shift: {
          fields: ["employee_id", "day_of_week", "shift_start_time", "shift_end_time"],
        },
      },
    }
  );

  return EmployeeShift;
};
