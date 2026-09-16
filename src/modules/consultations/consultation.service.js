import { Op } from "sequelize";
import sequelize from "../../config/database.js";
import AppError from "../../errors/AppError.js";
import { Consultation, Notification, Property } from "../../models/index.js";
import { serializeConsultation } from "../../serializers/interactionSerializer.js";

const propertySummaryInclude = {
  association: "property",
  attributes: ["id", "title", "operationType", "price", "currency"],
  required: true,
  include: [
    {
      association: "city",
      attributes: ["id", "name", "provinceId"],
      required: true,
      include: [{ association: "province", attributes: ["id", "name"], required: true }],
    },
    { association: "images", attributes: ["url", "position"], required: false },
  ],
};

export async function createConsultation(propertyId, userId, data) {
  return sequelize.transaction(async (transaction) => {
    const property = await Property.findOne({
      attributes: ["id", "publisherId", "title"],
      where: { id: propertyId, publicationStatus: "active", propertyType: { [Op.ne]: "land" } },
      transaction,
    });
    if (!property) throw new AppError(404, "Propiedad no encontrada.");

    const consultation = await Consultation.create({
      propertyId: property.id,
      userId: userId ?? null,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      message: data.message ?? null,
    }, { transaction });

    await Notification.create({
      userId: property.publisherId,
      type: "new_consultation",
      title: "Nueva consulta recibida",
      message: `Recibiste una consulta por ${property.title}.`,
      consultationId: consultation.id,
    }, { transaction });

    return serializeConsultation(consultation);
  });
}

export async function listMyConsultations(userId) {
  const consultations = await Consultation.findAll({
    attributes: ["id", "propertyId", "firstName", "lastName", "email", "phone", "message", "createdAt"],
    where: { userId },
    include: [propertySummaryInclude],
    order: [["createdAt", "DESC"]],
  });
  return consultations.map((item) => serializeConsultation(item, { includeProperty: true }));
}

export async function listPublisherConsultations(publisherId, propertyId) {
  if (propertyId) {
    const owned = await Property.findOne({ attributes: ["id"], where: { id: propertyId, publisherId } });
    if (!owned) throw new AppError(404, "Propiedad no encontrada.");
  }
  const consultations = await Consultation.findAll({
    attributes: ["id", "propertyId", "firstName", "lastName", "email", "phone", "message", "createdAt"],
    ...(propertyId ? { where: { propertyId } } : {}),
    include: [{ ...propertySummaryInclude, where: { publisherId } }],
    order: [["createdAt", "DESC"]],
  });
  return consultations.map((item) => serializeConsultation(item, { includeProperty: true }));
}
