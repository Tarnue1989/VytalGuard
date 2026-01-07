// 📁 backend/src/db/migrations/0060_create-maternity_visits.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { MATERNITY_VISIT_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("maternity_visits", {
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
        references: { model: "employees", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      midwife_id: {
        type: DataTypes.UUID,
        references: { model: "employees", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      department_id: {
        type: DataTypes.UUID,
        references: { model: "departments", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      consultation_id: {
        type: DataTypes.UUID,
        references: { model: "consultations", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      registration_log_id: {
        type: DataTypes.UUID,
        references: { model: "registration_logs", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      billable_item_id: {
        type: DataTypes.UUID,
        references: { model: "billable_items", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      invoice_id: {
        type: DataTypes.UUID,
        references: { model: "invoices", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // 📅 Visit info
      visit_date: { type: DataTypes.DATEONLY, allowNull: false },
      visit_type: { type: DataTypes.STRING },

      // 🤰 Maternal observations
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

      // 🩺 Vitals
      blood_pressure: { type: DataTypes.STRING },
      weight: { type: DataTypes.DECIMAL(6,2) },
      height: { type: DataTypes.DECIMAL(5,2) },
      temperature: { type: DataTypes.DECIMAL(4,1) },
      pulse_rate: { type: DataTypes.INTEGER },

      // 🚨 Flags & Lifecycle
      is_emergency: { type: DataTypes.BOOLEAN, defaultValue: false },
      status: {
        type: DataTypes.ENUM(...MATERNITY_VISIT_STATUS),
        allowNull: false,
        defaultValue: MATERNITY_VISIT_STATUS[0], // "scheduled"
      },

      // 📌 Status workflow dates
      finalized_at: { type: DataTypes.DATE },
      finalized_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      verified_at: { type: DataTypes.DATE },
      verified_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // ❌ Cancel / Void lifecycle
      cancel_reason: { type: DataTypes.TEXT },
      cancelled_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      void_reason: { type: DataTypes.TEXT },
      voided_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // 🕵🏽 Audit trail
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
    await queryInterface.addIndex("maternity_visits", ["organization_id"], { name: "idx_maternity_visits_org" });
    await queryInterface.addIndex("maternity_visits", ["facility_id"], { name: "idx_maternity_visits_facility" });
    await queryInterface.addIndex("maternity_visits", ["patient_id"], { name: "idx_maternity_visits_patient_id" });
    await queryInterface.addIndex("maternity_visits", ["registration_log_id"], { name: "idx_maternity_visits_registration_log" });
    await queryInterface.addIndex("maternity_visits", ["visit_date"], { name: "idx_maternity_visits_visit_date" });
    await queryInterface.addIndex("maternity_visits", ["status"], { name: "idx_maternity_visits_status" });
    await queryInterface.addIndex("maternity_visits", ["midwife_id"], { name: "idx_maternity_visits_midwife_id" });
    await queryInterface.addIndex("maternity_visits", ["visit_type"], { name: "idx_maternity_visits_visit_type" });
    await queryInterface.addIndex("maternity_visits", ["invoice_id"], { name: "idx_maternity_visits_invoice_id" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("maternity_visits");
  },
};
