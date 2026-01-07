// 📁 backend/src/models/MaternityVisit.js
import { DataTypes, Model } from "sequelize";
import { MATERNITY_VISIT_STATUS } from "../constants/enums.js";

export default (sequelize) => {
  class MaternityVisit extends Model {
    static associate(models) {
      // 🔗 Core clinical relations
      MaternityVisit.belongsTo(models.Patient, { as: "patient", foreignKey: "patient_id" });
      MaternityVisit.belongsTo(models.Employee, { as: "doctor", foreignKey: "doctor_id" });
      MaternityVisit.belongsTo(models.Employee, { as: "midwife", foreignKey: "midwife_id" });
      MaternityVisit.belongsTo(models.Department, { as: "department", foreignKey: "department_id" });
      MaternityVisit.belongsTo(models.Consultation, { as: "consultation", foreignKey: "consultation_id" });
      MaternityVisit.belongsTo(models.RegistrationLog, {
        as: "registrationLog",
        foreignKey: "registration_log_id",
      });
      MaternityVisit.belongsTo(models.BillableItem, { as: "billableItem", foreignKey: "billable_item_id" });
      MaternityVisit.belongsTo(models.Invoice, { as: "invoice", foreignKey: "invoice_id" });

      // 🏢 Tenant scope
      MaternityVisit.belongsTo(models.Organization, { as: "organization", foreignKey: "organization_id" });
      MaternityVisit.belongsTo(models.Facility, { as: "facility", foreignKey: "facility_id" });

      // 🕵🏽 Audit & lifecycle users
      MaternityVisit.belongsTo(models.User, { as: "verifiedBy", foreignKey: "verified_by_id" });
      MaternityVisit.belongsTo(models.User, { as: "finalizedBy", foreignKey: "finalized_by_id" });
      MaternityVisit.belongsTo(models.User, { as: "cancelledBy", foreignKey: "cancelled_by_id" });
      MaternityVisit.belongsTo(models.User, { as: "voidedBy", foreignKey: "voided_by_id" });
      MaternityVisit.belongsTo(models.User, { as: "createdBy", foreignKey: "created_by_id" });
      MaternityVisit.belongsTo(models.User, { as: "updatedBy", foreignKey: "updated_by_id" });
      MaternityVisit.belongsTo(models.User, { as: "deletedBy", foreignKey: "deleted_by_id" });
    }
  }

  MaternityVisit.init(
    {
      // =============================
      // 🔑 Primary
      // =============================
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // =============================
      // 🏢 Multi-Tenant
      // =============================
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // =============================
      // 🔗 Clinical Links
      // =============================
      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID },
      midwife_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      consultation_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },

      // =============================
      // 📅 Visit Info
      // =============================
      visit_date: { type: DataTypes.DATE, allowNull: false }, // parity with ultrasound
      visit_type: { type: DataTypes.STRING }, // auto-derived from billable item

      // =============================
      // 🤰 Maternal Observations
      // =============================
      lnmp: { type: DataTypes.DATE },
      expected_due_date: { type: DataTypes.DATE },
      estimated_gestational_age: { type: DataTypes.STRING },
      fundus_height: { type: DataTypes.STRING },
      fetal_heart_rate: { type: DataTypes.STRING },
      presentation: { type: DataTypes.STRING },
      position: { type: DataTypes.STRING },
      complaint: { type: DataTypes.TEXT },
      gravida: { type: DataTypes.INTEGER },
      para: { type: DataTypes.INTEGER },
      abortion: { type: DataTypes.INTEGER },
      living: { type: DataTypes.INTEGER },
      visit_notes: { type: DataTypes.TEXT },

      // =============================
      // 🩺 Vitals (Analytics-Ready)
      // =============================
      blood_pressure: { type: DataTypes.STRING }, // e.g. "120/80"
      weight: { type: DataTypes.FLOAT },           // kg
      height: { type: DataTypes.FLOAT },           // cm
      temperature: { type: DataTypes.FLOAT },      // °C
      pulse_rate: { type: DataTypes.INTEGER },     // bpm

      // =============================
      // 🚨 Flags & Status
      // =============================
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...MATERNITY_VISIT_STATUS),
        allowNull: false,
        defaultValue: MATERNITY_VISIT_STATUS[0], // scheduled
      },

      // =============================
      // ⏱ Lifecycle Timestamps
      // =============================
      verified_at: { type: DataTypes.DATE },
      finalized_at: { type: DataTypes.DATE },
      cancelled_at: { type: DataTypes.DATE },
      voided_at: { type: DataTypes.DATE },

      // =============================
      // 👤 Lifecycle Users
      // =============================
      verified_by_id: { type: DataTypes.UUID },
      finalized_by_id: { type: DataTypes.UUID },
      cancelled_by_id: { type: DataTypes.UUID },
      voided_by_id: { type: DataTypes.UUID },

      // =============================
      // 🧾 Reasons
      // =============================
      cancel_reason: { type: DataTypes.TEXT },
      void_reason: { type: DataTypes.TEXT },

      // =============================
      // 🕵🏽 Audit Trail
      // =============================
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },
    },
    {
      sequelize,
      modelName: "MaternityVisit",
      tableName: "maternity_visits",
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
        { fields: ["organization_id"], name: "idx_maternity_visits_org" },
        { fields: ["facility_id"], name: "idx_maternity_visits_facility" },
        { fields: ["patient_id"], name: "idx_maternity_visits_patient" },
        { fields: ["registration_log_id"], name: "idx_maternity_visits_registration_log" },
        { fields: ["visit_date"], name: "idx_maternity_visits_visit_date" },
        { fields: ["status"], name: "idx_maternity_visits_status" },
        { fields: ["midwife_id"], name: "idx_maternity_visits_midwife" },
        { fields: ["visit_type"], name: "idx_maternity_visits_visit_type" },
        { fields: ["invoice_id"], name: "idx_maternity_visits_invoice" },
      ],
    }
  );

  return MaternityVisit;
};
