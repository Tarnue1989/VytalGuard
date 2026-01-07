"use strict";

const { DataTypes } = require("sequelize");
const { LAB_REQUEST_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("lab_requests", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      // Core links
      patient_id: { type: DataTypes.UUID, allowNull: false },
      doctor_id: { type: DataTypes.UUID, allowNull: false },
      department_id: { type: DataTypes.UUID },
      registration_log_id: { type: DataTypes.UUID },
      consultation_id: { type: DataTypes.UUID },
      invoice_id: { type: DataTypes.UUID },

      // ⚡ Full datetime for request
      request_date: { type: DataTypes.DATE, allowNull: false },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...LAB_REQUEST_STATUS),
        allowNull: false,
        defaultValue: LAB_REQUEST_STATUS[0], // "draft"
      },

      notes: { type: DataTypes.TEXT },
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      billed: { type: DataTypes.BOOLEAN, defaultValue: false },

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
    await queryInterface.addIndex("lab_requests", ["organization_id"]);
    await queryInterface.addIndex("lab_requests", ["facility_id"]);
    await queryInterface.addIndex("lab_requests", ["patient_id"]);
    await queryInterface.addIndex("lab_requests", ["doctor_id"]);
    await queryInterface.addIndex("lab_requests", ["registration_log_id"]);
    await queryInterface.addIndex("lab_requests", ["consultation_id"]);
    await queryInterface.addIndex("lab_requests", ["status"]);

    // ✅ Unique per patient per datetime
    await queryInterface.addConstraint("lab_requests", {
      fields: ["patient_id", "request_date"],
      type: "unique",
      name: "unique_lab_request_per_datetime",
    });
  },

  async down(queryInterface) {
    // Drop table and ENUM
    await queryInterface.dropTable("lab_requests");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_lab_requests_status";`
    );
  },
};
