// 📁 backend/src/models/PatientEmployeeLink.js
import { DataTypes, Model } from "sequelize";
import { RELATION_TYPE, LINK_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class PatientEmployeeLink extends Model {
    static associate(models) {
      // 🔗 Patient
      PatientEmployeeLink.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      // 🔗 Employee
      PatientEmployeeLink.belongsTo(models.Employee, {
        as: "employee",
        foreignKey: "employee_id",
      });

      // 🔹 Tenant scope
      PatientEmployeeLink.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });
      PatientEmployeeLink.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🔹 Audit
      PatientEmployeeLink.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      PatientEmployeeLink.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      PatientEmployeeLink.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  PatientEmployeeLink.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Core links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      employee_id: { type: DataTypes.UUID, allowNull: false },

      // 📌 Relationship
      relation_type: {
        type: DataTypes.ENUM(...Object.values(RELATION_TYPE)), // self | spouse | child | dependent | other
        allowNull: false,
        defaultValue: RELATION_TYPE.SELF,
      },

      // 📌 Status
      status: {
        type: DataTypes.ENUM(...Object.values(LINK_STATUS)), // active | inactive
        allowNull: false,
        defaultValue: LINK_STATUS.ACTIVE,
      },

      // 🔹 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: true },
      facility_id: { type: DataTypes.UUID, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "PatientEmployeeLink",
      tableName: "patient_employee_links",
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
          if (!facilityId) return {}; // safeguard for superadmin
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["patient_id"] },
        { fields: ["employee_id"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["relation_type"] },
        { fields: ["status"] },
      ],
    }
  );

  return PatientEmployeeLink;
};
