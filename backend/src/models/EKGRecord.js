// 📁 backend/src/models/EKGRecord.js
import { DataTypes, Model } from "sequelize";
import { EKG_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class EKGRecord extends Model {
    static associate(models) {
      // 🔹 Core Links
      EKGRecord.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      EKGRecord.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      EKGRecord.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });
      EKGRecord.belongsTo(models.Employee, { as: "technician", foreignKey: "technician_id" });
      EKGRecord.belongsTo(models.User, { as: "verifiedBy", foreignKey: "verified_by_id" });
      EKGRecord.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      EKGRecord.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🔹 Org / Facility
      EKGRecord.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      EKGRecord.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🔹 Audit & Lifecycle
      EKGRecord.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
      EKGRecord.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });
      EKGRecord.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      EKGRecord.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      EKGRecord.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  EKGRecord.init(
    {
      id: { type: DataTypes.UUID, defaultValue: sequelize.literal("gen_random_uuid()"), primaryKey: true },

      // Tenant
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },
      technician_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },

      // 💓 EKG Observations
      heart_rate: { type: DataTypes.INTEGER },
      pr_interval: { type: DataTypes.DECIMAL(5, 2) },
      qrs_duration: { type: DataTypes.DECIMAL(5, 2) },
      qt_interval: { type: DataTypes.DECIMAL(5, 2) },
      axis: { type: DataTypes.STRING },
      rhythm: { type: DataTypes.STRING },
      interpretation: { type: DataTypes.TEXT },
      recommendation: { type: DataTypes.TEXT },
      note: { type: DataTypes.TEXT },

      // 📅 Scan Info
      recorded_date: { type: DataTypes.DATE },
      file_path: { type: DataTypes.TEXT },
      source: { type: DataTypes.STRING },

      // 🚨 Lifecycle & Flags
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...Object.values(EKG_STATUS)),
        allowNull: false,
        defaultValue: EKG_STATUS.PENDING,
      },

      // Workflow timestamps
      verified_at: { type: DataTypes.DATE },
      finalized_at: { type: DataTypes.DATE },
      finalized_by_id: { type: DataTypes.UUID },
      voided_at: { type: DataTypes.DATE },
      voided_by_id: { type: DataTypes.UUID },

      // 🕵🏽 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "EKGRecord",
      tableName: "ekg_records",
      underscored: true,
      paranoid: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      deletedAt: "deleted_at",
      defaultScope: { attributes: { exclude: ["deleted_at", "deleted_by_id"] } },
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
        { fields: ["consultation_id"] },
        { fields: ["registration_log_id"] },
        { fields: ["recorded_date"] },
        { fields: ["status"] },
        { fields: ["technician_id"] },
      ],
    }
  );

  return EKGRecord;
};
