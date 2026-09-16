import { QueryTypes } from "sequelize";
import sequelize from "../../config/database.js";

export async function getPublisherMetrics(publisherId) {
  const rows = await sequelize.query(`
    SELECT
      p.id AS "propertyId",
      p.title,
      p.publication_status AS "publicationStatus",
      COUNT(DISTINCT pv.id)::integer AS views,
      COUNT(DISTINCT c.id)::integer AS consultations
    FROM inmobiliaria.properties AS p
    LEFT JOIN inmobiliaria.property_views AS pv ON pv.property_id = p.id
    LEFT JOIN inmobiliaria.consultations AS c ON c.property_id = p.id
    WHERE p.publisher_id = :publisherId
      AND p.publication_status IN ('active', 'paused')
    GROUP BY p.id, p.title, p.publication_status
    ORDER BY views DESC, consultations DESC, p.title ASC
  `, {
    replacements: { publisherId },
    type: QueryTypes.SELECT,
  });

  const properties = rows.map((row) => ({
    propertyId: row.propertyId,
    title: row.title,
    publicationStatus: row.publicationStatus,
    views: Number(row.views),
    consultations: Number(row.consultations),
  }));
  return {
    summary: {
      activeProperties: properties.filter(({ publicationStatus }) => publicationStatus === "active").length,
      pausedProperties: properties.filter(({ publicationStatus }) => publicationStatus === "paused").length,
      totalViews: properties.reduce((total, property) => total + property.views, 0),
      totalConsultations: properties.reduce((total, property) => total + property.consultations, 0),
    },
    mostViewed: properties.length === 0 ? null : {
      propertyId: properties[0].propertyId,
      title: properties[0].title,
      views: properties[0].views,
    },
    properties,
  };
}
