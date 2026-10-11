import { QueryTypes } from "sequelize";
import sequelize from "../../config/database.js";

const reportingTimeZone = "America/Argentina/Buenos_Aires";

function dateParts(date, timeZone, hourCycle) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(hourCycle ? { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle } : {}),
  }).formatToParts(date).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
}

function shiftDate(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function localMidnight(date) {
  const [year, month, day] = date.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  let instant = targetUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = dateParts(new Date(instant), reportingTimeZone, "h23");
    const localAsUtc = Date.UTC(
      Number(local.year), Number(local.month) - 1, Number(local.day),
      Number(local.hour), Number(local.minute), Number(local.second),
    );
    instant = targetUtc - (localAsUtc - instant);
  }
  return new Date(instant).toISOString();
}

function getPeriodWindow(periodDays, now) {
  const { year, month, day } = dateParts(now, reportingTimeZone);
  const localToday = `${year}-${month}-${day}`;
  const currentStartDate = shiftDate(localToday, 1 - periodDays);
  const currentEndDate = shiftDate(localToday, 1);
  const previousStartDate = shiftDate(currentStartDate, -periodDays);
  return {
    currentStart: localMidnight(currentStartDate),
    currentEnd: localMidnight(currentEndDate),
    previousStart: localMidnight(previousStartDate),
    previousEnd: localMidnight(currentStartDate),
    currentStartDate,
    currentEndDate,
  };
}

function asNumber(value) {
  return Number(value ?? 0);
}

async function getActivity(publisherId, { currentStart, currentEnd, currentStartDate, currentEndDate }) {
  return sequelize.query(`
    WITH owned_properties AS (
      SELECT id
      FROM inmobiliaria.properties
      WHERE publisher_id = :publisherId
        AND publication_status IN ('active', 'paused')
    ),
    days AS (
      SELECT generate_series(
        CAST(:currentStartDate AS date),
        CAST(:currentEndDate AS date) - 1,
        interval '1 day'
      )::date AS day
    ),
    daily_views AS (
      SELECT (pv.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS day, COUNT(*)::integer AS views
      FROM inmobiliaria.property_views AS pv
      INNER JOIN owned_properties AS p ON p.id = pv.property_id
      WHERE pv.created_at >= :currentStart AND pv.created_at < :currentEnd
      GROUP BY 1
    ),
    daily_consultations AS (
      SELECT (c.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS day, COUNT(*)::integer AS consultations
      FROM inmobiliaria.consultations AS c
      INNER JOIN owned_properties AS p ON p.id = c.property_id
      WHERE c.created_at >= :currentStart AND c.created_at < :currentEnd
      GROUP BY 1
    )
    SELECT
      to_char(days.day, 'YYYY-MM-DD') AS date,
      COALESCE(daily_views.views, 0)::integer AS views,
      COALESCE(daily_consultations.consultations, 0)::integer AS consultations
    FROM days
    LEFT JOIN daily_views USING (day)
    LEFT JOIN daily_consultations USING (day)
    ORDER BY days.day ASC
  `, {
    replacements: {
      publisherId,
      currentStart,
      currentEnd,
      currentStartDate,
      currentEndDate,
    },
    type: QueryTypes.SELECT,
  });
}

