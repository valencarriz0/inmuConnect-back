import { Router } from "express";

const apiRouter = Router();

apiRouter.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "inmuconnect-back",
    timestamp: new Date().toISOString(),
  });
});

export default apiRouter;
