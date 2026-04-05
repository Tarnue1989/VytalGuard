'use strict';

const { PAYER_TYPES, CURRENCY } = require('../../constants/enums.js');

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {typeof import('sequelize')} Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('billable_item_prices', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      /* ================= TENANT ================= */
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      facility_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'facilities', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      /* ================= LINK ================= */
      billable_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'billable_items', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      /* ================= PRICING ================= */
      payer_type: {
        type: Sequelize.ENUM(...Object.values(PAYER_TYPES)),
        allowNull: false,
      },

      currency: {
        type: Sequelize.ENUM(...Object.values(CURRENCY)),
        allowNull: false,
      },

      price: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },

      /* ================= AUDIT ================= */
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      updated_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      deleted_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    /* ================= INDEXES ================= */
    await queryInterface.addIndex('billable_item_prices', ['billable_item_id']);
    await queryInterface.addIndex('billable_item_prices', ['payer_type']);
    await queryInterface.addIndex('billable_item_prices', ['currency']);
    await queryInterface.addIndex('billable_item_prices', ['organization_id']);
    await queryInterface.addIndex('billable_item_prices', ['facility_id']);

    // 🔥 UNIQUE CONSTRAINT
    await queryInterface.addConstraint('billable_item_prices', {
      fields: ['billable_item_id', 'payer_type', 'currency'],
      type: 'unique',
      name: 'uniq_billable_item_price_per_payer_currency',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('billable_item_prices');

    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_billable_item_prices_payer_type";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_billable_item_prices_currency";'
      );
    }
  },
};