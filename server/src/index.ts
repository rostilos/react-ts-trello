import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { router as apiRouter } from "./routes/api";

dotenv.config();

const PORT = Number(process.env.PORT ?? 4001);
const app = express();

app.use(cors({ origin: true }));
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_req, res) => res.send("API up"));
app.use("/api", apiRouter);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
