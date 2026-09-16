import { Op, QueryTypes } from "sequelize";
import AppError from "../../errors/AppError.js";
import { Property, PropertyView } from "../../models/index.js";
import sequelize from "../../config/database.js";
import { getPublicProperty } from "../properties/property.service.js";

export async function registerPropertyView(propertyId, userId = null) {
  const property = await Property.findOne({
    attributes: ["id"],
    where: { id: propertyId, publicationStatus: "active", propertyType: { [Op.ne]: "land" } },
  });
  if (!property) throw new AppError(404, "Propiedad no encontrada.");
  await PropertyView.create({ propertyId: property.id, userId });
}

export async function listMyPropertyViews(userId, { page, limit }) {
  const replacements = { userId, limit, offset: (page - 1) * limit };
  const [rows, total] = await Promise.all([
    sequelize.query(`
      SELECT pv.property_id AS "propertyId", MAX(pv.created_at) AS "lastViewedAt"
      FROM inmobiliaria.property_views AS pv
      INNER JOIN inmobiliaria.properties AS p ON p.id = pv.property_id
      WHERE pv.user_id = :userId
        AND p.publication_status = 'active'
        AND p.property_type <> 'land'
      GROUP BY pv.property_id
      ORDER BY MAX(pv.created_at) DESC, pv.property_id ASC
      LIMIT :limit OFFSET :offset
    `, { replacements, type: QueryTypes.SELECT }),
    sequelize.query(`
      SELECT COUNT(DISTINCT pv.property_id)::integer AS total
      FROM inmobiliaria.property_views AS pv
      INNER JOIN inmobiliaria.properties AS p ON p.id = pv.property_id
      WHERE pv.user_id = :userId
        AND p.publication_status = 'active'
        AND p.property_type <> 'land'
    `, { replacements: { userId }, type: QueryTypes.SELECT }),
  ]);
  const count = Number(total[0]?.total ?? 0);
  const properties = await Promise.all(rows.map(async ({ propertyId, lastViewedAt }) => ({
    property: await getPublicProperty(propertyId),
    lastViewedAt: new Date(lastViewedAt).toISOString(),
  })));
  return {
    history: properties,
    pagination: { page, limit, total: count, totalPages: count === 0 ? 0 : Math.ceil(count / limit) },
  };
}
