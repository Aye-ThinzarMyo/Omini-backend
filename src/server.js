import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import connectDB from './services/connectDB';


const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const startServer = () => {
  connectDB();
  server.listen(PORT, () => {
    console.log(`Omnichannel Backend running on port ${PORT}`);
  });
};

startServer();
