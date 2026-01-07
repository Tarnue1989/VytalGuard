// 📁 backend/src/db/migrations/0071_create-ultrasound_records.cjs
"use strict";

const { DataTypes } = require("sequelize");
const {
  ULTRASOUND_STATUS,
  GENDER_TYPES,
} = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("ultrasound_records", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🏢 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // 🔗 Linked entities
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      maternity_visit_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },
      technician_id: { type: DataTypes.UUID },

      // 🩺 Core Scan Details
      scan_type: { type: DataTypes.STRING, allowNull: false },
      scan_date: { type: DataTypes.DATE, allowNull: false },
      scan_location: { type: DataTypes.STRING },

      // 🧠 Medical Observations
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

      // 🤰 Obstetric
      previous_cesarean: { type: DataTypes.BOOLEAN, defaultValue: false },
      prev_ces_date: { type: DataTypes.DATE },
      prev_ces_location: { type: DataTypes.STRING },
      cesarean_date: { type: DataTypes.DATE },
      indication: { type: DataTypes.STRING },
      next_of_kin: { type: DataTypes.STRING },

      // 🚨 Lifecycle
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...ULTRASOUND_STATUS),
        allowNull: false,
        defaultValue: "pending",
      },

      // 🧾 Lifecycle meta
      verified_by_id: { type: DataTypes.UUID },
      verified_at: { type: DataTypes.DATE },
      finalized_by_id: { type: DataTypes.UUID },
      finalized_at: { type: DataTypes.DATE },
      voided_by_id: { type: DataTypes.UUID },
      void_reason: { type: DataTypes.TEXT },
      voided_at: { type: DataTypes.DATE },

      // 📎 Optional file linkage
      source: { type: DataTypes.STRING },
      file_path: { type: DataTypes.TEXT },

      // 🧑‍💻 Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },

      // Sequelize timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deleted_at: { type: DataTypes.DATE },
    });

    // 🧩 Indexes
    await queryInterface.addIndex("ultrasound_records", ["organization_id"]);
    await queryInterface.addIndex("ultrasound_records", ["facility_id"]);
    await queryInterface.addIndex("ultrasound_records", ["patient_id"]);
    await queryInterface.addIndex("ultrasound_records", ["consultation_id"]);
    await queryInterface.addIndex("ultrasound_records", ["maternity_visit_id"]);
    await queryInterface.addIndex("ultrasound_records", ["registration_log_id"]);
    await queryInterface.addIndex("ultrasound_records", ["billable_item_id"]);
    await queryInterface.addIndex("ultrasound_records", ["invoice_id"]);
    await queryInterface.addIndex("ultrasound_records", ["technician_id"]);
    await queryInterface.addIndex("ultrasound_records", ["scan_date"]);
    await queryInterface.addIndex("ultrasound_records", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("ultrasound_records");
  },
};
