import * as service from "./adminUser.service.js";

export async function list(req, res) {
  res.status(200).json(await service.listAdminUsers(req.query));
}

export async function update(req, res) {
  res.status(200).json({ user: await service.updateAdminUser(req.params.id, req.body) });
}

export async function disable(req, res) {
  res.status(200).json({ user: await service.disableAdminUser(req.params.id) });
}

export async function reactivate(req, res) {
  res.status(200).json({ user: await service.reactivateAdminUser(req.params.id) });
}
