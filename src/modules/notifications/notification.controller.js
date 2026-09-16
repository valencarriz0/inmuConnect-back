import * as service from "./notification.service.js";

export async function list(req, res) {
  res.status(200).json(await service.listNotifications(req.user.id));
}

export async function markRead(req, res) {
  res.status(200).json({
    notification: await service.markNotificationRead(req.params.id, req.user.id),
  });
}

export async function markAllRead(req, res) {
  res.status(200).json({ updated: await service.markAllNotificationsRead(req.user.id) });
}
