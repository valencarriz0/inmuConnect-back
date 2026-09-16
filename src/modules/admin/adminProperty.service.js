import { Op } from "sequelize";
import AppError from "../../errors/AppError.js";
import { Property } from "../../models/index.js";
import { serializePublisherProperty } from "../../serializers/publisherPropertySerializer.js";
import {
  deletePublisherProperty,
  getPublisherProperty,
  getPublisherPropertyHistory,
  pausePublisherProperty,
  reactivatePublisherProperty,
  updatePublisherProperty,
} from "../properties/publisherProperty.service.js";

const attributes = [
  "id", "publisherId", "title", "description", "operationType", "propertyType", "price",
  "currency", "cityId", "street", "streetNumber", "totalArea", "rooms", "bedrooms",
  "bathrooms", "age", "propertyCondition", "acceptsPets", "garage", "expenses", "taxes",
  "commissions", "publicationStatus", "latitude", "longitude", "createdAt", "updatedAt",
];

const includes = [
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

async function publisherIdFor(id) {
  const property = await Property.findByPk(id, { attributes: ["id", "publisherId"] });
  if (!property) throw new AppError(404, "Propiedad no encontrada.");
  return property.publisherId;
}

export async function listAdminProperties(filters) {
  const where = {
    publicationStatus: filters.status === "all"
      ? { [Op.in]: ["active", "paused", "deleted"] }
      : filters.status,
  };
  if (filters.publisherId) where.publisherId = filters.publisherId;
  if (filters.q) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${filters.q}%` } },
      { description: { [Op.iLike]: `%${filters.q}%` } },
    ];
  }
  const { count, rows } = await Property.findAndCountAll({
    attributes,
    where,
    include: includes,
    distinct: true,
    order: [["createdAt", "DESC"], ["id", "ASC"]],
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  });
  const total = typeof count === "number" ? count : count.length;
  return {
    properties: rows.map((property) => ({
      ...serializePublisherProperty(property),
      publisherId: property.publisherId,
    })),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / filters.limit),
    },
  };
}

export async function getAdminProperty(id) {
  const publisherId = await publisherIdFor(id);
  return getPublisherProperty(id, publisherId);
}

export async function updateAdminProperty(id, adminId, data) {
  const publisherId = await publisherIdFor(id);
  return updatePublisherProperty(id, publisherId, data, { changedBy: adminId });
}

export async function pauseAdminProperty(id, adminId) {
  const publisherId = await publisherIdFor(id);
  return pausePublisherProperty(id, publisherId, adminId);
}

export async function reactivateAdminProperty(id, adminId) {
  const publisherId = await publisherIdFor(id);
  return reactivatePublisherProperty(id, publisherId, adminId);
}

export async function deleteAdminProperty(id, adminId) {
  const publisherId = await publisherIdFor(id);
  return deletePublisherProperty(id, publisherId, adminId);
}

export async function getAdminPropertyHistory(id) {
  const publisherId = await publisherIdFor(id);
  return getPublisherPropertyHistory(id, publisherId);
}
