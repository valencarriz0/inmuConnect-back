import * as service from "./publisherApplication.service.js";

export async function registerPublic(req, res) {
  res.status(201).json(await service.registerPublicApplication(req.body));
}

export async function create(req, res) {
  res.status(201).json({ application: await service.createApplication(req.user, req.body) });
}

export async function me(req, res) {
  res.status(200).json({ application: await service.getMyLatestApplication(req.user.id) });
}
