module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("logs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.STRING(255),
        allowNull: true,
        references: { model: "users", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      role: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      action: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      targetType: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      targetId: {
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

    await queryInterface.addIndex("logs", ["userId"]);
    await queryInterface.addIndex("logs", ["action"]);
    await queryInterface.addIndex("logs", ["created_at"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("logs");
  },
};
