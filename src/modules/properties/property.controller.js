import * as service from "./property.service.js";

export async function list(req, res) {
  res.status(200).json(await service.listPublicProperties(req.query));
}

export async function detail(req, res) {
  res.status(200).json({ property: await service.getPublicProperty(req.params.id) });
}
