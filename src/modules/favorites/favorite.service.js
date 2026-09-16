import { Op } from "sequelize";
import { Favorite, Property } from "../../models/index.js";
import AppError from "../../errors/AppError.js";
import { serializeInteractionProperty } from "../../serializers/interactionSerializer.js";

const publicPropertyWhere = {
  publicationStatus: "active",
  propertyType: { [Op.ne]: "land" },
};

const propertyInclude = {
  association: "property",
  attributes: ["id", "publisherId", "title", "operationType", "price", "currency"],
  where: publicPropertyWhere,
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

async function findPublicProperty(propertyId) {
  const property = await Property.findOne({
    attributes: ["id", "publisherId", "title", "operationType", "price", "currency"],
    where: { id: propertyId, ...publicPropertyWhere },
    include: propertyInclude.include,
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada.");
  return property;
}

export async function listFavorites(userId) {
  const favorites = await Favorite.findAll({
    attributes: ["id", "propertyId", "createdAt"],
    where: { userId },
    include: [propertyInclude],
    order: [["createdAt", "DESC"]],
  });
  return favorites.map((favorite) => serializeInteractionProperty(
    typeof favorite.get === "function" ? favorite.get({ plain: true }).property : favorite.property,
  ));
}

export async function addFavorite(userId, propertyId) {
  const property = await findPublicProperty(propertyId);
  if (property.publisherId === userId) {
    throw new AppError(400, "No podés guardar tu propia propiedad como favorita.");
  }
  await Favorite.findOrCreate({
    where: { userId, propertyId },
    defaults: { userId, propertyId },
  });
  return serializeInteractionProperty(property);
}

export async function removeFavorite(userId, propertyId) {
  await Favorite.destroy({ where: { userId, propertyId } });
}
