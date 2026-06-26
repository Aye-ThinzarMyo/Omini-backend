import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const { NODE_ENV, DATABASE_URL } = process.env;

const sequelize = new Sequelize(String(DATABASE_URL), {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  pool: {
    min: 0,
    max: 5,
  },
  logQueryParameters: NODE_ENV === 'development',
  benchmark: true,
});

export default sequelize;
