// 📁 backend/src/migrations/0041_create-insurance_providers.cjs
"use strict";

const { INSURANCE_PROVIDER_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("insurance_providers", {
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

      // 📌 Provider details
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      contact_info: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // 📌 Lifecycle
      status: {
        type: Sequelize.ENUM(...INSURANCE_PROVIDER_STATUS),
        allowNull: false,
        defaultValue: "active",
      },

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

    // 🔹 Indexes
    await queryInterface.addIndex("insurance_providers", ["organization_id"]);
    await queryInterface.addIndex("insurance_providers", ["facility_id"]);
    await queryInterface.addIndex("insurance_providers", ["name"]);
    await queryInterface.addIndex("insurance_providers", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("insurance_providers");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_insurance_providers_status";`
    );
  },
};
