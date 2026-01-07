// 📁 migrations/0048_create-beds.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { BED_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("beds", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      room_number: { type: DataTypes.STRING },
      bed_number: { type: DataTypes.STRING },
      department_id: { type: DataTypes.UUID },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...BED_STATUS),
        allowNull: false,
        defaultValue: BED_STATUS[0], // "available"
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
    await queryInterface.addIndex("beds", ["organization_id"]);
    await queryInterface.addIndex("beds", ["facility_id"]);
    await queryInterface.addIndex("beds", ["department_id"]);
    await queryInterface.addIndex("beds", ["room_number"]);
    await queryInterface.addIndex("beds", ["bed_number"]);
    await queryInterface.addIndex("beds", ["status"]);

    // Unique constraint: unique bed per room per facility
    await queryInterface.addConstraint("beds", {
      fields: ["organization_id", "facility_id", "room_number", "bed_number"],
      type: "unique",
      name: "unique_bed_per_room",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("beds");
  },
};
