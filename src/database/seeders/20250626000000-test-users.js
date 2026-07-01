module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    // Insert test users
    await queryInterface.bulkInsert('users', [
      {
        name: 'Alice Admin',
        email: 'alice@example.com',
        phone: '09100000001',
        department: 'Management',
        role: 'Admin',
        status: 'Active',
        chatwoot_id: null,
        chatwoot_api_key_encrypted: null,
        keycloak_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Bob Agent',
        email: 'bob@example.com',
        phone: '09100000002',
        department: 'Support',
        role: 'Agent',
        status: 'Active',
        chatwoot_id: null,
        chatwoot_api_key_encrypted: null,
        keycloak_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Carol Agent',
        email: 'carol@example.com',
        phone: '09100000003',
        department: 'Sales',
        role: 'Agent',
        status: 'Active',
        chatwoot_id: null,
        chatwoot_api_key_encrypted: null,
        keycloak_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Dave Supervisor',
        email: 'dave@example.com',
        phone: '09100000004',
        department: 'Support',
        role: 'Supervisor',
        status: 'Inactive',
        chatwoot_id: null,
        chatwoot_api_key_encrypted: null,
        keycloak_id: null,
        created_at: now,
        updated_at: now,
      },
    ], {});

    // Give all users all permissions enabled
    const permKeys = [
      'viewTickets', 'assignTickets', 'editTickets', 'deleteTickets',
      'accessReports', 'accessDashboard', 'accessInbox', 'accessPhone',
      'accessTickets', 'accessSettings', 'accessAccessControl',
    ];

    // Fetch inserted users to get their IDs
    const [users] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email IN ('alice@example.com','bob@example.com','carol@example.com','dave@example.com')`
    );

    const userPerms = [];
    for (const user of users) {
      for (const key of permKeys) {
        userPerms.push({ user_id: user.id, permission_key: key, enabled: true });
      }
    }

    if (userPerms.length > 0) {
      await queryInterface.bulkInsert('user_permissions', userPerms, {});
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', {
      email: ['alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@example.com'],
    }, {});
  },
};
