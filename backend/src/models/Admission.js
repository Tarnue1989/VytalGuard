// 📁 backend/src/models/Admission.js
import { DataTypes, Model } from "sequelize";
import { ADMISSION_STATUS, ADMISSION_TYPE } from "../constants/enums.js";

export default (sequelize) => {
  class Admission extends Model {
    static associate(models) {
      // 🔗 Core relations
      Admission.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      Admission.belongsTo(models.Employee, { as: "admittingDoctor", foreignKey: "admitting_doctor_id" });
      Admission.belongsTo(models.Employee, { as: "dischargingDoctor", foreignKey: "discharging_doctor_id" });
      Admission.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      Admission.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      Admission.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      Admission.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });
      Admission.belongsTo(models.InsuranceProvider, { as: "insurance", foreignKey: "insurance_id" });
      Admission.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" }); // ✅ Added

      // Org / Facility
      Admission.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Admission.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit & Status Users
      Admission.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Admission.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Admission.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
      Admission.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
      Admission.belongsTo(models.User, { as: "verifiedBy", foreignKey: "verified_by_id" });
      Admission.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });
    }
  }

  Admission.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Core links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      admitting_doctor_id: { type: DataTypes.UUID, allowNull: false },
      discharging_doctor_id: { type: DataTypes.UUID, allowNull: true },
      department_id: { type: DataTypes.UUID, allowNull: true },
      consultation_id: { type: DataTypes.UUID, allowNull: true },
      billable_item_id: { type: DataTypes.UUID, allowNull: false },
      invoice_id: { type: DataTypes.UUID, allowNull: true },
      insurance_id: { type: DataTypes.UUID, allowNull: true },

      // ✅ NEW LINK
      registration_log_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "registration_logs", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // 📅 Dates
      admit_date: { type: DataTypes.DATEONLY, allowNull: false },
      discharge_date: { type: DataTypes.DATEONLY, allowNull: true },

// 🏷️ Lifecycle
status: {
  type: DataTypes.ENUM(...Object.values(ADMISSION_STATUS)),
  allowNull: false,
  defaultValue: ADMISSION_STATUS.ADMITTED,
},
admission_type: {
  type: DataTypes.ENUM(...Object.values(ADMISSION_TYPE)),
  allowNull: false,
  defaultValue: ADMISSION_TYPE.ROUTINE,
},

      // 🧾 Details
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      admit_reason: { type: DataTypes.TEXT },
      referral_source: { type: DataTypes.STRING },
      notes: { type: DataTypes.TEXT },
      bed_number: { type: DataTypes.STRING },
      discharge_summary: { type: DataTypes.TEXT },
      cost_override: { type: DataTypes.DECIMAL(12, 2) },
      document_url: { type: DataTypes.STRING },

      // 📌 Finalization / Verification / Voiding
      finalized_at: { type: DataTypes.DATE },
      finalized_by_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },
      verified_at: { type: DataTypes.DATE },
      voided_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Admission",
      tableName: "admissions",
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
        { fields: ["organization_id"], name: "idx_admissions_org_id" },
        { fields: ["facility_id"], name: "idx_admissions_facility_id" },
        { fields: ["patient_id"], name: "idx_admissions_patient_id" },
        { fields: ["admit_date"], name: "idx_admissions_admit_date" },
        { fields: ["status"], name: "idx_admissions_status" },
        { fields: ["registration_log_id"], name: "idx_admissions_reg_log_id" }, // ✅ index
      ],
    }
  );

  return Admission;
};
