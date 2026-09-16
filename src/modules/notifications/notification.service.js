import { Op } from "sequelize";
import AppError from "../../errors/AppError.js";
import { Notification } from "../../models/index.js";
import { serializeNotification } from "../../serializers/interactionSerializer.js";

const attributes = [
  "id", "type", "title", "message", "consultationId", "publisherApplicationId",
  "searchAlertId", "propertyId", "readAt", "createdAt",
];

export async function listNotifications(userId) {
  const [notifications, unreadCount] = await Promise.all([
    Notification.findAll({
      attributes,
      where: { userId },
      include: [{ association: "consultation", attributes: ["propertyId"], required: false }],
      order: [["createdAt", "DESC"]],
    }),
    Notification.count({ where: { userId, readAt: { [Op.is]: null } } }),
  ]);
  return { notifications: notifications.map(serializeNotification), unreadCount };
}

export async function markNotificationRead(id, userId) {
  const notification = await Notification.findOne({
    attributes,
    where: { id, userId },
    include: [{ association: "consultation", attributes: ["propertyId"], required: false }],
  });
  if (!notification) throw new AppError(404, "Notificación no encontrada.");
  if (!notification.readAt) {
    await notification.update({ readAt: new Date() }, { fields: ["readAt"] });
  }
  return serializeNotification(notification);
}

export async function markAllNotificationsRead(userId) {
  const [updated] = await Notification.update({ readAt: new Date() }, {
    where: { userId, readAt: { [Op.is]: null } },
    fields: ["readAt"],
  });
  return updated;
}
