import { DataTypes } from 'sequelize';
import sequelize from '../config/sequelize';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING(255),
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  full_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  chat_admin_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  encrypted_chat_secret: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'Agent',
  },
  password: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'Active',
  },
  department: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  freepbx_extension_id: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  encrypted_freepbx_secret: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default User;
