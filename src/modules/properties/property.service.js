import { Op } from "sequelize";
import { Property } from "../../models/index.js";
import AppError from "../../errors/AppError.js";
import { serializePropertyDetail, serializePropertySummary } from "../../serializers/publicPropertySerializer.js";

const propertyAttributes = [
  "id", "title", "description", "operationType", "propertyType", "price", "currency",
  "cityId", "street", "streetNumber", "totalArea", "rooms", "bedrooms", "bathrooms",
  "age", "propertyCondition", "acceptsPets", "garage", "expenses", "taxes", "commissions",
  "latitude", "longitude", "createdAt",
];

const sortOrders = {
  newest: [["createdAt", "DESC"], ["id", "ASC"]],
  price_asc: [["price", "ASC"], ["id", "ASC"]],
  price_desc: [["price", "DESC"], ["id", "ASC"]],
};

function publicWhere(filters) {
  const where = {
    publicationStatus: "active",
    propertyType: { [Op.ne]: "land" },
  };
  for (const field of ["operationType", "propertyType", "currency", "cityId"]) {
    if (filters[field] !== undefined) where[field] = filters[field];
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {};
    if (filters.minPrice !== undefined) where.price[Op.gte] = filters.minPrice;
    if (filters.maxPrice !== undefined) where.price[Op.lte] = filters.maxPrice;
  }
  return where;
}

function locationInclude(provinceId) {
  return {
    association: "city",
    attributes: ["id", "name", "provinceId"],
    required: true,
    ...(provinceId ? { where: { provinceId } } : {}),
    include: [{ association: "province", attributes: ["id", "name"], required: true }],
  };
}

const imageInclude = { association: "images", attributes: ["url", "position"], required: false };

export async function listPublicProperties(filters) {
  const { page, limit, sort, provinceId } = filters;
  const { count, rows } = await Property.findAndCountAll({
    attributes: propertyAttributes,
    where: publicWhere(filters),
    include: [locationInclude(provinceId), imageInclude],
    distinct: true,
    order: sortOrders[sort],
    limit,
    offset: (page - 1) * limit,
  });
  const total = typeof count === "number" ? count : count.length;
  return {
    properties: rows.map(serializePropertySummary),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getPublicProperty(id) {
  const property = await Property.findOne({
    attributes: propertyAttributes,
    where: {
      id,
      publicationStatus: "active",
      propertyType: { [Op.ne]: "land" },
    },
    include: [
      locationInclude(),
      imageInclude,
      { association: "services", attributes: ["id", "code", "name"], through: { attributes: [] }, required: false },
      { association: "amenities", attributes: ["id", "code", "name"], through: { attributes: [] }, required: false },
    ],
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada.");
  return serializePropertyDetail(property);
}
