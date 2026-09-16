import * as service from "./publisherProperty.service.js";

export async function list(req, res) {
  res.status(200).json(await service.listPublisherProperties(req.user.id, req.query.status));
}

export async function detail(req, res) {
  res.status(200).json({ property: await service.getPublisherProperty(req.params.id, req.user.id) });
}

export async function create(req, res) {
  res.status(201).json({ property: await service.createPublisherProperty(req.user.id, req.body) });
}

export async function update(req, res) {
  res.status(200).json({ property: await service.updatePublisherProperty(req.params.id, req.user.id, req.body) });
}

export async function pause(req, res) {
  res.status(200).json({ property: await service.pausePublisherProperty(req.params.id, req.user.id) });
}

export async function reactivate(req, res) {
  res.status(200).json({ property: await service.reactivatePublisherProperty(req.params.id, req.user.id) });
}

export async function remove(req, res) {
  res.status(200).json({ property: await service.deletePublisherProperty(req.params.id, req.user.id) });
}

export async function history(req, res) {
  res.status(200).json({ history: await service.getPublisherPropertyHistory(req.params.id, req.user.id) });
}
