module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');

    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      full_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      chat_admin_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      encrypted_chat_secret: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      role: {
        type: Sequelize.STRING(50),
        defaultValue: 'Agent',
      },
      password: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'Active',
      },
      department: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');

    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      department: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      role: {
        type: Sequelize.STRING(50),
        defaultValue: 'Agent',
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'Active',
      },
      chat_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      chat_key: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      login_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      password: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },
};
