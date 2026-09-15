import express from "express";
import cors from "cors";

import env from "./config/env.js";
import apiRouter from "./routes/index.js";
import notFound from "./middlewares/notFound.js";
import errorHandler from "./middlewares/errorHandler.js";
import { generalLimiter } from "./middlewares/rateLimit.js";

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use("/api", generalLimiter);
app.use(express.json());
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

export default app;
