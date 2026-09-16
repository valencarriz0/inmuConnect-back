import {
  deleteUnusedPropertyImages,
  uploadPropertyImages,
} from "./propertyImage.service.js";

export async function upload(req, res) {
  const result = await uploadPropertyImages(req.user.id, req.files);
  res.status(201).json(result);
}

export async function remove(req, res) {
  await deleteUnusedPropertyImages(req.user.id, req.body.paths);
  res.status(204).send();
}
