// 📁 backend/src/models/UltrasoundRecord.js
import { DataTypes, Model } from "sequelize";
import { ULTRASOUND_STATUS, GENDER_TYPES } from "../constants/enums.js";

export default (sequelize) => {
  class UltrasoundRecord extends Model {
    static associate(models) {
      // 🔗 Core relations
      UltrasoundRecord.belongsTo(models.Patient, {
        as: "patient",
        foreignKey: "patient_id",
      });

      UltrasoundRecord.belongsTo(models.Consultation, {
        as: "consultation",
        foreignKey: "consultation_id",
      });

      UltrasoundRecord.belongsTo(models.MaternityVisit, {
        as: "maternityVisit",
        foreignKey: "maternity_visit_id",
      });

      UltrasoundRecord.belongsTo(models.RegistrationLog, {
        as: "registrationLog",
        foreignKey: "registration_log_id",
      });

      UltrasoundRecord.belongsTo(models.Employee, {
        as: "technician",
        foreignKey: "technician_id",
      });

      UltrasoundRecord.belongsTo(models.Department, {
        as: "department",
        foreignKey: "department_id",
      });

      UltrasoundRecord.belongsTo(models.BillableItem, {
        as: "billableItem",
        foreignKey: "billable_item_id",
      });

      UltrasoundRecord.belongsTo(models.Invoice, {
        as: "invoice",
        foreignKey: "invoice_id",
      });

      // 🔎 Workflow actors
      UltrasoundRecord.belongsTo(models.User, {
        as: "verifiedBy",
        foreignKey: "verified_by_id",
      });

      UltrasoundRecord.belongsTo(models.User, {
        as: "finalizedBy",
        foreignKey: "finalized_by_id",
      });

      UltrasoundRecord.belongsTo(models.User, {
        as: "cancelledBy",
        foreignKey: "cancelled_by_id",
      });

      UltrasoundRecord.belongsTo(models.User, {
        as: "voidedBy",
        foreignKey: "voided_by_id",
      });

      // 🏥 Org / Facility
      UltrasoundRecord.belongsTo(models.Organization, {
        as: "organization",
        foreignKey: "organization_id",
      });

      UltrasoundRecord.belongsTo(models.Facility, {
        as: "facility",
        foreignKey: "facility_id",
      });

      // 🧾 Audit
      UltrasoundRecord.belongsTo(models.User, {
        as: "createdBy",
        foreignKey: "created_by_id",
      });

      UltrasoundRecord.belongsTo(models.User, {
        as: "updatedBy",
        foreignKey: "updated_by_id",
      });

      UltrasoundRecord.belongsTo(models.User, {
        as: "deletedBy",
        foreignKey: "deleted_by_id",
      });
    }
  }

  UltrasoundRecord.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      /* ================= TENANCY ================= */
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      /* ================= RELATIONS ================= */
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: DataTypes.UUID,
      maternity_visit_id: DataTypes.UUID,
      registration_log_id: DataTypes.UUID,
      technician_id: DataTypes.UUID,
      department_id: DataTypes.UUID,
      billable_item_id: DataTypes.UUID,
      invoice_id: DataTypes.UUID,

      /* ================= SCAN DATA ================= */
      scan_type: { type: DataTypes.STRING, allowNull: false },
      scan_date: { type: DataTypes.DATEONLY, allowNull: false },
      scan_location: DataTypes.STRING,

      /* ================= CLINICAL FINDINGS ================= */
      ultra_findings: DataTypes.TEXT,
      note: DataTypes.TEXT,
      number_of_fetus: DataTypes.INTEGER,
      biparietal_diameter: DataTypes.DECIMAL(5, 2),
      presentation: DataTypes.STRING,
      lie: DataTypes.STRING,
      position: DataTypes.STRING,
      amniotic_volume: DataTypes.DECIMAL(5, 2),
      fetal_heart_rate: DataTypes.INTEGER,
      gender: DataTypes.ENUM(...GENDER_TYPES),

      /* ================= OBSTETRIC EXTENSIONS ================= */
      previous_cesarean: { type: DataTypes.BOOLEAN, defaultValue: false },
      prev_ces_date: DataTypes.DATEONLY,
      prev_ces_location: DataTypes.STRING,
      cesarean_date: DataTypes.DATEONLY,
      indication: DataTypes.STRING,
      next_of_kin: DataTypes.STRING,

      /* ================= FLAGS ================= */
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },

      /* ================= LIFECYCLE ================= */
      status: {
        type: DataTypes.ENUM(...ULTRASOUND_STATUS),
        allowNull: false,
        defaultValue: ULTRASOUND_STATUS[0], // pending
      },

      /* ================= WORKFLOW TIMESTAMPS ================= */
      verified_by_id: DataTypes.UUID,
      verified_at: DataTypes.DATE,

      finalized_by_id: DataTypes.UUID,
      finalized_at: DataTypes.DATE,

      cancelled_by_id: DataTypes.UUID,
      cancelled_at: DataTypes.DATE,

      voided_by_id: DataTypes.UUID,
      voided_at: DataTypes.DATE,
      void_reason: DataTypes.TEXT, 
      /* ================= FILE ATTACHMENT ================= */
      source: DataTypes.STRING,
      file_path: DataTypes.TEXT,

      /* ================= AUDIT ================= */
      created_by_id: DataTypes.UUID,
      updated_by_id: DataTypes.UUID,
      deleted_by_id: DataTypes.UUID,
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

        pending: { where: { status: ULTRASOUND_STATUS[0] } },
        inProgress: { where: { status: ULTRASOUND_STATUS[1] } },
        completed: { where: { status: ULTRASOUND_STATUS[2] } },
        verified: { where: { status: ULTRASOUND_STATUS[3] } },
        finalized: { where: { status: ULTRASOUND_STATUS[4] } },
        cancelled: { where: { status: ULTRASOUND_STATUS[5] } },
        voided: { where: { status: ULTRASOUND_STATUS[6] } },

        tenant(facilityId) {
          return facilityId ? { where: { facility_id: facilityId } } : {};
        },
      },

      indexes: [
        "organization_id",
        "facility_id",
        "patient_id",
        "consultation_id",
        "maternity_visit_id",
        "registration_log_id",
        "technician_id",
        "billable_item_id",
        "invoice_id",
        "scan_date",
        "status",
      ].map((f) => ({ fields: [f] })),
    }
  );

  return UltrasoundRecord;
};
