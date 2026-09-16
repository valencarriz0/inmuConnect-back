import { getPublisherMetrics } from "./publisherMetric.service.js";

export async function detail(req, res) {
  res.status(200).json(await getPublisherMetrics(req.user.id));
}
