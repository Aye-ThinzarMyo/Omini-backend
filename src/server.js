import dotenv from 'dotenv';
dotenv.config();

import dns from 'dns';
import net from 'net';
import http from 'http';
import app from './app';
import connectDB from './services/connectDB';
import { startNotificationMaintenance } from './services/notificationMaintenance';


// This host has no IPv6 route, but Neon (and other hosts) publish AAAA records.
// Node's Happy Eyeballs gives up with ETIMEDOUT instead of falling back to IPv4,
// so prefer A records and connect to a single address family.
dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamily(false);

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Omnichannel Backend running on port ${PORT}`);
    startNotificationMaintenance();
  });
};

startServer();
