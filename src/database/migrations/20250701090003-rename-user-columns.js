module.exports = {
  up: async (queryInterface) => {
    await queryInterface.renameColumn('users', 'chatwoot_id', 'chat_id');
    await queryInterface.renameColumn('users', 'chatwoot_api_key_encrypted', 'chat_key');
    await queryInterface.renameColumn('users', 'keycloak_id', 'login_id');
  },

  down: async (queryInterface) => {
    await queryInterface.renameColumn('users', 'chat_id', 'chatwoot_id');
    await queryInterface.renameColumn('users', 'chat_key', 'chatwoot_api_key_encrypted');
    await queryInterface.renameColumn('users', 'login_id', 'keycloak_id');
  },
};
