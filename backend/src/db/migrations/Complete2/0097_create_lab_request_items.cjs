// 📁 backend/src/db/migrations/0055_create_lab_request_items.cjs
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("lab_request_items", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: Sequelize.UUID, allowNull: false },
      facility_id: { type: Sequelize.UUID, allowNull: false },

      // Core references
      lab_request_id: { type: Sequelize.UUID, allowNull: false },
      lab_test_id: { type: Sequelize.UUID, allowNull: false },
      invoice_item_id: { type: Sequelize.UUID, allowNull: true },

      // Lifecycle
      status: {
        type: Sequelize.ENUM(
          "pending",
          "in_progress",
          "completed",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      notes: { type: Sequelize.TEXT },
      billed: { type: Sequelize.BOOLEAN, defaultValue: false },

      // Audit
      created_by_id: { type: Sequelize.UUID },
      updated_by_id: { type: Sequelize.UUID },
      deleted_by_id: { type: Sequelize.UUID },

      // Timestamps
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

    // 📌 Indexes
    await queryInterface.addIndex("lab_request_items", ["organization_id"]);
    await queryInterface.addIndex("lab_request_items", ["facility_id"]);
    await queryInterface.addIndex("lab_request_items", ["lab_request_id"]);
    await queryInterface.addIndex("lab_request_items", ["lab_test_id"]);
    await queryInterface.addIndex("lab_request_items", ["status"]);

    // 🔑 Unique per request + test
    await queryInterface.addConstraint("lab_request_items", {
      fields: ["lab_request_id", "lab_test_id"],
      type: "unique",
      name: "unique_lab_request_item_per_test",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("lab_request_items");
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_lab_request_items_status";`
    );
  },
};
