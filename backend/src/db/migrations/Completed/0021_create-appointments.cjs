"use strict";

const { DataTypes } = require("sequelize");
const { APPOINTMENT_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("appointments", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
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

      // 🔗 Links
      patient_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      doctor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "employees", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      department_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: "departments", key: "id" },
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

      // 📑 Appointment info
      appointment_code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      date_time: { type: DataTypes.DATE, allowNull: false },
      status: {
        type: DataTypes.ENUM(...APPOINTMENT_STATUS),
        allowNull: false,
        defaultValue: APPOINTMENT_STATUS[0], // "scheduled"
      },
      notes: { type: DataTypes.TEXT },

      // Audit
      created_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      updated_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      deleted_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

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
    await queryInterface.addIndex("appointments", ["organization_id"]);
    await queryInterface.addIndex("appointments", ["facility_id"]);
    await queryInterface.addIndex("appointments", ["patient_id"]);
    await queryInterface.addIndex("appointments", ["doctor_id"]);
    await queryInterface.addIndex("appointments", ["department_id"]);
    await queryInterface.addIndex("appointments", ["invoice_id"]);
    await queryInterface.addIndex("appointments", ["date_time"]);
    await queryInterface.addIndex("appointments", ["status"]);

    // 🚫 Prevent double booking for same doctor & time
    await queryInterface.addConstraint("appointments", {
      fields: ["doctor_id", "date_time"],
      type: "unique",
      name: "uq_appointments_doctor_time",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("appointments");
  },
};
