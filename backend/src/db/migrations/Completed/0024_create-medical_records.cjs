// 📁 backend/src/db/migrations/0019_create-medical_records.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { MEDICAL_RECORD_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("medical_records", {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      // 🔗 References
      consultation_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "consultations", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      doctor_id: {
        type: DataTypes.UUID,
        allowNull: true, // ✅ nullable
        references: { model: "employees", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      registration_log_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "registration_logs", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      invoice_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "invoices", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // 🔗 Tenant scope
      organization_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      facility_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "facilities", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      // 🏷️ Clinical Status
      status: {
        type: DataTypes.ENUM(...MEDICAL_RECORD_STATUS),
        allowNull: false,
        defaultValue: MEDICAL_RECORD_STATUS[0],
      },
      is_emergency: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      
      // 🕒 Clinical timestamp
      recorded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

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

      // 🔹 Lifecycle actions
      reviewed_at: { type: DataTypes.DATE, allowNull: true },
      reviewed_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      finalized_at: { type: DataTypes.DATE, allowNull: true },
      finalized_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      verified_at: { type: DataTypes.DATE, allowNull: true },
      verified_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      voided_at: { type: DataTypes.DATE, allowNull: true },
      voided_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      void_reason: { type: DataTypes.TEXT, allowNull: true },

      // 🕵🏽 Audit
      created_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      updated_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      deleted_by_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // Timestamps
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    });

    // Indexes
    await queryInterface.addIndex("medical_records", ["patient_id"], { name: "idx_medical_records_patient_id" });
    await queryInterface.addIndex("medical_records", ["consultation_id"], { name: "idx_medical_records_consultation_id" });
    await queryInterface.addIndex("medical_records", ["doctor_id"], { name: "idx_medical_records_doctor_id" });
    await queryInterface.addIndex("medical_records", ["invoice_id"], { name: "idx_medical_records_invoice_id" });
    await queryInterface.addIndex("medical_records", ["status"], { name: "idx_medical_records_status" });
    await queryInterface.addIndex("medical_records", ["organization_id"], { name: "idx_medical_records_org" });
    await queryInterface.addIndex("medical_records", ["facility_id"], { name: "idx_medical_records_facility" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("medical_records");
  },
};
