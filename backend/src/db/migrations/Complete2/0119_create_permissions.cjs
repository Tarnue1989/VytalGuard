"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("permissions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔑 Permission Key
      key: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true,
        comment: "Unique permission key, e.g. 'appointments:view' or 'invoices:edit'",
      },

      // 🏷️ Metadata
      name: {
        type: Sequelize.STRING(120),
        allowNull: true,
        comment: "Readable label, e.g. 'View Appointments'",
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: "Optional description of the permission purpose",
      },

      // 🧩 Grouping
      module: {
        type: Sequelize.STRING(60),
        allowNull: true,
        comment: "Logical module grouping, e.g. 'appointments', 'billing', 'users'",
      },
      category: {
        type: Sequelize.STRING(60),
        allowNull: true,
        comment: "Secondary grouping, e.g. 'Clinical', 'Finance', 'Admin'",
      },
      is_global: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: "Indicates this permission is available to all tenants",
      },

      // 🕵️ Audit fields
      created_by_id: { type: Sequelize.UUID },
      updated_by_id: { type: Sequelize.UUID },
      deleted_by_id: { type: Sequelize.UUID },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex("permissions", ["key"], { unique: true });
    await queryInterface.addIndex("permissions", ["module"]);
    await queryInterface.addIndex("permissions", ["category"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("permissions");
  },
};
