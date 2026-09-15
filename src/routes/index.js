import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import userRouter from "../modules/users/user.routes.js";

const apiRouter = Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);

apiRouter.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "inmuconnect-back",
    timestamp: new Date().toISOString(),
  });
});

export default apiRouter;
