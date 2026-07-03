module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("users", "freepbx_extension_id", {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true,
    });

    await queryInterface.addColumn("users", "encrypted_freepbx_secret", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("users", "freepbx_extension_id");
    await queryInterface.removeColumn("users", "encrypted_freepbx_secret");
  },
};
