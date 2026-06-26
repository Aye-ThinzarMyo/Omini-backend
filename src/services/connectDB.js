import sequelize from '../database/config/sequelize';
import '../database/models';

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully');

    await sequelize.sync({ force: false });
    console.log('Database synchronized');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

export default connectDB;
