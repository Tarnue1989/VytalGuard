/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {

    // ENUM type for refund deposit transaction status
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'refund_deposit_transaction_status'
        ) THEN
          CREATE TYPE refund_deposit_transaction_status AS ENUM (
            'created',
            'processed',
            'reversed'
          );
        END IF;
      END$$;
    `);

    await queryInterface.createTable("refund_deposit_transactions", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
        primaryKey: true,
      },

      refund_deposit_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "refund_deposits",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      deposit_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "deposits",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "organizations", key: "id" },
      },

      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "facilities", key: "id" },
      },

      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "patients", key: "id" },
      },

      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      method: {
        type: Sequelize.STRING,
      },

      note: {
        type: Sequelize.TEXT,
      },

      status: {
        type: "refund_deposit_transaction_status",
        allowNull: false,
        defaultValue: "created",
      },

      created_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
      },

      reversed_by_id: {
        type: Sequelize.UUID,
        references: { model: "users", key: "id" },
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },

      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("NOW()"),
      },

      reversed_at: {
        type: Sequelize.DATE,
      },

      deleted_at: {
        type: Sequelize.DATE,
      },

      deleted_by_id: {
        type: Sequelize.UUID,
      },
    });

    // indexes (same style as your example file)
    await queryInterface.addIndex("refund_deposit_transactions", ["refund_deposit_id"]);
    await queryInterface.addIndex("refund_deposit_transactions", ["deposit_id"]);
    await queryInterface.addIndex("refund_deposit_transactions", ["organization_id"]);
    await queryInterface.addIndex("refund_deposit_transactions", ["facility_id"]);
    await queryInterface.addIndex("refund_deposit_transactions", ["patient_id"]);
    await queryInterface.addIndex("refund_deposit_transactions", ["status"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("refund_deposit_transactions");

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'refund_deposit_transaction_status'
        ) THEN
          DROP TYPE refund_deposit_transaction_status;
        END IF;
      END$$;
    `);
  },
};
