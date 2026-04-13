'use strict';

/**
 * @param {import('sequelize').QueryInterface} queryInterface
 * @param {typeof import('sequelize')} Sequelize
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('entity_status_history', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },

      /* ================= GENERIC ENTITY ================= */
      entity_type: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },

      entity_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      /* ================= TENANT ================= */
      organization_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'organizations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'facilities', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      /* ================= STATUS ================= */
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      previous_status: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      /* ================= ACTION ================= */
      action: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },

      /* ================= ACTOR ================= */
      changed_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },

      /* ================= OPTIONAL ================= */
      note: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      /* ================= TIME ================= */
      changed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    /* ================= INDEXES ================= */
    await queryInterface.addIndex('entity_status_history', ['entity_type']);
    await queryInterface.addIndex('entity_status_history', ['entity_id']);
    await queryInterface.addIndex('entity_status_history', ['organization_id']);
    await queryInterface.addIndex('entity_status_history', ['facility_id']);
    await queryInterface.addIndex('entity_status_history', ['changed_by_id']);
    await queryInterface.addIndex('entity_status_history', ['changed_at']);

    // 🔥 COMPOSITE INDEX (VERY IMPORTANT FOR PERFORMANCE)
    await queryInterface.addIndex('entity_status_history', [
      'entity_type',
      'entity_id',
      'changed_at',
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('entity_status_history');
  },
};