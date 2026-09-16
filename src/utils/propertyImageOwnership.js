import env from "../config/env.js";
import AppError from "../errors/AppError.js";

const uuidFile = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

export function isOwnedPropertyImagePath(path, publisherId) {
  if (typeof path !== "string" || path.includes("..") || path.includes("\\")) return false;
  const prefix = `properties/${publisherId}/`;
  return path.startsWith(prefix)
    && path.indexOf("/", prefix.length) === -1
    && uuidFile.test(path.slice(prefix.length));
}

export function assertOwnedPropertyImagePaths(paths, publisherId) {
  if (!Array.isArray(paths) || !paths.every((path) => isOwnedPropertyImagePath(path, publisherId))) {
    throw new AppError(400, "Uno o más paths de imagen no son válidos.");
  }
}

export function storagePathFromOwnedPublicUrl(value, publisherId) {
  if (typeof value !== "string") return null;

  let candidate;
  try {
    candidate = new URL(value);
  } catch {
    return null;
  }

  const base = new URL(env.SUPABASE_URL);
  if (candidate.origin !== base.origin || candidate.username || candidate.password
      || candidate.search || candidate.hash) return null;

  const pathname = decodePathname(candidate.pathname);
  const basePath = base.pathname.replace(/\/+$/, "");
  const publicPrefix = `${basePath}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/`;
  if (!pathname?.startsWith(publicPrefix)) return null;

  const path = pathname.slice(publicPrefix.length);
  return isOwnedPropertyImagePath(path, publisherId) ? path : null;
}

export function assertOwnedPropertyImageUrls(urls, publisherId) {
  if (!Array.isArray(urls) || !urls.every((url) => storagePathFromOwnedPublicUrl(url, publisherId))) {
    throw new AppError(400, "Las imágenes deben pertenecer al publicador autenticado.");
  }
}
