// 📁 backend/src/migrations/0043_create-patient_employee_links.cjs
"use strict";

const { RELATION_TYPE, LINK_STATUS } = require("../../constants/enums.js");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("patient_employee_links", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      // 🔗 Core links
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      employee_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "employees", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },

      // 📌 Relationship
      relation_type: {
        type: Sequelize.ENUM(...RELATION_TYPE),
        allowNull: false,
        defaultValue: "self",
      },

      // 📌 Status
      status: {
        type: Sequelize.ENUM(...LINK_STATUS),
        allowNull: false,
        defaultValue: "active",
      },

      // 🔹 Tenant scope
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "organizations", key: "id" }, // ✅ lowercase
        onDelete: "CASCADE",
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "facilities", key: "id" }, // ✅ lowercase
        onDelete: "SET NULL",
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
    await queryInterface.addIndex("patient_employee_links", ["patient_id"]);
    await queryInterface.addIndex("patient_employee_links", ["employee_id"]);
    await queryInterface.addIndex("patient_employee_links", ["organization_id"]);
    await queryInterface.addIndex("patient_employee_links", ["facility_id"]);
    await queryInterface.addIndex("patient_employee_links", ["relation_type"]);
    await queryInterface.addIndex("patient_employee_links", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("patient_employee_links");

    // drop enums explicitly
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_patient_employee_links_relation_type";`
    );
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_patient_employee_links_status";`
    );
  },
};
