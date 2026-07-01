module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        name: 'Alice Admin',
        email: 'alice@example.com',
        phone: '09100000001',
        department: 'Management',
        role: 'Admin',
        status: 'Active',
        chat_id: null,
        chat_key: null,
        login_id: null,
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
        chat_id: null,
        chat_key: null,
        login_id: null,
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
        chat_id: null,
        chat_key: null,
        login_id: null,
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
        chat_id: null,
        chat_key: null,
        login_id: null,
        created_at: now,
        updated_at: now,
      },
    ], {});
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', {
      email: ['alice@example.com', 'bob@example.com', 'carol@example.com', 'dave@example.com'],
    }, {});
  },
};
