// 📁 backend/src/models/Consultation.js
import { DataTypes, Model } from "sequelize";
import { CONSULTATION_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Consultation extends Model {
    static associate(models) {
      // 🔹 Core Links
      Consultation.belongsTo(models.Appointment, { as: "appointment", foreignKey: "appointment_id" });
      Consultation.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });
      Consultation.belongsTo(models.Recommendation, { as: "recommendation", foreignKey: "recommendation_id" });
      Consultation.belongsTo(models.Consultation, { as: "parentConsultation", foreignKey: "parent_consultation_id" });

      // 🔹 Patient & Doctor
      Consultation.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      Consultation.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      Consultation.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });

      // 🔹 Clinical Link
      Consultation.belongsTo(models.TriageRecord, { as: "triage", foreignKey: "triage_id" });

      // 🔹 Org / Facility
      Consultation.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id", onDelete: "CASCADE" });
      Consultation.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id", onDelete: "CASCADE" });

      // 🔹 Billing
      Consultation.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      Consultation.belongsTo(models.BillableItem, { as: "consultationType", foreignKey: "consultation_type_id" });

      // 🔹 Prescriptions
      Consultation.hasMany(models.Prescription, { as: "prescriptions", foreignKey: "consultation_id" });

      // 🔹 Audit
      Consultation.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Consultation.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Consultation.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });

      // 🔹 Lifecycle
      Consultation.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
      Consultation.belongsTo(models.User, { as: "verifiedBy", foreignKey: "verified_by_id" });
    }
  }

  Consultation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 References
      appointment_id: { type: DataTypes.UUID, allowNull: true },
      registration_log_id: { type: DataTypes.UUID, allowNull: false },
      recommendation_id: { type: DataTypes.UUID, allowNull: true },
      parent_consultation_id: { type: DataTypes.UUID, allowNull: true },
      triage_id: { type: DataTypes.UUID, allowNull: true },   // 🔹 NEW
      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: true },
      department_id: { type: DataTypes.UUID, allowNull: true },
      invoice_id: { type: DataTypes.UUID, allowNull: true },
      consultation_type_id: { type: DataTypes.UUID, allowNull: true },

      // 🔗 Tenant Scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 📝 Clinical Info
      consultation_date: { type: DataTypes.DATEONLY, allowNull: true },
      diagnosis: { type: DataTypes.STRING(255), allowNull: true },
      consultation_notes: { type: DataTypes.TEXT, allowNull: true },
      prescribed_medications: { type: DataTypes.TEXT, allowNull: true }, // legacy fallback

      // 🏷️ Status
      status: {
        type: DataTypes.ENUM(...Object.values(CONSULTATION_STATUS)),
        allowNull: false,
        defaultValue: CONSULTATION_STATUS.OPEN,
      },

      // 📝 Cancellation / Void reasons
      cancel_reason: { type: DataTypes.STRING(255), allowNull: true },
      void_reason: { type: DataTypes.STRING(255), allowNull: true },

      // 🔹 Lifecycle Audit
      finalized_by_id: { type: DataTypes.UUID, allowNull: true },
      verified_by_id: { type: DataTypes.UUID, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "Consultation",
      tableName: "consultations",
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
        byPatient(patientId) {
          return { where: { patient_id: patientId } };
        },
        byDoctor(doctorId) {
          return { where: { doctor_id: doctorId } };
        },
        byOrganization(orgId) {
          return { where: { organization_id: orgId } };
        },
        byFacility(facilityId) {
          return { where: { facility_id: facilityId } };
        },
        active: { where: { status: "open" } },
        // 🔑 Needed for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // superadmin fallback
          return { where: { facility_id: facilityId } };
        },
      },

      indexes: [
        { fields: ["patient_id"] },
        { fields: ["doctor_id"] },
        { fields: ["status"] },
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["triage_id"] },   // 🔹 NEW index
      ],
    }
  );

  return Consultation;
};
