"use strict";

const { DataTypes } = require("sequelize");
const { LAB_RESULT_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("lab_results", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      lab_request_id: { type: DataTypes.UUID, allowNull: false },
      lab_request_item_id: { type: DataTypes.UUID, allowNull: false }, // ✅ required now
      registration_log_id: { type: DataTypes.UUID },
      consultation_id: { type: DataTypes.UUID },
      department_id: { type: DataTypes.UUID },
      doctor_id: { type: DataTypes.UUID },
      billable_item_id: { type: DataTypes.UUID }, // optional extra charge

      // 📋 Result details
      result: { type: DataTypes.TEXT, allowNull: false },
      notes: { type: DataTypes.TEXT },
      doctor_notes: { type: DataTypes.TEXT },
      result_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_DATE"),
      },
      attachment_url: { type: DataTypes.STRING },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...LAB_RESULT_STATUS),
        allowNull: false,
        defaultValue: LAB_RESULT_STATUS[0], // "draft"
      },

      reviewed_at: { type: DataTypes.DATE },
      verified_at: { type: DataTypes.DATE },

      // Audit
      entered_by_id: { type: DataTypes.UUID },
      reviewed_by_id: { type: DataTypes.UUID },
      verified_by_id: { type: DataTypes.UUID },
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
    await queryInterface.addIndex("lab_results", ["organization_id"]);
    await queryInterface.addIndex("lab_results", ["facility_id"]);
    await queryInterface.addIndex("lab_results", ["patient_id"]);
    await queryInterface.addIndex("lab_results", ["lab_request_id"]);
    await queryInterface.addIndex("lab_results", ["registration_log_id"]);
    await queryInterface.addIndex("lab_results", ["consultation_id"]);
    await queryInterface.addIndex("lab_results", ["department_id"]);
    await queryInterface.addIndex("lab_results", ["doctor_id"]);
    await queryInterface.addIndex("lab_results", ["result_date"]);
    await queryInterface.addIndex("lab_results", ["status"]);

    // ✅ enforce one result per lab_request_item
    await queryInterface.addConstraint("lab_results", {
      fields: ["lab_request_item_id"],
      type: "unique",
      name: "unique_lab_result_per_item",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("lab_results");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_lab_results_status";`
    );
  },
};
