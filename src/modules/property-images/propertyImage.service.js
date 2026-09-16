import { randomUUID } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import AppError from "../../errors/AppError.js";
import storageClient from "../../integrations/supabase/storageClient.js";
import { assertOwnedPropertyImagePaths } from "../../utils/propertyImageOwnership.js";

const maximumFileSize = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function inspectFile(file) {
  if (!Buffer.isBuffer(file?.buffer) || file.buffer.length === 0 || file.buffer.length > maximumFileSize) {
    throw new AppError(400, "Cada imagen debe pesar como máximo 5 MB.");
  }

  let detected;
  try {
    detected = await fileTypeFromBuffer(file.buffer);
  } catch {
    throw new AppError(400, "Sólo se admiten imágenes JPEG, PNG o WebP válidas.");
  }
  const extension = allowedTypes.get(detected?.mime);
  if (!extension || file.mimetype !== detected.mime) {
    throw new AppError(400, "Sólo se admiten imágenes JPEG, PNG o WebP válidas.");
  }
  return { buffer: file.buffer, contentType: detected.mime, extension };
}

export async function uploadPropertyImages(publisherId, files, {
  storage = storageClient,
  uuid = randomUUID,
} = {}) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 5) {
    throw new AppError(400, "Enviá entre 1 y 5 imágenes.");
  }

  const inspected = await Promise.all(files.map(inspectFile));
  const pending = inspected.map((file) => ({
    ...file,
    path: `properties/${publisherId}/${uuid()}.${file.extension}`,
  }));
  const uploadedPaths = [];
  const images = [];

  try {
    for (const file of pending) {
      await storage.upload(file.path, file.buffer, file.contentType);
      uploadedPaths.push(file.path);
      images.push({ url: storage.getPublicUrl(file.path), path: file.path });
    }
    return { images };
  } catch {
    if (uploadedPaths.length > 0) {
      try {
        await storage.remove(uploadedPaths);
      } catch {
        // El error original de Storage sigue siendo el resultado relevante del request.
      }
    }
    throw new AppError(503, "El almacenamiento de imágenes no está disponible en este momento.");
  }
}

export async function deleteUnusedPropertyImages(publisherId, paths, { storage = storageClient } = {}) {
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > 5) {
    throw new AppError(400, "Enviá entre 1 y 5 paths de imagen.");
  }
  assertOwnedPropertyImagePaths(paths, publisherId);
  try {
    await storage.remove(paths);
  } catch {
    throw new AppError(503, "El almacenamiento de imágenes no está disponible en este momento.");
  }
}
