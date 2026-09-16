import * as service from "./searchAlert.service.js";
export async function list(req, res) { res.status(200).json({ alerts: await service.listSearchAlerts(req.user.id) }); }
export async function create(req, res) { res.status(201).json({ alert: await service.createSearchAlert(req.user.id, req.body) }); }
export async function update(req, res) { res.status(200).json({ alert: await service.updateSearchAlert(req.params.id, req.user.id, req.body) }); }
export async function activate(req, res) { res.status(200).json({ alert: await service.setSearchAlertActive(req.params.id, req.user.id, true) }); }
export async function deactivate(req, res) { res.status(200).json({ alert: await service.setSearchAlertActive(req.params.id, req.user.id, false) }); }
