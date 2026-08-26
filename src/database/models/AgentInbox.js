import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize";

const AgentInbox = sequelize.define(
  "AgentInbox",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.STRING(255), allowNull: false },
    inbox_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    tableName: "agent_inboxes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default AgentInbox;
