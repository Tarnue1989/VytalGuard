// 📁 backend/src/models/UltrasoundRecord.js
import { DataTypes, Model } from "sequelize";
import { ULTRASOUND_STATUS, GENDER_TYPES } from "../constants/enums.js";

export default (sequelize) => {
  class UltrasoundRecord extends Model {
    static associate(models) {
      // 🔗 Core relations
      UltrasoundRecord.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      UltrasoundRecord.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      UltrasoundRecord.belongsTo(models.MaternityVisit, { as: "maternityVisit", foreignKey: "maternity_visit_id" });
      UltrasoundRecord.belongsTo(models.RegistrationLog, { as: "registrationLog", foreignKey: "registration_log_id" });
      UltrasoundRecord.belongsTo(models.Employee, { as: "technician", foreignKey: "technician_id" });
      UltrasoundRecord.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      UltrasoundRecord.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      UltrasoundRecord.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🧭 Lifecycle / Verification
      UltrasoundRecord.belongsTo(models.User, { as: "verifiedBy", foreignKey: "verified_by_id" });
      UltrasoundRecord.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
      UltrasoundRecord.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });

      // 🏢 Tenant
      UltrasoundRecord.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      UltrasoundRecord.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🧾 Audit
      UltrasoundRecord.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      UltrasoundRecord.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      UltrasoundRecord.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  UltrasoundRecord.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🏢 Tenant
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      maternity_visit_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },
      technician_id: { type: DataTypes.UUID },

      // 🧠 Core Scan Info
      scan_type: { type: DataTypes.STRING, allowNull: false },
      scan_date: { type: DataTypes.DATE, allowNull: false },
      scan_location: { type: DataTypes.STRING },

      // 🩺 Observations
      ultra_findings: { type: DataTypes.TEXT },
      note: { type: DataTypes.TEXT },
      number_of_fetus: { type: DataTypes.INTEGER },
      biparietal_diameter: { type: DataTypes.DECIMAL(5, 2) },
      presentation: { type: DataTypes.STRING },
      lie: { type: DataTypes.STRING },
      position: { type: DataTypes.STRING },
      amniotic_volume: { type: DataTypes.DECIMAL(5, 2) },
      fetal_heart_rate: { type: DataTypes.INTEGER },
      gender: { type: DataTypes.ENUM(...GENDER_TYPES) },

      // 🤰 Obstetric Fields
      previous_cesarean: { type: DataTypes.BOOLEAN, defaultValue: false },
      prev_ces_date: { type: DataTypes.DATE },
      prev_ces_location: { type: DataTypes.STRING },
      cesarean_date: { type: DataTypes.DATE },
      indication: { type: DataTypes.STRING },
      next_of_kin: { type: DataTypes.STRING },

      // 🚨 Flags
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },

      // 🔄 Lifecycle Status
      status: {
        type: DataTypes.ENUM(...ULTRASOUND_STATUS),
        allowNull: false,
        defaultValue: "pending",
      },

      // 🧾 Lifecycle Meta
      verified_by_id: { type: DataTypes.UUID },
      verified_at: { type: DataTypes.DATE },
      finalized_by_id: { type: DataTypes.UUID },
      finalized_at: { type: DataTypes.DATE },
      voided_by_id: { type: DataTypes.UUID },
      void_reason: { type: DataTypes.TEXT }, // ✅ NEW (for cancel/void consistency)
      voided_at: { type: DataTypes.DATE },

      // 📎 Optional File Linkage
      source: { type: DataTypes.STRING },
      file_path: { type: DataTypes.TEXT },

      // 🧑‍💻 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "UltrasoundRecord",
      tableName: "ultrasound_records",
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
        { fields: ["consultation_id"] },
        { fields: ["maternity_visit_id"] },
        { fields: ["registration_log_id"] },
        { fields: ["billable_item_id"] },
        { fields: ["invoice_id"] },
        { fields: ["technician_id"] },
        { fields: ["scan_date"] },
        { fields: ["status"] },
      ],
    }
  );

  return UltrasoundRecord;
};
