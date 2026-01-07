// 📁 migrations/0059_create-lab_supplies.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { LAB_SUPPLY_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("lab_supplies", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      name: { type: DataTypes.STRING(150), allowNull: false },
      unit: { type: DataTypes.STRING },
      quantity: { type: DataTypes.INTEGER, defaultValue: 0 },
      reorder_level: { type: DataTypes.INTEGER, defaultValue: 0 },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...LAB_SUPPLY_STATUS),
        allowNull: false,
        defaultValue: LAB_SUPPLY_STATUS[0], // "active"
      },

      // Audit
      created_by_id: { type: DataTypes.UUID },
      updated_by_id: { type: DataTypes.UUID },
      deleted_by_id: { type: DataTypes.UUID },

      // Sequelize timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: queryInterface.sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deleted_at: { type: DataTypes.DATE },
    });

    // Indexes
    await queryInterface.addIndex("lab_supplies", ["organization_id"]);
    await queryInterface.addIndex("lab_supplies", ["facility_id"]);
    await queryInterface.addIndex("lab_supplies", ["name"]);
    await queryInterface.addIndex("lab_supplies", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("lab_supplies");
  },
};
