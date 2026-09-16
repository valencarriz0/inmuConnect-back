import { Op } from "sequelize";
import sequelize from "../../config/database.js";
import AppError from "../../errors/AppError.js";
import {
  Amenity,
  City,
  Property,
  PropertyAmenity,
  PropertyChangeHistory,
  PropertyImage,
  PropertyService,
  PublisherProfile,
  Service,
} from "../../models/index.js";
import {
  serializePropertyHistory,
  serializePublisherProperty,
} from "../../serializers/publisherPropertySerializer.js";
import storageClient from "../../integrations/supabase/storageClient.js";
import {
  assertOwnedPropertyImageUrls,
  storagePathFromOwnedPublicUrl,
} from "../../utils/propertyImageOwnership.js";

const propertyAttributes = [
  "id", "publisherId", "title", "description", "operationType", "propertyType", "price",
  "currency", "cityId", "street", "streetNumber", "totalArea", "rooms", "bedrooms",
  "bathrooms", "age", "propertyCondition", "acceptsPets", "garage", "expenses", "taxes",
  "commissions", "publicationStatus", "latitude", "longitude", "createdAt", "updatedAt",
];

const scalarFields = [
  "title", "description", "operationType", "propertyType", "price", "currency", "cityId",
  "street", "streetNumber", "totalArea", "rooms", "bedrooms", "bathrooms", "age",
  "propertyCondition", "acceptsPets", "garage", "expenses", "taxes", "commissions",
];

const numericFields = new Set([
  "price", "totalArea", "rooms", "bedrooms", "bathrooms", "age", "garage", "expenses",
  "taxes", "commissions", "latitude", "longitude",
]);

const detailIncludes = [
  {
    association: "city",
    attributes: ["id", "name", "provinceId"],
    required: true,
    include: [{ association: "province", attributes: ["id", "name"], required: true }],
  },
  { association: "images", attributes: ["url", "position"], required: false },
  { association: "services", attributes: ["id", "code", "name"], through: { attributes: [] }, required: false },
  { association: "amenities", attributes: ["id", "code", "name"], through: { attributes: [] }, required: false },
];

function plain(record) {
  return typeof record?.get === "function" ? record.get({ plain: true }) : record;
}

function has(object, field) {
  return Object.hasOwn(object, field);
}

function sameValue(field, left, right) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left ?? null) === (right ?? null);
  }
  return numericFields.has(field) ? Number(left) === Number(right) : left === right;
}

