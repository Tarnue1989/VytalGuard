'use strict';

module.exports = {
  async up(queryInterface) {
    // Enable required PostgreSQL extensions
    await queryInterface.sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);

    // Create enums (all wrapped in DO $$ so they don't error if they already exist)
    const sql = `
      DO $$ BEGIN
        CREATE TYPE status_active_inactive AS ENUM ('active','inactive');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_user AS ENUM ('active','inactive','locked');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_patient AS ENUM ('active','inactive','deceased');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_basic_lifecycle AS ENUM ('draft','finalized','verified','voided');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_lab_result AS ENUM ('draft','reviewed','verified');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_extended_lifecycle AS ENUM ('pending','completed','finalized','verified','voided','cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_appointment AS ENUM ('scheduled','checked_in','cancelled','completed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_lab_request AS ENUM ('pending','in_progress','completed','finalized','voided');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_triage AS ENUM ('active');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_invoice AS ENUM ('draft','issued','paid','part_paid','voided');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_payment AS ENUM ('pending','posted','voided');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_stock_request AS ENUM ('pending','approved','rejected','fulfilled','voided');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_notification AS ENUM ('unread','read');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_subscription AS ENUM ('active','trialing','past_due','canceled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE status_subscription_invoice AS ENUM ('unpaid','paid','past_due');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `;

    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    // Drop enums in reverse order (CASCADE so dependent columns are handled)
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS status_subscription_invoice CASCADE;
      DROP TYPE IF EXISTS status_subscription CASCADE;
      DROP TYPE IF EXISTS status_notification CASCADE;
      DROP TYPE IF EXISTS status_stock_request CASCADE;
      DROP TYPE IF EXISTS status_payment CASCADE;
      DROP TYPE IF EXISTS status_invoice CASCADE;
      DROP TYPE IF EXISTS status_triage CASCADE;
      DROP TYPE IF EXISTS status_lab_request CASCADE;
      DROP TYPE IF EXISTS status_appointment CASCADE;
      DROP TYPE IF EXISTS status_extended_lifecycle CASCADE;
      DROP TYPE IF EXISTS status_lab_result CASCADE;
      DROP TYPE IF EXISTS status_basic_lifecycle CASCADE;
      DROP TYPE IF EXISTS status_patient CASCADE;
      DROP TYPE IF EXISTS status_user CASCADE;
      DROP TYPE IF EXISTS status_active_inactive CASCADE;
    `);
  }
};
