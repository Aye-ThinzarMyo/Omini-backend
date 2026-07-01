import sequelize from '../database/config/sequelize';
import '../database/models';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 8000;

const connectDB = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sequelize.authenticate();
      console.log('Connection has been established successfully');

      await sequelize.sync({ force: false });
      console.log('Database synchronized');
      return;
    } catch (error) {
      const detail = error.original?.message || error.parent?.message || error.message || String(error);
      console.error(`DB connection attempt ${attempt}/${MAX_RETRIES} failed:`, detail);
      if (attempt === MAX_RETRIES) {
        console.error('Full error:', error);
        console.error('All DB connection attempts exhausted. Exiting.');
        process.exit(1);
      }
      console.log(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
};

export default connectDB;
