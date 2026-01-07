"use strict";

const { DataTypes } = require("sequelize");
const { INSURANCE_PROVIDER_STATUS } = require("../../constants/enums.js");

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable("insurance_providers", {
      id: {
        type: DataTypes.UUID,
        defaultValue: queryInterface.sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // Tenant scope
      organization_id: { type: DataTypes.UUID, allowNull: false },
      facility_id: { type: DataTypes.UUID, allowNull: false },

      name: { type: DataTypes.STRING(150), allowNull: false },
      contact_info: { type: DataTypes.STRING },

      // Lifecycle
      status: {
        type: DataTypes.ENUM(...INSURANCE_PROVIDER_STATUS),
        allowNull: false,
        defaultValue: INSURANCE_PROVIDER_STATUS[0], // "active"
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
    await queryInterface.addIndex("insurance_providers", ["organization_id"]);
    await queryInterface.addIndex("insurance_providers", ["facility_id"]);
    await queryInterface.addIndex("insurance_providers", ["name"]);
    await queryInterface.addIndex("insurance_providers", ["status"]);

    // Unique constraint: one provider name per org/facility
    await queryInterface.addConstraint("insurance_providers", {
      fields: ["organization_id", "facility_id", "name"],
      type: "unique",
      name: "unique_provider_per_org",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("insurance_providers");
  },
};
