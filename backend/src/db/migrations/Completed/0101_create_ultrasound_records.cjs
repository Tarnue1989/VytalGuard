// 📁 backend/src/db/migrations/0101_create_ultrasound_records.cjs
"use strict";

const { ULTRASOUND_STATUS, GENDER_TYPES } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ultrasound_records", {
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
      maternity_visit_id: { type: Sequelize.UUID },
      registration_log_id: { type: Sequelize.UUID },
      department_id: { type: Sequelize.UUID },
      billable_item_id: { type: Sequelize.UUID },
      invoice_id: { type: Sequelize.UUID }, // ✅ added for billing linkage
      technician_id: { type: Sequelize.UUID },
      verified_by_id: { type: Sequelize.UUID },

      // Scan details
      scan_type: { type: Sequelize.STRING, allowNull: false },
      scan_date: { type: Sequelize.DATE, allowNull: false },
      scan_location: { type: Sequelize.STRING },

      // Medical observations
      ultra_findings: { type: Sequelize.TEXT },
      note: { type: Sequelize.TEXT },
      number_of_fetus: { type: Sequelize.INTEGER },
      biparietal_diameter: { type: Sequelize.DECIMAL(5, 2) },
      presentation: { type: Sequelize.STRING },
      lie: { type: Sequelize.STRING },
      position: { type: Sequelize.STRING },
      amniotic_volume: { type: Sequelize.DECIMAL(5, 2) },
      fetal_heart_rate: { type: Sequelize.INTEGER },
      gender: { type: Sequelize.ENUM(...GENDER_TYPES) }, // ✅ uses enums.js

      // Obstetric specific
      ultrasound_done: { type: Sequelize.BOOLEAN, defaultValue: false },
      previous_cesarean: { type: Sequelize.BOOLEAN, defaultValue: false },
      prev_ces_date: { type: Sequelize.DATE },
      prev_ces_location: { type: Sequelize.STRING },
      cesarean_date: { type: Sequelize.DATE },
      indication: { type: Sequelize.STRING },
      next_of_kin: { type: Sequelize.STRING },

      // Lifecycle
      is_emergency: { type: Sequelize.BOOLEAN, defaultValue: false },
      status: {
        type: Sequelize.ENUM(...ULTRASOUND_STATUS), // ✅ uses enums.js
        allowNull: false,
        defaultValue: ULTRASOUND_STATUS[0], // ✅ "pending"
      },
      verified_at: { type: Sequelize.DATE },
      finalized_at: { type: Sequelize.DATE },
      finalized_by_id: { type: Sequelize.UUID },
      voided_at: { type: Sequelize.DATE },
      voided_by_id: { type: Sequelize.UUID },
      source: { type: Sequelize.STRING },
      file_path: { type: Sequelize.TEXT },

      // Audit
      created_by_id: { type: Sequelize.UUID },
      updated_by_id: { type: Sequelize.UUID },
      deleted_by_id: { type: Sequelize.UUID },

      // Timestamps
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      deleted_at: { type: Sequelize.DATE },
    });

    // Indexes
    await queryInterface.addIndex("ultrasound_records", ["organization_id"], { name: "idx_ultrasound_records_org" });
    await queryInterface.addIndex("ultrasound_records", ["facility_id"], { name: "idx_ultrasound_records_facility" });
    await queryInterface.addIndex("ultrasound_records", ["patient_id"], { name: "idx_ultrasound_records_patient" });
    await queryInterface.addIndex("ultrasound_records", ["maternity_visit_id"], { name: "idx_ultrasound_records_maternity_visit" });
    await queryInterface.addIndex("ultrasound_records", ["registration_log_id"], { name: "idx_ultrasound_records_registration_log" });
    await queryInterface.addIndex("ultrasound_records", ["invoice_id"], { name: "idx_ultrasound_records_invoice" }); // ✅ added
    await queryInterface.addIndex("ultrasound_records", ["scan_date"], { name: "idx_ultrasound_records_scan_date" });
    await queryInterface.addIndex("ultrasound_records", ["status"], { name: "idx_ultrasound_records_status" });
    await queryInterface.addIndex("ultrasound_records", ["technician_id"], { name: "idx_ultrasound_records_technician" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ultrasound_records");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ultrasound_records_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ultrasound_records_gender";');
  },
};
