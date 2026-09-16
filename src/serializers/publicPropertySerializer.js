function plain(record) {
  return typeof record?.get === "function" ? record.get({ plain: true }) : record;
}

function serializeLocation(city) {
  const value = plain(city);
  const province = plain(value?.province);
  return {
    city: value ? { id: value.id, name: value.name } : null,
    province: province ? { id: province.id, name: province.name } : null,
  };
}

function sortedImageUrls(images = []) {
  return [...images]
    .map(plain)
    .sort((left, right) => left.position - right.position)
    .map((image) => image.url);
}

function sortedCatalog(values = []) {
  return values
    .map(plain)
    .map(({ id, code, name }) => ({ id, code, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

const commonFields = [
  "id", "title", "description", "operationType", "propertyType", "price", "currency",
  "street", "streetNumber", "totalArea", "rooms", "bedrooms", "bathrooms", "age",
  "propertyCondition", "acceptsPets", "garage", "expenses", "taxes", "commissions",
  "latitude", "longitude", "createdAt",
];

function serializeCommon(property) {
  const value = plain(property);
  const result = {};
  for (const field of commonFields) result[field] = value[field] ?? null;
  return {
    ...result,
    ...serializeLocation(value.city),
    images: sortedImageUrls(value.images),
  };
}

export function serializePropertySummary(property) {
  return serializeCommon(property);
}

export function serializePropertyDetail(property) {
  const value = plain(property);
  return {
    ...serializeCommon(value),
    services: sortedCatalog(value.services),
    amenities: sortedCatalog(value.amenities),
  };
}
