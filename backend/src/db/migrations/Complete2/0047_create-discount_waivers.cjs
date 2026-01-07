// 📁 backend/src/migrations/0047_create-discount_waivers.cjs
"use strict";

const {
  DISCOUNT_WAIVER_STATUS,
  DISCOUNT_TYPE,
} = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("discount_waivers", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Tenant scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "facilities", key: "id" },
        onDelete: "CASCADE",
      },

      // 🔗 Links
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "invoices", key: "id" },
        onDelete: "CASCADE",
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
        onDelete: "CASCADE",
      },

      // 📌 Discount info
      type: { type: Sequelize.ENUM(...DISCOUNT_TYPE), allowNull: false }, // percentage | fixed
      reason: { type: Sequelize.TEXT, allowNull: false },
      percentage: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      applied_total: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },
      remaining_balance: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // 📌 Lifecycle
      status: {
        type: Sequelize.ENUM(...DISCOUNT_WAIVER_STATUS),
        allowNull: false,
        defaultValue: "pending",
      },

      // 🔹 Approval / Rejection
      approved_by_employee_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "employees", key: "id" },
        onDelete: "SET NULL",
      },
      approved_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      approved_at: { type: Sequelize.DATE, allowNull: true },

      rejected_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      rejected_at: { type: Sequelize.DATE, allowNull: true },

      // 🔹 Voiding
      voided_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      voided_at: { type: Sequelize.DATE, allowNull: true },
      void_reason: { type: Sequelize.STRING(255), allowNull: true },

      // 🔹 Finalization
      finalized_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      finalized_at: { type: Sequelize.DATE, allowNull: true },

      // 🔹 Audit
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },

      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // 🔹 Indexes
    await queryInterface.addIndex("discount_waivers", ["organization_id"], {
      name: "idx_discountwaivers_org_id",
    });
    await queryInterface.addIndex("discount_waivers", ["facility_id"], {
      name: "idx_discountwaivers_facility_id",
    });
    await queryInterface.addIndex("discount_waivers", ["invoice_id"], {
      name: "idx_discountwaivers_invoice_id",
    });
    await queryInterface.addIndex("discount_waivers", ["patient_id"], {
      name: "idx_discountwaivers_patient_id",
    });
    await queryInterface.addIndex("discount_waivers", ["status"], {
      name: "idx_discountwaivers_status",
    });
    await queryInterface.addIndex("discount_waivers", ["approved_by_employee_id"], {
      name: "idx_discountwaivers_approver_id",
    });
    await queryInterface.addIndex("discount_waivers", ["approved_by_id"], {
      name: "idx_discountwaivers_approved_by",
    });
    await queryInterface.addIndex("discount_waivers", ["rejected_by_id"], {
      name: "idx_discountwaivers_rejected_by",
    });
    await queryInterface.addIndex("discount_waivers", ["voided_by_id"], {
      name: "idx_discountwaivers_voided_by",
    });
    await queryInterface.addIndex("discount_waivers", ["finalized_by_id"], {
      name: "idx_discountwaivers_finalized_by",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("discount_waivers");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_discount_waivers_type";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_discount_waivers_status";`
    );
  },
};
