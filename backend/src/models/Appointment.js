// 📁 backend/src/models/Appointment.js
import { DataTypes, Model } from "sequelize";
import { APPOINTMENT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Appointment extends Model {
    static associate(models) {
      // 🔗 Patient & Doctor
      Appointment.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      Appointment.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      Appointment.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });

      // 🔗 Org / Facility
      Appointment.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Appointment.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔗 Billing
      Appointment.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🔗 Audit
      Appointment.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Appointment.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Appointment.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  Appointment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      appointment_code: { type: DataTypes.STRING(50), allowNull: false, unique: true },

      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID, allowNull: true },
      invoice_id: { type: DataTypes.UUID, allowNull: true },

      date_time: { type: DataTypes.DATE, allowNull: false },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...APPOINTMENT_STATUS),
        allowNull: false,
        defaultValue: APPOINTMENT_STATUS[0], // "scheduled"
      },

      notes: { type: DataTypes.TEXT },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Appointment",
      tableName: "appointments",
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
        scheduled: { where: { status: "scheduled" } },
        inProgress: { where: { status: "in_progress" } },
        completed: { where: { status: "completed" } },
        cancelled: { where: { status: "cancelled" } },
        noShow: { where: { status: "no_show" } },
        // 🔑 Needed for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin fallback (no filter)
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["doctor_id"] },
        { fields: ["department_id"] },
        { fields: ["invoice_id"] },
        { fields: ["date_time"] },
        { fields: ["status"] },
        // 🚫 Prevent double booking
        { unique: true, fields: ["doctor_id", "date_time"] },
      ],
    }
  );

  return Appointment;
};
