// 📁 backend/src/models/Prescription.js
import { DataTypes, Model } from "sequelize";
import { PRESCRIPTION_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class Prescription extends Model {
    static associate(models) {
      // 🔗 Patient & Consultation
      Prescription.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      Prescription.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      Prescription.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      Prescription.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      Prescription.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });

      // Linked entities
      Prescription.hasMany(models.PrescriptionItem, { as: "items", foreignKey: "prescription_id" });
      Prescription.hasMany(models.PharmacyTransaction, { as: "transactions", foreignKey: "prescription_id" });

      // Optional billing
      Prescription.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // Org / Facility
      Prescription.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      Prescription.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // Audit
      Prescription.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      Prescription.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      Prescription.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
      Prescription.belongsTo(models.User, { as: "fulfilledBy", foreignKey: "fulfilled_by_id" }); // ✅ new
    }
  }

  Prescription.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      consultation_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },
      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: true },
      department_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },

      // Flags
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      notes: { type: DataTypes.TEXT },
      prescription_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: DataTypes.NOW,   // ✅ lets Postgres insert today’s date
      },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...Object.values(PRESCRIPTION_STATUS)),
        allowNull: false,
        defaultValue: PRESCRIPTION_STATUS.DRAFT,
      },

      // Lifecycle timestamps
      issued_at: { type: DataTypes.DATE },
      dispensed_at: { type: DataTypes.DATE },
      completed_at: { type: DataTypes.DATE },
      fulfilled_at: { type: DataTypes.DATE },           // ✅ new

      // Fulfillment (pharmacist tracking)
      fulfilled_by_id: { type: DataTypes.UUID },        // ✅ new

      // Billing
      billed: { type: DataTypes.BOOLEAN, defaultValue: false },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "Prescription",
      tableName: "prescriptions",
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
          return facilityId ? { where: { facility_id: facilityId } } : {};
        },
      },
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["facility_id"] },
        { fields: ["patient_id"] },
        { fields: ["doctor_id"] },
        { fields: ["registration_log_id"] },
        { fields: ["invoice_id"] },
        { fields: ["status"] },
        { fields: ["organization_id", "facility_id", "status"] }, // ✅ composite
      ],
    }
  );

  // ⚡ Auto-mark billed when invoice is linked
  Prescription.addHook("beforeSave", (prescription) => {
    prescription.billed = !!prescription.invoice_id;
  });

  return Prescription;
};
