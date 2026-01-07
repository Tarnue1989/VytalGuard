"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("role_permissions", {
      // 🆔 Primary key
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      // 🔗 Foreign Keys
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      permission_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      // 🏢 Tenant Context
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      // 🕵️ Audit Fields
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

    // ⚙️ Indexes for performance
    await queryInterface.addIndex("role_permissions", ["organization_id"]);
    await queryInterface.addIndex("role_permissions", ["facility_id"]);

    // 🔒 Unique composite constraint (prevents duplicate role-permission combos)
    await queryInterface.addConstraint("role_permissions", {
      type: "unique",
      fields: ["role_id", "permission_id", "organization_id", "facility_id"],
      name: "uniq_role_perm_org_fac",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("role_permissions");
  },
};
