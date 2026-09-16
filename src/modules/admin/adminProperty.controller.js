import * as service from "./adminProperty.service.js";

export async function list(req, res) {
  res.status(200).json(await service.listAdminProperties(req.query));
}

export async function detail(req, res) {
  res.status(200).json({ property: await service.getAdminProperty(req.params.id) });
}

export async function update(req, res) {
  res.status(200).json({
    property: await service.updateAdminProperty(req.params.id, req.user.id, req.body),
  });
}

export async function pause(req, res) {
  res.status(200).json({ property: await service.pauseAdminProperty(req.params.id, req.user.id) });
}

export async function reactivate(req, res) {
  res.status(200).json({
    property: await service.reactivateAdminProperty(req.params.id, req.user.id),
  });
}

export async function remove(req, res) {
  res.status(200).json({ property: await service.deleteAdminProperty(req.params.id, req.user.id) });
}

export async function history(req, res) {
  res.status(200).json({ history: await service.getAdminPropertyHistory(req.params.id) });
}
