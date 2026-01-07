"use strict";

const {
  PATIENT_CHART_NOTE_TYPE,
  MEDICAL_RECORD_STATUS,
} = require("../../constants/enums");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("patient_chart_notes", {
      /* ============================================================
         🧠 Core Identifiers
      ============================================================ */
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        comment: "Primary key for chart note record",
      },

      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
        comment: "Patient associated with this chart note",
      },
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "SET NULL",
        comment: "Organization scope of this chart note",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "facilities", key: "id" },
        onDelete: "SET NULL",
        comment: "Facility scope of this chart note",
      },

      author_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who authored the note (doctor, nurse, admin, etc.)",
      },

      /* ============================================================
         🩺 Note Classification & Lifecycle
      ============================================================ */
      note_type: {
        type: Sequelize.ENUM(...PATIENT_CHART_NOTE_TYPE),
        allowNull: false,
        defaultValue: "doctor",
        comment: "Type of note (doctor, nurse, admin, system)",
      },

      status: {
        type: Sequelize.ENUM(...MEDICAL_RECORD_STATUS),
        allowNull: false,
        defaultValue: "draft",
        comment: "Current lifecycle state of this chart note",
      },

      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: "Full text content of the patient chart note",
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
        comment: "User who created this chart note",
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: "Timestamp when this record was created",
      },

      // 🟡 Updates
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who last modified this note",
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
        comment: "User who deleted or voided this note",
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when this record was soft-deleted or voided",
      },

      // 🧩 Review & Verification Audit
      reviewed_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who reviewed this chart note",
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when this chart note was reviewed",
      },
      verified_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who verified/finalized this note",
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when this note was verified/finalized",
      },
    });

    /* ============================================================
       ⚡ Indexes for Performance
    ============================================================ */
    await queryInterface.addIndex("patient_chart_notes", ["patient_id"]);
    await queryInterface.addIndex("patient_chart_notes", ["author_id"]);
    await queryInterface.addIndex("patient_chart_notes", ["status"]);
    await queryInterface.addIndex("patient_chart_notes", ["note_type"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("patient_chart_notes");

    // 🔧 ENUM cleanup
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_patient_chart_notes_note_type";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_patient_chart_notes_status";`
    );
  },
};
