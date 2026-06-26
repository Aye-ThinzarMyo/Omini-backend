import { DataTypes } from 'sequelize';
import sequelize from '../config/sequelize';

const UserPermission = sequelize.define('UserPermission', {
  user_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  permission_key: {
    type: DataTypes.STRING(100),
    primaryKey: true,
    references: {
      model: 'permissions',
      key: 'key',
    },
    onDelete: 'CASCADE',
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'user_permissions',
  timestamps: false,
});

export default UserPermission;