function sameList(left, right) {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

function historySnapshot(property) {
  return {
    id: property.id,
    title: property.title,
    description: property.description,
    operationType: property.operationType,
    propertyType: property.propertyType,
    price: property.price,
    currency: property.currency,
    cityId: property.city?.id ?? null,
    street: property.street,
    streetNumber: property.streetNumber,
    totalArea: property.totalArea,
    rooms: property.rooms,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    age: property.age,
    propertyCondition: property.propertyCondition,
    acceptsPets: property.acceptsPets,
    garage: property.garage,
    expenses: property.expenses,
    taxes: property.taxes,
    commissions: property.commissions,
    publicationStatus: property.publicationStatus,
    latitude: property.latitude,
    longitude: property.longitude,
    images: property.images,
    serviceCodes: property.services.map(({ code }) => code),
    amenityCodes: property.amenities.map(({ code }) => code),
  };
}

async function findCity(cityId, transaction) {
  const city = await City.findByPk(cityId, {
    attributes: ["id", "name", "provinceId"],
    include: [{ association: "province", attributes: ["id", "name"], required: true }],
    transaction,
  });
  if (!city) throw new AppError(400, "La localidad indicada no existe.");
  return city;
}

async function resolveCodes(Model, codes, kind, transaction) {
  if (codes.length === 0) return [];
  const values = await Model.findAll({
    attributes: ["id", "code", "name"],
    where: { code: { [Op.in]: codes } },
    transaction,
  });
  if (values.length !== codes.length) {
    const quantifier = kind === "comodidades" ? "Una o más" : "Uno o más";
    throw new AppError(400, `${quantifier} ${kind} no son válidos.`);
  }
  return values;
}

async function findOwnBase(id, publisherId, transaction) {
  const property = await Property.findOne({
    attributes: propertyAttributes,
    where: { id, publisherId },
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada.");
  return property;
}

async function loadRelations(propertyId, transaction) {
  const [images, serviceLinks, amenityLinks] = await Promise.all([
    PropertyImage.findAll({
      attributes: ["url", "position"],
      where: { propertyId },
      order: [["position", "ASC"]],
      transaction,
    }),
    PropertyService.findAll({ attributes: ["serviceId"], where: { propertyId }, transaction }),
    PropertyAmenity.findAll({ attributes: ["amenityId"], where: { propertyId }, transaction }),
  ]);
  const serviceIds = serviceLinks.map((link) => plain(link).serviceId);
  const amenityIds = amenityLinks.map((link) => plain(link).amenityId);
  const [services, amenities] = await Promise.all([
    serviceIds.length === 0 ? [] : Service.findAll({
      attributes: ["id", "code", "name"], where: { id: { [Op.in]: serviceIds } }, transaction,
    }),
    amenityIds.length === 0 ? [] : Amenity.findAll({
      attributes: ["id", "code", "name"], where: { id: { [Op.in]: amenityIds } }, transaction,
    }),
  ]);
  return { images, services, amenities };
}

function detailedProperty(property, city, relations) {
  return serializePublisherProperty({
    ...plain(property),
    city: plain(city),
    images: relations.images.map(plain),
    services: relations.services.map(plain),
    amenities: relations.amenities.map(plain),
  });
}

async function loadDetailedProperty(property, transaction) {
  const [city, relations] = await Promise.all([
    findCity(plain(property).cityId, transaction),
    loadRelations(plain(property).id, transaction),
  ]);
  return detailedProperty(property, city, relations);
}

function propertyValues(publisherId, data) {
  const values = { publisherId, publicationStatus: "active" };
  for (const field of scalarFields) {
    if (has(data, field)) values[field] = data[field];
  }
  values.latitude = has(data, "latitude") ? data.latitude : null;
  values.longitude = has(data, "longitude") ? data.longitude : null;
  return values;
}

async function createRelations(propertyId, data, services, amenities, transaction) {
  const images = data.images.map((url, position) => ({ propertyId, url, position }));
  if (images.length > 0) await PropertyImage.bulkCreate(images, { transaction });
  if (services.length > 0) {
    await PropertyService.bulkCreate(services.map((service) => ({
      propertyId,
      serviceId: plain(service).id,
    })), { transaction });
  }
  if (amenities.length > 0) {
    await PropertyAmenity.bulkCreate(amenities.map((amenity) => ({
      propertyId,
      amenityId: plain(amenity).id,
    })), { transaction });
  }
  return { images, services, amenities };
}

async function recordHistory(propertyId, changedBy, action, previousData, newData, transaction) {
  await PropertyChangeHistory.create({
    propertyId,
    changedBy,
    action,
    previousData,
    newData,
  }, { transaction });
}

export async function listPublisherProperties(publisherId, status = "all") {
  const publicationStatus = status === "all" ? { [Op.in]: ["active", "paused"] } : status;
  const properties = await Property.findAll({
    attributes: propertyAttributes,
    where: { publisherId, publicationStatus },
    include: detailIncludes,
    order: [["createdAt", "DESC"], ["id", "ASC"]],
  });
  return { properties: properties.map(serializePublisherProperty) };
}

export async function getPublisherProperty(id, publisherId) {
  const property = await Property.findOne({
    attributes: propertyAttributes,
    where: { id, publisherId },
    include: detailIncludes,
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada.");
  return serializePublisherProperty(property);
}

export async function createPublisherProperty(publisherId, data) {
  assertOwnedPropertyImageUrls(data.images, publisherId);
  return sequelize.transaction(async (transaction) => {
    const profile = await PublisherProfile.findByPk(publisherId, { transaction });
    if (!profile) throw new AppError(409, "La cuenta no tiene un perfil de publicador habilitado.");

    const city = await findCity(data.cityId, transaction);
    const services = await resolveCodes(Service, data.serviceCodes, "servicios", transaction);
    const amenities = await resolveCodes(Amenity, data.amenityCodes, "comodidades", transaction);
    const property = await Property.create(propertyValues(publisherId, data), { transaction });
    const relations = await createRelations(property.id, data, services, amenities, transaction);
    const serialized = detailedProperty(property, city, relations);
    await recordHistory(property.id, publisherId, "created", null, historySnapshot(serialized), transaction);
    return serialized;
  });
}

export async function updatePublisherProperty(id, publisherId, data, {
  storage = storageClient,
  logger = console,
  changedBy = publisherId,
} = {}) {
  if (has(data, "images")) assertOwnedPropertyImageUrls(data.images, publisherId);

  const result = await sequelize.transaction(async (transaction) => {
    const property = await findOwnBase(id, publisherId, transaction);
    if (property.publicationStatus === "deleted") {
      throw new AppError(409, "La propiedad eliminada no puede modificarse.");
    }

    const currentRelations = await loadRelations(id, transaction);
    const currentCity = await findCity(property.cityId, transaction);
    const previous = detailedProperty(property, currentCity, currentRelations);
    const nextCity = has(data, "cityId") ? await findCity(data.cityId, transaction) : currentCity;
    const nextServices = has(data, "serviceCodes")
      ? await resolveCodes(Service, data.serviceCodes, "servicios", transaction)
      : currentRelations.services;
    const nextAmenities = has(data, "amenityCodes")
      ? await resolveCodes(Amenity, data.amenityCodes, "comodidades", transaction)
      : currentRelations.amenities;

    const updates = {};
    for (const field of scalarFields) {
      if (has(data, field) && !sameValue(field, property[field], data[field])) updates[field] = data[field];
    }
    const addressChanged = ["cityId", "street", "streetNumber"]
      .some((field) => has(data, field) && !sameValue(field, property[field], data[field]));
    if (has(data, "latitude")) {
      if (!sameValue("latitude", property.latitude, data.latitude)) updates.latitude = data.latitude;
      if (!sameValue("longitude", property.longitude, data.longitude)) updates.longitude = data.longitude;
    } else if (addressChanged) {
      if (property.latitude !== null) updates.latitude = null;
      if (property.longitude !== null) updates.longitude = null;
    }

    const currentImages = currentRelations.images
      .map(plain)
      .sort((left, right) => left.position - right.position)
      .map(({ url }) => url);
    const currentServiceCodes = currentRelations.services.map((service) => plain(service).code);
    const currentAmenityCodes = currentRelations.amenities.map((amenity) => plain(amenity).code);
    const imagesChanged = has(data, "images") && data.images.join("\u0000") !== currentImages.join("\u0000");
    const servicesChanged = has(data, "serviceCodes") && !sameList(data.serviceCodes, currentServiceCodes);
    const amenitiesChanged = has(data, "amenityCodes") && !sameList(data.amenityCodes, currentAmenityCodes);
    const changed = Object.keys(updates).length > 0 || imagesChanged || servicesChanged || amenitiesChanged;
    if (!changed) return { property: previous, removedImagePaths: [] };

    if (Object.keys(updates).length > 0) {
      await property.update(updates, { transaction, fields: Object.keys(updates) });
    }
    let nextImages = currentRelations.images;
    if (imagesChanged) {
      await PropertyImage.destroy({ where: { propertyId: id }, transaction });
      const imageValues = data.images.map((url, position) => ({ propertyId: id, url, position }));
      await PropertyImage.bulkCreate(imageValues, { transaction });
      nextImages = imageValues;
    }
    if (servicesChanged) {
      await PropertyService.destroy({ where: { propertyId: id }, transaction });
      if (nextServices.length > 0) {
        await PropertyService.bulkCreate(nextServices.map((service) => ({
          propertyId: id, serviceId: plain(service).id,
        })), { transaction });
      }
    }
    if (amenitiesChanged) {
      await PropertyAmenity.destroy({ where: { propertyId: id }, transaction });
      if (nextAmenities.length > 0) {
        await PropertyAmenity.bulkCreate(nextAmenities.map((amenity) => ({
          propertyId: id, amenityId: plain(amenity).id,
        })), { transaction });
      }
    }

    const current = detailedProperty(property, nextCity, {
      images: nextImages,
      services: nextServices,
      amenities: nextAmenities,
    });
    await recordHistory(id, changedBy, "updated", historySnapshot(previous), historySnapshot(current), transaction);
    const removedImagePaths = imagesChanged
      ? currentImages
        .filter((url) => !data.images.includes(url))
        .map((url) => storagePathFromOwnedPublicUrl(url, publisherId))
        .filter(Boolean)
      : [];
    return { property: current, removedImagePaths };
  });

  if (result.removedImagePaths.length > 0) {
    try {
      await storage.remove(result.removedImagePaths);
    } catch {
      // PostgreSQL ya confirmó el reemplazo; el objeto huérfano se limpia de forma operativa.
      logger.error("No se pudieron limpiar imágenes reemplazadas de Storage.");
    }
  }
  return result.property;
}

async function changeStatus(id, publisherId, targetStatus, action, changedBy) {
  return sequelize.transaction(async (transaction) => {
    const property = await findOwnBase(id, publisherId, transaction);
    if (property.publicationStatus === "deleted") {
      throw new AppError(409, "La propiedad eliminada no puede cambiar de estado.");
    }
    const current = await loadDetailedProperty(property, transaction);
    if (property.publicationStatus === targetStatus) return current;

    const previousData = historySnapshot(current);
    await property.update({ publicationStatus: targetStatus }, {
      transaction,
      fields: ["publicationStatus"],
    });
    const changed = await loadDetailedProperty(property, transaction);
    await recordHistory(id, changedBy, action, previousData, historySnapshot(changed), transaction);
    return changed;
  });
}

export function pausePublisherProperty(id, publisherId, changedBy = publisherId) {
  return changeStatus(id, publisherId, "paused", "paused", changedBy);
}

export function reactivatePublisherProperty(id, publisherId, changedBy = publisherId) {
  return changeStatus(id, publisherId, "active", "reactivated", changedBy);
}

export async function deletePublisherProperty(id, publisherId, changedBy = publisherId) {
  return sequelize.transaction(async (transaction) => {
    const property = await findOwnBase(id, publisherId, transaction);
    const current = await loadDetailedProperty(property, transaction);
    if (property.publicationStatus === "deleted") return current;

    const previousData = historySnapshot(current);
    await property.update({ publicationStatus: "deleted" }, {
      transaction,
      fields: ["publicationStatus"],
    });
    const deleted = await loadDetailedProperty(property, transaction);
    await recordHistory(id, changedBy, "deleted", previousData, historySnapshot(deleted), transaction);
    return deleted;
  });
}

export async function getPublisherPropertyHistory(id, publisherId) {
  const property = await Property.findOne({
    attributes: ["id"],
    where: { id, publisherId },
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada.");
  const history = await PropertyChangeHistory.findAll({
    attributes: ["id", "action", "previousData", "newData", "createdAt"],
    where: { propertyId: id },
    order: [["createdAt", "DESC"]],
  });
  return history.map(serializePropertyHistory);
}
