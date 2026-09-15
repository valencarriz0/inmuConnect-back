import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import userRouter from "../modules/users/user.routes.js";
import publisherApplicationRouter from "../modules/publishers/publisherApplication.routes.js";
import publisherApplicationAdminRouter from "../modules/admin/publisherApplicationAdmin.routes.js";

const apiRouter = Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/publisher-applications", publisherApplicationRouter);
apiRouter.use("/admin/publisher-applications", publisherApplicationAdminRouter);

apiRouter.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "inmuconnect-back",
    timestamp: new Date().toISOString(),
  });
});

export default apiRouter;
