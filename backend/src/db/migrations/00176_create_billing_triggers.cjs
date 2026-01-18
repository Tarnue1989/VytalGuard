"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("billing_triggers", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
        allowNull: false,
      },

      /* ============================================================
         🔑 Trigger Identity
      ============================================================ */
      module_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: "kebab-case module key (e.g. consultation, lab-request)",
      },

      trigger_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: "status that allows billing (e.g. completed, dispensed)",
      },

      /* ============================================================
         🏢 Tenant Scope
      ============================================================ */
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true, // NULL = system default
        references: {
          model: "organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      facility_id: {
        type: Sequelize.UUID,
        allowNull: true, // NULL = org-level
        references: {
          model: "facilities",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      /* ============================================================
         ⚙️ Control
      ============================================================ */
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      /* ============================================================
         🧾 Audit
      ============================================================ */
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "SET NULL",
        onDelete: "SET NULL",
      },

      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "SET NULL",
        onDelete: "SET NULL",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    /* ============================================================
       📌 Indexes (performance + precedence resolution)
    ============================================================ */
    await queryInterface.addIndex("billing_triggers", [
      "module_key",
      "trigger_status",
    ]);

    await queryInterface.addIndex("billing_triggers", [
      "organization_id",
      "facility_id",
    ]);

    await queryInterface.addIndex("billing_triggers", ["is_active"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("billing_triggers");
  },
};
