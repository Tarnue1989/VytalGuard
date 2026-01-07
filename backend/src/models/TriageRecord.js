// 📁 backend/src/models/TriageRecord.js
import { DataTypes, Model } from "sequelize";
import { TRIAGE_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class TriageRecord extends Model {
    static associate(models) {
      // 🔹 Patient & Staff
      TriageRecord.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      TriageRecord.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      TriageRecord.belongsTo(models.Employee, { as: "nurse", foreignKey: "nurse_id" });

      // 🔹 Clinical Links
      TriageRecord.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });

      // 🔹 Billing
      TriageRecord.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      TriageRecord.belongsTo(models.BillableItem, { as: "triageType", foreignKey: "triage_type_id" });

      // 🔹 Org / Facility
      TriageRecord.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      TriageRecord.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit
      TriageRecord.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      TriageRecord.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      TriageRecord.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  TriageRecord.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 References
      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: true },
      nurse_id: { type: DataTypes.UUID, allowNull: true },
      registration_log_id: { type: DataTypes.UUID, allowNull: true },
      invoice_id: { type: DataTypes.UUID, allowNull: true },
      triage_type_id: { type: DataTypes.UUID, allowNull: true },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 📝 Clinical Info
      triage_status: {
        type: DataTypes.ENUM(...TRIAGE_STATUS),
        allowNull: false,
        defaultValue: TRIAGE_STATUS[0],
      },
      symptoms: { type: DataTypes.TEXT, allowNull: true },
      triage_notes: { type: DataTypes.TEXT, allowNull: true },

      // 🩺 Vitals
      bp: { type: DataTypes.STRING(20), allowNull: true },
      pulse: { type: DataTypes.INTEGER, allowNull: true },
      rr: { type: DataTypes.INTEGER, allowNull: true },
      temp: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      oxygen: { type: DataTypes.INTEGER, allowNull: true },
      weight: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      height: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      rbg: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
      pain_score: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0, max: 10 } },
      position: { type: DataTypes.STRING(50), allowNull: true },

      // ⏱️ Time
      recorded_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },

      // 🔹 Audit
      created_by_id: { type: DataTypes.UUID, allowNull: true },
      updated_by_id: { type: DataTypes.UUID, allowNull: true },
      deleted_by_id: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: "TriageRecord",
      tableName: "triage_records",
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
        { fields: ["patient_id"], name: "idx_triage_records_patient_id" },
        { fields: ["organization_id"], name: "idx_triage_records_org_id" },
        { fields: ["facility_id"], name: "idx_triage_records_facility_id" },
        { fields: ["recorded_at"], name: "idx_triage_records_recorded_at" },
        { fields: ["triage_status"], name: "idx_triage_records_status" },
      ],
    }
  );

  return TriageRecord;
};
