// 📁 backend/src/migrations/0049_create-billable_item_price_histories.cjs
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("billable_item_price_histories", {
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

      // 🔗 Parent Billable Item
      billable_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "billable_items", key: "id" },
        onDelete: "CASCADE",
      },

      // 💵 Pricing
      old_price: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      new_price: { type: Sequelize.DECIMAL(12, 2), allowNull: false },

      // 💱 Currency tracking
      old_currency: { type: Sequelize.STRING, allowNull: true },
      new_currency: { type: Sequelize.STRING, allowNull: true },

      // ⏱ Effective date
      effective_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      // 🔹 Audit
      created_by_id: {
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
    });

    // 🔹 Indexes
    await queryInterface.addIndex("billable_item_price_histories", ["organization_id"]);
    await queryInterface.addIndex("billable_item_price_histories", ["facility_id"]);
    await queryInterface.addIndex("billable_item_price_histories", ["billable_item_id"]);
    await queryInterface.addIndex("billable_item_price_histories", ["effective_date"]);
    await queryInterface.addIndex("billable_item_price_histories", ["billable_item_id", "effective_date"], {
      name: "idx_billable_item_latest_price",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("billable_item_price_histories");
  },
};
