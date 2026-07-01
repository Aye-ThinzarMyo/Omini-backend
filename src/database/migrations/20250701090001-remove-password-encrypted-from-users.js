module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'password_encrypted');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'password_encrypted', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};
