import * as service from "./location.service.js";

export async function provinces(req, res) {
  res.status(200).json(await service.listProvinces());
}

export async function cities(req, res) {
  res.status(200).json(await service.listCities(req.query.provinceId));
}

export async function search(req, res) {
  res.status(200).json(await service.searchLocations(req.query.q));
}
