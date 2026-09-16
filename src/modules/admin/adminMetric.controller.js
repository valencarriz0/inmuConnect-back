import { getAdminMetrics } from "./adminMetric.service.js";

export async function detail(req, res) {
  res.status(200).json(await getAdminMetrics());
}
