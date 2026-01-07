"use strict";

const { PATIENT_CHART_CACHE_STATUS } = require("../../constants/enums");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("patient_chart_cache", {
      /* ============================================================
         🩺 Core References
      ============================================================ */
      patient_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
        comment: "Patient whose chart is cached",
      },
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "SET NULL",
        comment: "Organization that owns this cache entry",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "facilities", key: "id" },
        onDelete: "SET NULL",
        comment: "Facility scope for the patient chart cache",
      },

      /* ============================================================
         📦 Cache Lifecycle
      ============================================================ */
      status: {
        type: Sequelize.ENUM(...PATIENT_CHART_CACHE_STATUS),
        allowNull: false,
        defaultValue: "active",
        comment: "Cache lifecycle state (active, stale, invalid)",
      },
      chart_snapshot: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: "Serialized JSON structure of the patient chart snapshot",
      },
      generated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: "Timestamp when the cache snapshot was generated",
      },

      /* ============================================================
         🧾 Detailed Audit Trail (Enterprise Pattern)
      ============================================================ */

      // 🟢 Creation
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who created this cache record",
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
        comment: "User who last modified this cache record",
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        comment: "Timestamp when this record was last updated",
      },

      // 🔴 Deletion / Invalidation
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who deleted or invalidated this record",
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when this record was soft-deleted",
      },

      // 🧩 Optional Revalidation Lifecycle
      revalidated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        comment: "User who revalidated the cache entry after a stale state",
      },
      revalidated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Timestamp when this cache was revalidated",
      },
    });

    /* ============================================================
       ⚡ Indexes for Performance
    ============================================================ */
    await queryInterface.addIndex("patient_chart_cache", ["patient_id"]);
    await queryInterface.addIndex("patient_chart_cache", ["status"]);
    await queryInterface.addIndex("patient_chart_cache", ["facility_id"]);
    await queryInterface.addIndex("patient_chart_cache", ["organization_id"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("patient_chart_cache");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_patient_chart_cache_status";`
    );
  },
};
