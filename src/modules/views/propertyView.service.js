import { Op } from "sequelize";
import AppError from "../../errors/AppError.js";
import { Property, PropertyView } from "../../models/index.js";

export async function registerPropertyView(propertyId) {
  const property = await Property.findOne({
    attributes: ["id"],
    where: { id: propertyId, publicationStatus: "active", propertyType: { [Op.ne]: "land" } },
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada.");
  await PropertyView.create({ propertyId: property.id });
}
