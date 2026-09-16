import * as service from "./favorite.service.js";

export async function list(req, res) {
  res.status(200).json({ favorites: await service.listFavorites(req.user.id) });
}

export async function add(req, res) {
  res.status(200).json({ favorite: await service.addFavorite(req.user.id, req.params.propertyId) });
}

export async function remove(req, res) {
  await service.removeFavorite(req.user.id, req.params.propertyId);
  res.status(204).send();
}
