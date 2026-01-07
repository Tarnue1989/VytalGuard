import { DataTypes, Model } from "sequelize";
import { LAB_REQUEST_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class LabRequest extends Model {
    static associate(models) {
      // 🔗 Core relations
      LabRequest.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      LabRequest.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      LabRequest.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      LabRequest.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });
      LabRequest.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      LabRequest.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🔗 Items (1 request → many tests)
      LabRequest.hasMany(models.LabRequestItem, {
        as: "items",
        foreignKey: "lab_request_id",
      });

      // 🔗 Results
      LabRequest.hasMany(models.LabResult, {
        as: "labResults",
        foreignKey: "lab_request_id",
      });

      // Org / Facility
      LabRequest.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      LabRequest.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      LabRequest.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      LabRequest.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      LabRequest.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  LabRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: true },
      department_id: { type: DataTypes.UUID, allowNull: true },
      registration_log_id: { type: DataTypes.UUID, allowNull: true },
      consultation_id: { type: DataTypes.UUID, allowNull: true },
      invoice_id: { type: DataTypes.UUID, allowNull: true },

      // ⚡ Full datetime
      request_date: { type: DataTypes.DATE, allowNull: false },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...LAB_REQUEST_STATUS),
        allowNull: false,
        defaultValue: LAB_REQUEST_STATUS[0],
      },

      notes: { type: DataTypes.TEXT },
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      billed: { type: DataTypes.BOOLEAN, defaultValue: false },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "LabRequest",
      tableName: "lab_requests",
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
        tenant(facilityId) {
          if (!facilityId) return {};
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["doctor_id"] },
        { fields: ["registration_log_id"] },
        { fields: ["consultation_id"] },
        { fields: ["status"] },
        // ❌ removed unique(patient_id, request_date)
      ],
    }
  );

  // ⚡ Auto-mark billed when invoice is linked
  LabRequest.addHook("beforeSave", (request) => {
    if (request.invoice_id && !request.billed) {
      request.billed = true;
    }
  });

  return LabRequest;
};
