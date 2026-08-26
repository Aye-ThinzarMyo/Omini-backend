import { DataTypes, QueryInterface } from "sequelize";

export default {
  async up(queryInterface) {
    await queryInterface.createTable("agent_inboxes", {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: DataTypes.STRING(255), allowNull: false },
      inbox_id: { type: DataTypes.INTEGER, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex("agent_inboxes", ["user_id", "inbox_id"], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable("agent_inboxes");
  },
};
