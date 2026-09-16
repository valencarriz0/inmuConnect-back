import multer from "multer";
import AppError from "../../errors/AppError.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024,
  },
}).array("images", 5);

export default function receivePropertyImages(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    next(new AppError(400, "Los archivos de imagen no son válidos."));
  });
}
