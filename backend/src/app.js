import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

export default app;
