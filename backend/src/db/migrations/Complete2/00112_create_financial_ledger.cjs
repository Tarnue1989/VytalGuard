'use strict';

const {
  LEDGER_TRANSACTION_TYPE,
  LEDGER_STATUS,
  PAYMENT_METHODS,
} = require('../../constants/enums.js');

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {typeof import('sequelize')} Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('financial_ledger', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },

      // 🔗 Tenant scope
      organization_id: { type: Sequelize.UUID, allowNull: false },
      facility_id: { type: Sequelize.UUID, allowNull: false },

      // 🔗 Context
      invoice_id: { type: Sequelize.UUID },
      patient_id: { type: Sequelize.UUID },

      // 🔗 Source
      payment_id: { type: Sequelize.UUID },
      refund_id: { type: Sequelize.UUID },
      deposit_id: { type: Sequelize.UUID },
      discount_waiver_id: { type: Sequelize.UUID },

      // 💵 Financial details
      transaction_type: {
        type: Sequelize.ENUM(...LEDGER_TRANSACTION_TYPE), // credit | debit
        allowNull: false,
      },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },

      method: {
        type: Sequelize.ENUM(...PAYMENT_METHODS), // cash, card, bank, etc.
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM(...LEDGER_STATUS), // pending, completed, voided, failed, reversed
        allowNull: false,
        defaultValue: LEDGER_STATUS[0], // pending
      },

      note: { type: Sequelize.TEXT },

      // 🔗 Audit
      created_by_id: { type: Sequelize.UUID },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Indexes
    await queryInterface.addIndex('financial_ledger', ['organization_id']);
    await queryInterface.addIndex('financial_ledger', ['facility_id']);
    await queryInterface.addIndex('financial_ledger', ['invoice_id']);
    await queryInterface.addIndex('financial_ledger', ['patient_id']);
    await queryInterface.addIndex('financial_ledger', ['payment_id']);
    await queryInterface.addIndex('financial_ledger', ['refund_id']);
    await queryInterface.addIndex('financial_ledger', ['deposit_id']);
    await queryInterface.addIndex('financial_ledger', ['discount_waiver_id']);
    await queryInterface.addIndex('financial_ledger', ['transaction_type']);
    await queryInterface.addIndex('financial_ledger', ['status']);
    await queryInterface.addIndex('financial_ledger', ['method']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('financial_ledger');

    // Cleanup ENUMs in Postgres
    if (queryInterface.sequelize.options.dialect === 'postgres') {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_financial_ledger_transaction_type";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_financial_ledger_method";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_financial_ledger_status";'
      );
    }
  },
};
