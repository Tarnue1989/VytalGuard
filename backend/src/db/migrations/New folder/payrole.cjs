// 📁 backend/src/db/migrations/XXXXXXXXXXXX-create-payrolls.cjs

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payrolls', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },

      /* ============================================================
         🔹 CORE
      ============================================================ */
      payroll_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },

      employee_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      period: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      basic_salary: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },

      allowances: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },

      deductions: {
        type: Sequelize.DECIMAL(15, 2),
        defaultValue: 0,
      },

      net_salary: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },

      /* ============================================================
         🔹 PAYMENT LINK
      ============================================================ */
      expense_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      /* ============================================================
         🔹 STATUS (ENUM OBJECT VALUES)
      ============================================================ */
      status: {
        type: Sequelize.ENUM('draft', 'approved', 'paid', 'voided'),
        defaultValue: 'draft',
      },

      /* ============================================================
         🔹 TENANT
      ============================================================ */
      organization_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },

      facility_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      /* ============================================================
         🔹 AUDIT
      ============================================================ */
      created_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      /* ============================================================
         🔹 TIMESTAMPS (PARANOID)
      ============================================================ */
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

    /* ============================================================
       🔹 INDEXES
    ============================================================ */
    await queryInterface.addIndex('payrolls', ['employee_id']);
    await queryInterface.addIndex('payrolls', ['organization_id']);
    await queryInterface.addIndex('payrolls', ['facility_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payrolls');

    // 🔥 clean enum (important for Postgres)
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_payrolls_status";'
    );
  },
};