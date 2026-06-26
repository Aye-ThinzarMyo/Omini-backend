import express from 'express';
import cors from 'cors';
import { authMiddleware } from './middleware/auth';
import usersRouter from './routes/users';
import permissionsRouter from './routes/permissions';
import accountsRouter from './routes/accounts';

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/permissions', authMiddleware, permissionsRouter);
app.use('/api/accounts', authMiddleware, accountsRouter);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