export async function getPublisherMetrics(publisherId, periodDays, now = new Date()) {
  const window = periodDays
    ? getPeriodWindow(periodDays, now)
    : {
      currentStart: "0001-01-01T00:00:00.000Z",
      currentEnd: now.toISOString(),
      previousStart: "0001-01-01T00:00:00.000Z",
      previousEnd: "0001-01-01T00:00:00.000Z",
    };

  const { currentStartDate, currentEndDate, ...timeBounds } = window;
  const rows = await sequelize.query(`
    WITH owned_properties AS (
      SELECT p.id, p.title, p.publication_status, p.city_id
      FROM inmobiliaria.properties AS p
      WHERE p.publisher_id = :publisherId
        AND p.publication_status IN ('active', 'paused')
    ),
    view_metrics AS (
      SELECT
        pv.property_id,
        COUNT(*) FILTER (WHERE pv.created_at >= :currentStart AND pv.created_at < :currentEnd)::integer AS views,
        COUNT(*) FILTER (WHERE pv.created_at >= :previousStart AND pv.created_at < :previousEnd)::integer AS "previousViews"
      FROM inmobiliaria.property_views AS pv
      INNER JOIN owned_properties AS p ON p.id = pv.property_id
      WHERE pv.created_at >= :previousStart AND pv.created_at < :currentEnd
      GROUP BY pv.property_id
    ),
    consultation_metrics AS (
      SELECT
        c.property_id,
        COUNT(*) FILTER (WHERE c.created_at >= :currentStart AND c.created_at < :currentEnd)::integer AS consultations,
        COUNT(*) FILTER (WHERE c.created_at >= :previousStart AND c.created_at < :previousEnd)::integer AS "previousConsultations"
      FROM inmobiliaria.consultations AS c
      INNER JOIN owned_properties AS p ON p.id = c.property_id
      WHERE c.created_at >= :previousStart AND c.created_at < :currentEnd
      GROUP BY c.property_id
    ),
    favorite_metrics AS (
      SELECT
        f.property_id,
        COUNT(*) FILTER (WHERE f.created_at >= :currentStart AND f.created_at < :currentEnd)::integer AS favorites,
        COUNT(*) FILTER (WHERE f.created_at >= :previousStart AND f.created_at < :previousEnd)::integer AS "previousFavorites"
      FROM inmobiliaria.favorites AS f
      INNER JOIN owned_properties AS p ON p.id = f.property_id
      WHERE f.created_at >= :previousStart AND f.created_at < :currentEnd
      GROUP BY f.property_id
    ),
    property_covers AS (
      SELECT DISTINCT ON (image.property_id) image.property_id, image.url
      FROM inmobiliaria.property_images AS image
      INNER JOIN owned_properties AS p ON p.id = image.property_id
      ORDER BY image.property_id, image.position ASC
    )
    SELECT
      p.id AS "propertyId",
      p.title,
      p.publication_status AS "publicationStatus",
      city.name AS "cityName",
      province.name AS "provinceName",
      property_covers.url AS image,
      COALESCE(view_metrics.views, 0)::integer AS views,
      COALESCE(view_metrics."previousViews", 0)::integer AS "previousViews",
      COALESCE(consultation_metrics.consultations, 0)::integer AS consultations,
      COALESCE(consultation_metrics."previousConsultations", 0)::integer AS "previousConsultations",
      COALESCE(favorite_metrics.favorites, 0)::integer AS favorites,
      COALESCE(favorite_metrics."previousFavorites", 0)::integer AS "previousFavorites"
    FROM owned_properties AS p
    LEFT JOIN inmobiliaria.cities AS city ON city.id = p.city_id
    LEFT JOIN inmobiliaria.provinces AS province ON province.id = city.province_id
    LEFT JOIN property_covers ON property_covers.property_id = p.id
    LEFT JOIN view_metrics ON view_metrics.property_id = p.id
    LEFT JOIN consultation_metrics ON consultation_metrics.property_id = p.id
    LEFT JOIN favorite_metrics ON favorite_metrics.property_id = p.id
    ORDER BY views DESC, consultations DESC, p.title ASC
  `, {
    replacements: { publisherId, ...timeBounds },
    type: QueryTypes.SELECT,
  });

  const properties = rows.map((row) => ({
    propertyId: row.propertyId,
    title: row.title,
    publicationStatus: row.publicationStatus,
    city: row.cityName,
    province: row.provinceName,
    image: row.image ?? null,
    views: asNumber(row.views),
    previousViews: asNumber(row.previousViews),
    consultations: asNumber(row.consultations),
    previousConsultations: asNumber(row.previousConsultations),
    favorites: asNumber(row.favorites),
    previousFavorites: asNumber(row.previousFavorites),
  }));

  const previousPeriod = {
    views: properties.reduce((total, property) => total + property.previousViews, 0),
    consultations: properties.reduce((total, property) => total + property.previousConsultations, 0),
    favorites: properties.reduce((total, property) => total + property.previousFavorites, 0),
  };
  const result = {
    period: periodDays ?? null,
    summary: {
      activeProperties: properties.filter(({ publicationStatus }) => publicationStatus === "active").length,
      pausedProperties: properties.filter(({ publicationStatus }) => publicationStatus === "paused").length,
      totalViews: properties.reduce((total, property) => total + property.views, 0),
      totalConsultations: properties.reduce((total, property) => total + property.consultations, 0),
      totalFavorites: properties.reduce((total, property) => total + property.favorites, 0),
      previousPeriod,
    },
    mostViewed: properties.length === 0 ? null : {
      propertyId: properties[0].propertyId,
      title: properties[0].title,
      views: properties[0].views,
    },
    properties,
    activity: [],
  };

  if (periodDays) {
    const activity = await getActivity(publisherId, { ...timeBounds, currentStartDate, currentEndDate });
    result.activity = activity.map((item) => ({
      date: item.date,
      views: asNumber(item.views),
      consultations: asNumber(item.consultations),
    }));
  }

  return result;
}
