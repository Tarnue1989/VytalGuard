"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("department_stocks", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: Sequelize.UUID, allowNull: false },
      facility_id: { type: Sequelize.UUID, allowNull: false },
      department_id: { type: Sequelize.UUID, allowNull: false },

      // 🔗 Master Item
      master_item_id: { type: Sequelize.UUID, allowNull: false },

      // 📦 Stock details
      batch_no: { type: Sequelize.STRING, allowNull: true },         // ✅ Added
      expiry_date: { type: Sequelize.DATEONLY, allowNull: true },    // ✅ Added
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      min_threshold: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      max_threshold: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM("active", "inactive", "archived"), // match DEPARTMENT_STOCK_STATUS
        allowNull: false,
        defaultValue: "active",
      },

      // 🔹 Audit
      created_by_id: { type: Sequelize.UUID },
      updated_by_id: { type: Sequelize.UUID },
      deleted_by_id: { type: Sequelize.UUID },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      deleted_at: { type: Sequelize.DATE },
    });

    // 📌 Indexes
    await queryInterface.addIndex("department_stocks", ["organization_id"]);
    await queryInterface.addIndex("department_stocks", ["facility_id"]);
    await queryInterface.addIndex("department_stocks", ["department_id"]);
    await queryInterface.addIndex("department_stocks", ["master_item_id"]);
    await queryInterface.addIndex("department_stocks", ["status"]);
    await queryInterface.addIndex("department_stocks", ["batch_no"]);     // ✅ Added
    await queryInterface.addIndex("department_stocks", ["expiry_date"]);  // ✅ Added

    // 📌 Unique constraint → one record per dept + item + batch
    await queryInterface.addConstraint("department_stocks", {
      fields: ["organization_id", "facility_id", "department_id", "master_item_id", "batch_no"],
      type: "unique",
      name: "unique_dept_item_batch",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("department_stocks");
  },
};
