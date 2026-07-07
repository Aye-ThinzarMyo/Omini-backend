import express from "express";
import cors from "cors";
import { authMiddleware } from "./middleware/auth";
import usersRouter from "./routes/users";
import chatwootRouter from "./routes/chatwoot";

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

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
