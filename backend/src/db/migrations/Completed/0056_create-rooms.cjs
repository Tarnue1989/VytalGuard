// 📁 migrations/0069_create-rooms.cjs
"use strict";

const { DataTypes } = require("sequelize");
const { ROOM_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("rooms", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },
      ward_id: { type: DataTypes.UUID, allowNull: false },

      room_number: { type: DataTypes.STRING(50), allowNull: false },
      description: { type: DataTypes.TEXT },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...ROOM_STATUS),
        allowNull: false,
        defaultValue: ROOM_STATUS[0], // "active"
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
    await queryInterface.addIndex("rooms", ["organization_id"]);
    await queryInterface.addIndex("rooms", ["facility_id"]);
    await queryInterface.addIndex("rooms", ["ward_id"]);
    await queryInterface.addIndex("rooms", ["room_number"]);
    await queryInterface.addIndex("rooms", ["status"]);

    // Unique constraint
    await queryInterface.addConstraint("rooms", {
      fields: ["organization_id", "facility_id", "ward_id", "room_number"],
      type: "unique",
      name: "unique_room_per_ward",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("rooms");
  },
};
