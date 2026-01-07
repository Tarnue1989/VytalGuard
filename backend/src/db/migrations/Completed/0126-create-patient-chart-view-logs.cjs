"use strict";

const { PATIENT_CHART_VIEW_ACTION } = require("../../constants/enums");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("patient_chart_view_logs", {
      /* ============================================================
         🧠 Core Identifiers
      ============================================================ */
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        comment: "Primary key for chart view log entry",
      },

      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
        comment: "Patient whose chart was viewed/exported/printed",
      },

      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who performed the view/export/print action",
      },

      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "SET NULL",
        comment: "Organization scope of the event",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "facilities", key: "id" },
        onDelete: "SET NULL",
        comment: "Facility where the chart was accessed",
      },

      /* ============================================================
         📋 View Action Lifecycle
      ============================================================ */
      action: {
        type: Sequelize.ENUM(...PATIENT_CHART_VIEW_ACTION),
        allowNull: false,
        defaultValue: "view",
        comment: "Action performed on the patient chart (view/export/print)",
      },

      viewed_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: "Timestamp when the chart was accessed",
      },

      ip_address: {
        type: Sequelize.STRING(64),
        allowNull: true,
        comment: "IP address of the user who accessed the chart",
      },

      user_agent: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: "Browser or client information",
      },

      /* ============================================================
         🧾 Detailed Audit Trail (Enterprise Standard)
      ============================================================ */

      // 🟢 Creation
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who created this log entry",
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: "Timestamp when this record was created",
      },

      // 🟡 Last Update
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who last updated this record",
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: "Timestamp when this record was last updated",
      },

      // 🔴 Deletion / Void
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who deleted or voided this record",
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when this record was soft-deleted",
      },

      // 🧩 Review & Verification Audit (optional lifecycle)
      reviewed_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who reviewed this log (if applicable)",
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when this log was reviewed",
      },
      verified_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who verified or confirmed this log entry",
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when this log entry was verified",
      },
    });

    /* ============================================================
       ⚡ Indexes for Performance
    ============================================================ */
    await queryInterface.addIndex("patient_chart_view_logs", ["patient_id"]);
    await queryInterface.addIndex("patient_chart_view_logs", ["user_id"]);
    await queryInterface.addIndex("patient_chart_view_logs", ["action"]);
    await queryInterface.addIndex("patient_chart_view_logs", ["organization_id"]);
    await queryInterface.addIndex("patient_chart_view_logs", ["facility_id"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("patient_chart_view_logs");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_patient_chart_view_logs_action";`
    );
  },
};
