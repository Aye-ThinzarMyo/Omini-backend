import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const { NODE_ENV, DATABASE_URL } = process.env;

const isLocal = NODE_ENV === 'development' || DATABASE_URL?.includes('localhost') || DATABASE_URL?.includes('127.0.0.1');

// For cloud DBs (Neon etc.): strip ?sslmode from URL and handle SSL via dialectOptions.
// For local DBs: no SSL needed at all.
const cleanUrl = isLocal
  ? String(DATABASE_URL)
  : String(DATABASE_URL).replace(/([?&])sslmode=[^&]*/i, '$1').replace(/[?&]$/, '');

const sequelize = new Sequelize(cleanUrl, {
  dialect: 'postgres',
  dialectOptions: isLocal
    ? {}
    : {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
        connectTimeout: 30,
      },
  pool: {
    min: 0,
    max: 5,
    acquire: 60000,
  },
  logQueryParameters: NODE_ENV === 'development',
  benchmark: true,
});

export default sequelize;

