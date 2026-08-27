import { DataTypes } from "sequelize";
import sequelize from "../config/sequelize";

const Notification = sequelize.define(
  "Notification",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.STRING(255), allowNull: false },
    type: { type: DataTypes.STRING(100), allowNull: false },
    title: { type: DataTypes.STRING(500), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: true },
    data: { type: DataTypes.JSONB, allowNull: true },
    is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: "notifications",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

export default Notification;
