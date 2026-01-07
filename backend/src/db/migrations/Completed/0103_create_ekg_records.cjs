// 📁 backend/src/db/migrations/0100_create_ekg_records.cjs
"use strict";

const { EKG_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ekg_records", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant
      organization_id: { type: Sequelize.UUID, allowNull: false },
      facility_id: { type: Sequelize.UUID, allowNull: false },

      // Links
      patient_id: { type: Sequelize.UUID, allowNull: false },
      consultation_id: { type: Sequelize.UUID },
      registration_log_id: { type: Sequelize.UUID },
      technician_id: { type: Sequelize.UUID },
      verified_by_id: { type: Sequelize.UUID },
      billable_item_id: { type: Sequelize.UUID },
      invoice_id: { type: Sequelize.UUID },

      // 💓 Observations
      heart_rate: { type: Sequelize.INTEGER },
      pr_interval: { type: Sequelize.DECIMAL(5, 2) },
      qrs_duration: { type: Sequelize.DECIMAL(5, 2) },
      qt_interval: { type: Sequelize.DECIMAL(5, 2) },
      axis: { type: Sequelize.STRING },
      rhythm: { type: Sequelize.STRING },
      interpretation: { type: Sequelize.TEXT },
      recommendation: { type: Sequelize.TEXT },
      note: { type: Sequelize.TEXT },

      // 📅 Scan Info
      recorded_date: { type: Sequelize.DATE },
      file_path: { type: Sequelize.TEXT },
      source: { type: Sequelize.STRING },

      // 🚨 Lifecycle
      is_emergency: { type: Sequelize.BOOLEAN, defaultValue: false },
      status: {
        type: Sequelize.ENUM(...EKG_STATUS),
        allowNull: false,
        defaultValue: EKG_STATUS[0], // ✅ "pending"
      },

      // Workflow audit
      verified_at: { type: Sequelize.DATE },
      finalized_at: { type: Sequelize.DATE },
      finalized_by_id: { type: Sequelize.UUID },
      voided_at: { type: Sequelize.DATE },
      voided_by_id: { type: Sequelize.UUID },

      // 🕵🏽 Audit
      created_by_id: { type: Sequelize.UUID },
      updated_by_id: { type: Sequelize.UUID },
      deleted_by_id: { type: Sequelize.UUID },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      deleted_at: { type: Sequelize.DATE },
    });

    // 📊 Indexes
    await queryInterface.addIndex("ekg_records", ["organization_id"], { name: "idx_ekg_records_org" });
    await queryInterface.addIndex("ekg_records", ["facility_id"], { name: "idx_ekg_records_facility" });
    await queryInterface.addIndex("ekg_records", ["patient_id"], { name: "idx_ekg_records_patient" });
    await queryInterface.addIndex("ekg_records", ["consultation_id"], { name: "idx_ekg_records_consultation" });
    await queryInterface.addIndex("ekg_records", ["registration_log_id"], { name: "idx_ekg_records_registration_log" });
    await queryInterface.addIndex("ekg_records", ["recorded_date"], { name: "idx_ekg_records_recorded_date" });
    await queryInterface.addIndex("ekg_records", ["status"], { name: "idx_ekg_records_status" });
    await queryInterface.addIndex("ekg_records", ["technician_id"], { name: "idx_ekg_records_technician" });
    await queryInterface.addIndex("ekg_records", ["invoice_id"], { name: "idx_ekg_records_invoice" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ekg_records");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ekg_records_status";');
  },
};
