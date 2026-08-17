import express from "express";
import cors from "cors";
import { authMiddleware } from "./middleware/auth";
import usersRouter from "./routes/users";
import chatwootRouter from "./routes/chatwoot";
import freepbxRouter from "./routes/freepbx";
import presenceRouter from "./routes/presence";

import logsRouter from "./routes/logs";
import notificationsRouter from "./routes/notifications";
import webhookRouter from "./routes/webhook";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/users", authMiddleware, usersRouter);
app.use("/api/chat", authMiddleware, chatwootRouter);
app.use("/api/call", authMiddleware, freepbxRouter);
app.use("/api/agents", authMiddleware, presenceRouter);
app.use("/api/logs", authMiddleware, logsRouter);
app.use("/api/notifications", authMiddleware, notificationsRouter);
app.use("/api/webhooks", webhookRouter);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
