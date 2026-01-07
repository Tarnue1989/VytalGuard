"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("stock_issues", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 References
      stock_request_id: { type: Sequelize.UUID, allowNull: false },
      stock_request_item_id: { type: Sequelize.UUID, allowNull: false },
      central_stock_id: { type: Sequelize.UUID, allowNull: false },
      master_item_id: { type: Sequelize.UUID, allowNull: false },

      // 🔗 Tenant scope
      organization_id: { type: Sequelize.UUID, allowNull: false },
      facility_id: { type: Sequelize.UUID, allowNull: false },
      department_id: { type: Sequelize.UUID, allowNull: false },

      // 📦 Issued details
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      issued_by_id: { type: Sequelize.UUID },
      issued_at: { type: Sequelize.DATE },

      // 📝 Optional remarks
      remarks: { type: Sequelize.STRING(500) },

      // 🔹 Audit fields
      created_by_id: { type: Sequelize.UUID },
      updated_by_id: { type: Sequelize.UUID },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    // 🔹 Indexes
    await queryInterface.addIndex("stock_issues", ["organization_id"]);
    await queryInterface.addIndex("stock_issues", ["facility_id"]);
    await queryInterface.addIndex("stock_issues", ["department_id"]);
    await queryInterface.addIndex("stock_issues", ["stock_request_id"]);
    await queryInterface.addIndex("stock_issues", ["stock_request_item_id"]);
    await queryInterface.addIndex("stock_issues", ["central_stock_id"]);
    await queryInterface.addIndex("stock_issues", ["master_item_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("stock_issues");
  },
};
