'use strict';

const { v4: uuidv4 } = require('uuid');
const { USER_STATUS, ROLE_TYPE, FACILITY_STATUS, ORG_STATUS } = require('../../constants/enums.js');

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // 1️⃣ Create Organization
    const orgId = uuidv4();
    await queryInterface.bulkInsert('organizations', [{
      id: orgId,
      name: 'VytalGuard Health',
      code: 'VYTG',
      status: ORG_STATUS[0], // 'active'
      created_at: now,
      updated_at: now
    }], {});

    // 2️⃣ Create Facility
    const facilityId = uuidv4();
    await queryInterface.bulkInsert('facilities', [{
      id: facilityId,
      organization_id: orgId,
      name: 'Main Hospital',
      code: 'MAIN',
      status: FACILITY_STATUS[0], // 'active'
      created_at: now,
      updated_at: now
    }], {});

    // 3️⃣ Create Roles
    const adminRoleId = uuidv4();
    const doctorRoleId = uuidv4();
    const nurseRoleId = uuidv4();

    const roles = [
      { id: adminRoleId, name: 'Admin', description: 'System Administrator', role_type: ROLE_TYPE[0] }, // 'system'
      { id: doctorRoleId, name: 'Doctor', description: 'Clinical Doctor', role_type: ROLE_TYPE[0] },
      { id: nurseRoleId, name: 'Nurse', description: 'Registered Nurse', role_type: ROLE_TYPE[0] }
    ].map(r => ({ ...r, created_at: now, updated_at: now }));

    await queryInterface.bulkInsert('roles', roles, {});

    // 4️⃣ Create Admin User (fixed hash for 'Admin@123')
    const adminUserId = uuidv4();
    await queryInterface.bulkInsert('users', [{
      id: adminUserId,
      username: 'admin',
      email: 'admin@vytalguard.com',
      password_hash: '$2b$10$/79phrh/dj8zbKyAXCsPQ.6AfQs3h7nhjiiSjHK7fHLLJC1bQ6xq2',
      first_name: 'System',
      last_name: 'Administrator',
      status: USER_STATUS[0], // 'active'
      created_at: now,
      updated_at: now
    }], {});

    // 5️⃣ Link Admin User to Facility with Admin Role
    await queryInterface.bulkInsert('user_facilities', [{
      id: uuidv4(),
      user_id: adminUserId,
      facility_id: facilityId,
      role_id: adminRoleId,
      created_at: now,
      updated_at: now
    }], {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('user_facilities', null, {});
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('roles', null, {});
    await queryInterface.bulkDelete('facilities', null, {});
    await queryInterface.bulkDelete('organizations', null, {});
  }
};
