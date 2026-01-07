// 📁 backend/src/models/Employee.js
import { DataTypes, Model } from "sequelize";
import { EMPLOYEE_STATUS, GENDER_TYPES, EMPLOYEE_POSITIONS } from "../constants/enums.js";

export default (sequelize) => {
  class Employee extends Model {
    static associate(models) {
      // 🔹 Org / Facility
      Employee.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
      Employee.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔹 Department
      Employee.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
        constraints: false,
      });

      Employee.hasMany(models.Department, {
        as: "headed_departments",
        foreignKey: "head_of_department_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
        constraints: false,
      });

      // 🔹 Link to User
      Employee.belongsTo(models.User, {
        as: "user",
        foreignKey: "user_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // 🔹 Audit
      Employee.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Employee.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Employee.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }

    // Virtual full name
    get full_name() {
      return [this.first_name, this.middle_name, this.last_name].filter(Boolean).join(" ");
    }

    // 🔑 Ensure virtuals show up in API responses
    toJSON() {
      return {
        ...this.get(),
        full_name: this.full_name,
      };
    }
  }

  Employee.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Identity
      first_name: { type: DataTypes.STRING(80), allowNull: false },
      middle_name: { type: DataTypes.STRING(80), allowNull: true },
      last_name: { type: DataTypes.STRING(80), allowNull: false },
      gender: { type: DataTypes.ENUM(...GENDER_TYPES), allowNull: false },
      dob: { type: DataTypes.DATEONLY, allowNull: true },

      // Contact
      phone: { type: DataTypes.STRING(50), allowNull: true },
      email: { type: DataTypes.STRING(120), allowNull: true, validate: { isEmail: true } },
      address: { type: DataTypes.STRING(255), allowNull: true },

      // Employment
      employee_no: { type: DataTypes.STRING(50), allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: true },
      department_id: { type: DataTypes.UUID, allowNull: true },
      position: { type: DataTypes.STRING(120), allowNull: true },
      status: { type: DataTypes.ENUM(...EMPLOYEE_STATUS), defaultValue: EMPLOYEE_STATUS[0] },

      // Professional
      license_no: { type: DataTypes.STRING(120), allowNull: true },
      specialty: { type: DataTypes.STRING(120), allowNull: true },
      certifications: { type: DataTypes.TEXT, allowNull: true },

      // Dates
      hire_date: { type: DataTypes.DATE, allowNull: true },
      termination_date: { type: DataTypes.DATE, allowNull: true },

      // Emergency
      emergency_contact_name: { type: DataTypes.STRING(120), allowNull: true },
      emergency_contact_phone: { type: DataTypes.STRING(50), allowNull: true },

      // Uploads
      photo_path: { type: DataTypes.STRING(255), allowNull: true },
      resume_url: { type: DataTypes.STRING(255), allowNull: true },
      document_url: { type: DataTypes.STRING(255), allowNull: true },

      // Link
      user_id: { type: DataTypes.UUID, allowNull: true },

      // Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Employee",
      tableName: "employees",
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
        byFacility(facilityId) {
          return { where: { facility_id: facilityId } };
        },
        byOrganization(orgId) {
          return { where: { organization_id: orgId } };
        },
        active: { where: { status: "active" } },
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { unique: true, fields: ["organization_id", "employee_no"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["phone"] },
        { fields: ["status"] },
      ],
    }
  );

  return Employee;
};
