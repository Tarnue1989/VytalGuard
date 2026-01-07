// 📁 migrations/0066_create-radiology_records.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { RADIOLOGY_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("radiology_records", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      consultation_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID }, // ✅ renamed
      invoice_id: { type: DataTypes.UUID },
      radiologist_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },

      // Imaging details
      study_type: { type: DataTypes.STRING, allowNull: false }, // e.g. X-ray, CT, MRI
      study_date: { type: DataTypes.DATE, allowNull: false },
      body_part: { type: DataTypes.STRING },
      modality: { type: DataTypes.STRING },
      findings: { type: DataTypes.TEXT },
      impression: { type: DataTypes.TEXT },
      file_path: { type: DataTypes.TEXT }, // PACS file or attachment

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...RADIOLOGY_STATUS),
        allowNull: false,
        defaultValue: RADIOLOGY_STATUS[0], // "pending"
      },

      verified_at: { type: DataTypes.DATE },

      // Audit
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

    // Indexes
    await queryInterface.addIndex("radiology_records", ["organization_id"]);
    await queryInterface.addIndex("radiology_records", ["facility_id"]);
    await queryInterface.addIndex("radiology_records", ["patient_id"]);
    await queryInterface.addIndex("radiology_records", ["study_date"]);
    await queryInterface.addIndex("radiology_records", ["study_type"]);
    await queryInterface.addIndex("radiology_records", ["status"]);
    await queryInterface.addIndex("radiology_records", ["radiologist_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("radiology_records");
  },
};
