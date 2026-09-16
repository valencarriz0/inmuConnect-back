import { listMyPropertyViews, registerPropertyView } from "./propertyView.service.js";

export async function create(req, res) {
  await registerPropertyView(req.params.id, req.user?.id ?? null);
  res.status(204).send();
}

export async function listMine(req, res) {
  res.status(200).json(await listMyPropertyViews(req.user.id, req.query));
}
