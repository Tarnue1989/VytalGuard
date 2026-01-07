"use strict";

const { DataTypes } = require("sequelize");
const { NEWBORN_STATUS, GENDER_TYPES } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("newborn_records", {
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
      mother_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      delivery_record_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "delivery_records", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      // 👶 Baby details
      gender: { type: DataTypes.ENUM(...GENDER_TYPES), allowNull: false },

      birth_weight: { type: DataTypes.DECIMAL(5, 2) }, // e.g., 3.45 kg
      birth_length: { type: DataTypes.DECIMAL(5, 2) }, // cm
      head_circumference: { type: DataTypes.DECIMAL(5, 2) }, // cm
      apgar_score_1min: { type: DataTypes.INTEGER }, // 0–10
      apgar_score_5min: { type: DataTypes.INTEGER }, // 0–10
      measurement_notes: { type: DataTypes.TEXT },

      complications: { type: DataTypes.TEXT },
      notes: { type: DataTypes.TEXT },

      // 🚼 Lifecycle
      status: {
        type: DataTypes.ENUM(...NEWBORN_STATUS),
        allowNull: false,
        defaultValue: "alive",
      },

      // 🚼 Lifecycle details
      death_reason: { type: DataTypes.TEXT },
      death_time: { type: DataTypes.DATE },

      transfer_reason: { type: DataTypes.TEXT },
      transfer_facility_id: {
        type: DataTypes.UUID,
        references: { model: "facilities", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      transfer_time: { type: DataTypes.DATE },

      void_reason: { type: DataTypes.TEXT },
      voided_by_id: {
        type: DataTypes.UUID,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      voided_at: { type: DataTypes.DATE },

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
    await queryInterface.addIndex("newborn_records", ["organization_id"], { name: "idx_newborn_records_org" });
    await queryInterface.addIndex("newborn_records", ["facility_id"], { name: "idx_newborn_records_facility" });
    await queryInterface.addIndex("newborn_records", ["mother_id"], { name: "idx_newborn_records_mother_id" });
    await queryInterface.addIndex("newborn_records", ["delivery_record_id"], { name: "idx_newborn_records_delivery_record_id" });
    await queryInterface.addIndex("newborn_records", ["status"], { name: "idx_newborn_records_status" });
    await queryInterface.addIndex("newborn_records", ["gender"], { name: "idx_newborn_records_gender" });

    // 🆕 Composite index for tenant dashboards
    await queryInterface.addIndex("newborn_records", ["organization_id", "facility_id", "status"], {
      name: "idx_newborn_records_tenant_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("newborn_records");

    // 🧹 Clean up enums to avoid leftover Postgres types
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_newborn_records_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_newborn_records_status";');
  },
};
