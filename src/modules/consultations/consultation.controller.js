import * as service from "./consultation.service.js";

export async function create(req, res) {
  const consultation = await service.createConsultation(req.params.id, req.user?.id ?? null, req.body);
  res.status(201).json({ consultation });
}

export async function listMine(req, res) {
  res.status(200).json({ consultations: await service.listMyConsultations(req.user.id) });
}

export async function listReceived(req, res) {
  res.status(200).json({
    consultations: await service.listPublisherConsultations(req.user.id, req.query.propertyId),
  });
}
