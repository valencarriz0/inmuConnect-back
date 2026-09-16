import { registerPropertyView } from "./propertyView.service.js";

export async function create(req, res) {
  await registerPropertyView(req.params.id);
  res.status(204).send();
}
