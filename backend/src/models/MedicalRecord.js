// 📁 backend/src/models/MedicalRecord.js
import { DataTypes, Model } from "sequelize";
import { MEDICAL_RECORD_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class MedicalRecord extends Model {
    static associate(models) {
      // 🔹 Clinical Links
      MedicalRecord.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      MedicalRecord.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      MedicalRecord.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      MedicalRecord.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });
      MedicalRecord.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🔹 Org / Facility
      MedicalRecord.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      MedicalRecord.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit + Lifecycle
      MedicalRecord.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      MedicalRecord.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      MedicalRecord.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
      MedicalRecord.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
      MedicalRecord.belongsTo(models.User, { as: "verifiedBy", foreignKey: "verified_by_id" });
      MedicalRecord.belongsTo(models.User, { as: "reviewedBy", foreignKey: "reviewed_by_id" });
      MedicalRecord.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });
    }
  }

  MedicalRecord.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 References
      consultation_id: { type: DataTypes.UUID, allowNull: true },
      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: true }, // ✅ nullable
      registration_log_id: { type: DataTypes.UUID, allowNull: true },
      invoice_id: { type: DataTypes.UUID, allowNull: true },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🏷️ Clinical Status
      status: {
        type: DataTypes.ENUM(...MEDICAL_RECORD_STATUS),
        allowNull: false,
        defaultValue: MEDICAL_RECORD_STATUS[0], // "draft"
      },
      is_emergency: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // 📎 File Attachment
      report_path: { type: DataTypes.STRING(255), allowNull: true },

      // 🧠 Clinical History
      cc: { type: DataTypes.TEXT },
      hpi: { type: DataTypes.TEXT },
      pmh: { type: DataTypes.TEXT },
      fh_sh: { type: DataTypes.TEXT },
      nut_hx: { type: DataTypes.TEXT },
      imm_hx: { type: DataTypes.TEXT },
      obs_hx: { type: DataTypes.TEXT },
      gyn_hx: { type: DataTypes.TEXT },

      // 🧍 Physical Exam
      pe: { type: DataTypes.TEXT },
      resp_ex: { type: DataTypes.TEXT },
      cv_ex: { type: DataTypes.TEXT },
      abd_ex: { type: DataTypes.TEXT },
      pel_ex: { type: DataTypes.TEXT },
      ext: { type: DataTypes.TEXT },
      neuro_ex: { type: DataTypes.TEXT },

      // 🧪 Diagnosis + Plan
      ddx: { type: DataTypes.TEXT },
      dx: { type: DataTypes.TEXT },
      lab_inv: { type: DataTypes.TEXT },
      img_inv: { type: DataTypes.TEXT },
      tx_mx: { type: DataTypes.TEXT },
      summary_pg: { type: DataTypes.TEXT },
      
      // 📍 In MedicalRecord.init()
      recorded_at: { type: DataTypes.DATE, allowNull: true },

      // 🔹 Lifecycle actions
      reviewed_at: { type: DataTypes.DATE },
      reviewed_by_id: { type: DataTypes.UUID, allowNull: true },

      finalized_at: { type: DataTypes.DATE },
      finalized_by_id: { type: DataTypes.UUID, allowNull: true },

      verified_at: { type: DataTypes.DATE },
      verified_by_id: { type: DataTypes.UUID, allowNull: true },

      voided_at: { type: DataTypes.DATE },
      voided_by_id: { type: DataTypes.UUID, allowNull: true },
      void_reason: { type: DataTypes.TEXT, allowNull: true },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "MedicalRecord",
      tableName: "medical_records",
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

        // 🔑 Tenant scope → required for setTenantScope
        tenant(facilityId) {
          if (!facilityId) return {}; // safeguard superadmin case
          return { where: { facility_id: facilityId } };
        },
      },
      indexes: [
        { fields: ["patient_id"], name: "idx_medical_records_patient_id" },
        { fields: ["consultation_id"], name: "idx_medical_records_consultation_id" },
        { fields: ["doctor_id"], name: "idx_medical_records_doctor_id" },
        { fields: ["invoice_id"], name: "idx_medical_records_invoice_id" },
        { fields: ["status"], name: "idx_medical_records_status" },
        { fields: ["organization_id"], name: "idx_medical_records_org" },
        { fields: ["facility_id"], name: "idx_medical_records_facility" },
      ],
    }
  );

  return MedicalRecord;
};
