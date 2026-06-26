import http from 'http';
import dotenv from 'dotenv';
import app from './app';
import connectDB from './services/connectDB';

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const startServer = () => {
  connectDB();
  server.listen(PORT, () => {
    console.log(`Omnichannel Backend running on port ${PORT}`);
  });
};

startServer();
