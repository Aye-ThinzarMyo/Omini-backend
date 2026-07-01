module.exports = {
  up: async (queryInterface) => {
    await queryInterface.dropTable('user_permissions');
    await queryInterface.dropTable('permissions');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('permissions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },
      label: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      category: {
        type: Sequelize.STRING(50),
        defaultValue: 'general',
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.createTable('user_permissions', {
      user_id: {
        type: Sequelize.INTEGER,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      permission_key: {
        type: Sequelize.STRING(100),
        references: { model: 'permissions', key: 'key' },
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    });
  },
};
