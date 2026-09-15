import * as service from "../publishers/publisherApplication.service.js";

export async function list(req, res) {
  res.status(200).json({ applications: await service.listApplications(req.query.status) });
}

export async function approve(req, res) {
  res.status(200).json({ application: await service.approveApplication(req.params.id, req.user.id) });
}

export async function reject(req, res) {
  res.status(200).json({
    application: await service.rejectApplication(req.params.id, req.user.id, req.body),
  });
}
