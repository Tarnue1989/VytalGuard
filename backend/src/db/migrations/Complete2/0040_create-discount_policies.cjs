// 📁 backend/src/migrations/0040_create-discount_policies.cjs
"use strict";

const {
  DISCOUNT_TYPE,
  POLICY_APPLIES_TO,
  POLICY_STATUS,
} = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("discount_policies", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 📌 Identification
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 📌 Discount definition
      discount_type: {
        type: Sequelize.ENUM(...DISCOUNT_TYPE), // percentage, fixed, waiver
        allowNull: false,
      },
      discount_value: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      // 📌 Applicability
      applies_to: {
        type: Sequelize.ENUM(...POLICY_APPLIES_TO), // all, billable_item, category, department, patient_class
        defaultValue: "all",
      },
      condition_json: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: "Custom conditions (e.g. { patientType: 'staff', ward: 'maternity' })",
      },

      // 📌 Validity
      effective_from: { type: Sequelize.DATE },
      effective_to: { type: Sequelize.DATE },

      // 📌 Status
      status: {
        type: Sequelize.ENUM(...POLICY_STATUS), // active, inactive, expired
        allowNull: false,
        defaultValue: "active",
      },

      // 🔹 Tenant Scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "organizations", key: "id" },
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "facilities", key: "id" },
        onDelete: "SET NULL",
      },
      // 🔹 Lifecycle audit
      activated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      activated_at: { type: Sequelize.DATE, allowNull: true },

      deactivated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      deactivated_at: { type: Sequelize.DATE, allowNull: true },

      expired_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
      },
      expired_at: { type: Sequelize.DATE, allowNull: true },

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
      deleted_at: {
        allowNull: true,
        type: Sequelize.DATE,
      },
    });

    // 🔹 Constraints & Indexes
    await queryInterface.addConstraint("discount_policies", {
      fields: ["code"],
      type: "unique",
      name: "uq_discount_policy_code",
    });

    await queryInterface.addIndex("discount_policies", ["organization_id"], {
      name: "idx_discountpolicies_org_id",
    });
    await queryInterface.addIndex("discount_policies", ["facility_id"], {
      name: "idx_discountpolicies_facility_id",
    });
    await queryInterface.addIndex("discount_policies", ["status"], {
      name: "idx_discountpolicies_status",
    });
    await queryInterface.addIndex("discount_policies", ["discount_type"], {
      name: "idx_discountpolicies_type",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("discount_policies");

    // Drop enums explicitly
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_discount_policies_discount_type";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_discount_policies_applies_to";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_discount_policies_status";`
    );
  },
};
