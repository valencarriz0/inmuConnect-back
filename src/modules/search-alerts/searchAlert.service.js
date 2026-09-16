import { Op } from "sequelize";
import AppError from "../../errors/AppError.js";
import { City, Notification, SearchAlert } from "../../models/index.js";
import { mailer } from "../../integrations/mail/mailer.js";

const attributes = ["id", "name", "operationType", "propertyType", "provinceId", "cityId", "currency", "minPrice", "maxPrice", "isActive", "createdAt"];
const include = [
  { association: "province", attributes: ["id", "name"], required: false },
  { association: "city", attributes: ["id", "name", "provinceId"], required: false },
];

function serialize(alert) {
  const value = typeof alert.get === "function" ? alert.get({ plain: true }) : alert;
  return { ...Object.fromEntries(attributes.map((field) => [field, value[field] ?? null])), isActive: Boolean(value.isActive), province: value.province ?? null, city: value.city ?? null };
}

async function validateLocation(data) {
  if (!data.cityId) return;
  const city = await City.findByPk(data.cityId, { attributes: ["id", "provinceId"] });
  if (!city) throw new AppError(400, "La localidad indicada no existe.");
  if (data.provinceId && city.provinceId !== data.provinceId) throw new AppError(400, "La localidad no pertenece a la provincia indicada.");
}

async function ownAlert(id, userId) {
  const alert = await SearchAlert.findOne({ where: { id, userId }, include });
  if (!alert) throw new AppError(404, "Alerta no encontrada.");
  return alert;
}

export async function listSearchAlerts(userId) {
  const alerts = await SearchAlert.findAll({ attributes, where: { userId }, include, order: [["createdAt", "DESC"]] });
  return alerts.map(serialize);
}

export async function createSearchAlert(userId, data) {
  await validateLocation(data);
  const alert = await SearchAlert.create({ ...data, userId, isActive: true });
  return serialize(await ownAlert(alert.id, userId));
}

export async function updateSearchAlert(id, userId, data) {
  const alert = await ownAlert(id, userId);
  const next = { ...alert.get({ plain: true }), ...data };
  await validateLocation(next);
  await alert.update(data, { fields: Object.keys(data) });
  return serialize(await ownAlert(id, userId));
}

export async function setSearchAlertActive(id, userId, isActive) {
  const alert = await ownAlert(id, userId);
  await alert.update({ isActive }, { fields: ["isActive"] });
  return serialize(alert);
}

export async function notifySearchAlertMatches(property, logger = console) {
  const alerts = await SearchAlert.findAll({
    where: {
      isActive: true,
      [Op.and]: [
        { [Op.or]: [{ operationType: null }, { operationType: property.operationType }] },
        { [Op.or]: [{ propertyType: null }, { propertyType: property.propertyType }] },
        { [Op.or]: [{ cityId: null }, { cityId: property.cityId }] },
        { [Op.or]: [{ provinceId: null }, { provinceId: property.city?.provinceId }] },
        { [Op.or]: [{ currency: null }, { currency: property.currency }] },
        { [Op.or]: [{ minPrice: null }, { minPrice: { [Op.lte]: property.price } }] },
        { [Op.or]: [{ maxPrice: null }, { maxPrice: { [Op.gte]: property.price } }] },
      ],
    },
    include: [{ association: "user", attributes: ["id", "email"], required: true }],
  });
  await Promise.all(alerts.map(async (alert) => {
    const notification = await Notification.findOrCreate({
      where: { searchAlertId: alert.id, propertyId: property.id, type: "new_property_match" },
      defaults: { userId: alert.userId, type: "new_property_match", title: "Nueva propiedad que coincide con tu alerta", message: property.title, searchAlertId: alert.id, propertyId: property.id },
    });
    if (!notification[1]) return;
    try {
      await mailer.sendSearchAlertEmail({ to: alert.user.email, alertName: alert.name, property });
    } catch {
      logger.error("No se pudo enviar un correo de alerta de búsqueda.");
    }
  }));
}
