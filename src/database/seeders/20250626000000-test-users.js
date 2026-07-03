module.exports = {
  up: async (queryInterface) => {
    const now = new Date();

    await queryInterface.bulkInsert('users', [
      {
        id: '00000000-0000-0000-0000-000000000001',
        full_name: 'Alice Admin',
        email: 'alice@example.com',
        phone: '09100000001',
        department: 'Management',
        role: 'Admin',
        status: 'Active',
        chat_admin_user_id: null,
        encrypted_chat_secret: null,
        password: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        full_name: 'Bob Agent',
        email: 'bob@example.com',
        phone: '09100000002',
        department: 'Support',
        role: 'Agent',
        status: 'Active',
        chat_admin_user_id: null,
        encrypted_chat_secret: null,
        password: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        full_name: 'Carol Agent',
        email: 'carol@example.com',
        phone: '09100000003',
        department: 'Sales',
        role: 'Agent',
        status: 'Active',
        chat_admin_user_id: null,
        encrypted_chat_secret: null,
        password: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        full_name: 'Dave Supervisor',
        email: 'dave@example.com',
        phone: '09100000004',
        department: 'Support',
        role: 'Supervisor',
        status: 'Inactive',
        chat_admin_user_id: null,
        encrypted_chat_secret: null,
        password: null,
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
