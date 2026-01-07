// 📁 backend/src/migrations/0045_create-payments.cjs
"use strict";

const { PAYMENT_METHODS, PAYMENT_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("payments", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Parent
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "invoices", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },

      // 🔗 Patient link
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },

      // 🔗 Tenant scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "organizations", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "facilities", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },

      // 💵 Payment details
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
      method: {
        type: Sequelize.ENUM(...PAYMENT_METHODS),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM(...PAYMENT_STATUS),
        allowNull: false,
        defaultValue: "pending",
      },
      transaction_ref: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      is_deposit: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true, // required only by controller logic on update
      },

      // 🔹 Audit
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
      },
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" }, // ✅ lowercase
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
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });

    // 🔹 Indexes
    await queryInterface.addIndex("payments", ["organization_id"], {
      name: "idx_payments_org_id",
    });
    await queryInterface.addIndex("payments", ["facility_id"], {
      name: "idx_payments_facility_id",
    });
    await queryInterface.addIndex("payments", ["invoice_id"], {
      name: "idx_payments_invoice_id",
    });
    await queryInterface.addIndex("payments", ["patient_id"], {
      name: "idx_payments_patient_id",
    });
    await queryInterface.addIndex("payments", ["status"], {
      name: "idx_payments_status",
    });
    await queryInterface.addIndex("payments", ["method"], {
      name: "idx_payments_method",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("payments");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_payments_method";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_payments_status";`
    );
  },
};
