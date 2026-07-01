module.exports = {
  up: async (queryInterface) => {
    const perms = [
      { key: 'viewTickets', label: 'View Tickets', description: 'Can view all tickets in assigned queues', category: 'tickets' },
      { key: 'assignTickets', label: 'Assign Tickets', description: 'Can reassign tickets to other agents', category: 'tickets' },
      { key: 'editTickets', label: 'Edit Tickets', description: 'Can modify ticket properties and content', category: 'tickets' },
      { key: 'deleteTickets', label: 'Delete Tickets', description: 'Can permanently remove tickets from system', category: 'tickets' },
      { key: 'accessReports', label: 'Access Reports', description: 'Can view and export analytics dashboards', category: 'reports' },
      { key: 'accessDashboard', label: 'Dashboard Access', description: 'Can view the dashboard page', category: 'page' },
      { key: 'accessInbox', label: 'Inbox Access', description: 'Can view the inbox/conversations page', category: 'page' },
      { key: 'accessPhone', label: 'Phone Access', description: 'Can view the call logs page', category: 'page' },
      { key: 'accessTickets', label: 'Tickets Access', description: 'Can view the tickets page', category: 'page' },
      { key: 'accessSettings', label: 'Settings Access', description: 'Can view the settings page', category: 'page' },
      { key: 'accessAccessControl', label: 'Access Control', description: 'Can manage users and permissions', category: 'page' },
    ];

    for (const perm of perms) {
      await queryInterface.bulkInsert('permissions', [{
        ...perm,
        created_at: new Date(),
      }], {});
    }
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('permissions', null, {});
  },
};

