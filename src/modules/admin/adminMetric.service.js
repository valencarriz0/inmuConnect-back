import { Consultation, Property, PropertyView, User } from "../../models/index.js";

export async function getAdminMetrics() {
  const [
    registeredUsers,
    publishers,
    activeProperties,
    pausedProperties,
    totalViews,
    totalConsultations,
  ] = await Promise.all([
    User.count({ where: { role: "interested", accountStatus: "active" } }),
    User.count({ where: { role: "publisher", accountStatus: "active" } }),
    Property.count({ where: { publicationStatus: "active" } }),
    Property.count({ where: { publicationStatus: "paused" } }),
    PropertyView.count(),
    Consultation.count(),
  ]);
  return {
    registeredUsers,
    publishers,
    activeProperties,
    pausedProperties,
    totalViews,
    totalConsultations,
  };
}
