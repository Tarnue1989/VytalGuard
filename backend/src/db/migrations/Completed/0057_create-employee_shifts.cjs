// 📁 migrations/0053_create-employee_shifts.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { EMPLOYEE_SHIFT_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("employee_shifts", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      employee_id: { type: DataTypes.UUID, allowNull: false },
      day_of_week: { type: DataTypes.STRING, allowNull: false },
      shift_start_time: { type: DataTypes.TIME, allowNull: false },
      shift_end_time: { type: DataTypes.TIME, allowNull: false },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...EMPLOYEE_SHIFT_STATUS),
        allowNull: false,
        defaultValue: EMPLOYEE_SHIFT_STATUS[0], // "active"
      },

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
    await queryInterface.addIndex("employee_shifts", ["organization_id"]);
    await queryInterface.addIndex("employee_shifts", ["facility_id"]);
    await queryInterface.addIndex("employee_shifts", ["employee_id"]);
    await queryInterface.addIndex("employee_shifts", ["day_of_week"]);
    await queryInterface.addIndex("employee_shifts", ["status"]);

    // Unique constraint: one employee shift definition per time slot
    await queryInterface.addConstraint("employee_shifts", {
      fields: ["employee_id", "day_of_week", "shift_start_time", "shift_end_time"],
      type: "unique",
      name: "unique_employee_shift",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employee_shifts");
  },
};
