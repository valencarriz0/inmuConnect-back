function plain(record) {
  return typeof record?.get === "function" ? record.get({ plain: true }) : record;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinates(latitudeValue, longitudeValue) {
  const latitude = nullableNumber(latitudeValue);
  const longitude = nullableNumber(longitudeValue);
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function catalog(values = []) {
  return values
    .map(plain)
    .map(({ id, code, name }) => ({ id, code, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export function serializePublisherProperty(property) {
  const value = plain(property);
  const city = plain(value.city);
  const province = plain(city?.province);
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    operationType: value.operationType,
    propertyType: value.propertyType,
    price: nullableNumber(value.price),
    currency: value.currency,
    street: value.street ?? null,
    streetNumber: value.streetNumber ?? null,
    totalArea: nullableNumber(value.totalArea),
    rooms: value.rooms,
    bedrooms: value.bedrooms ?? null,
    bathrooms: value.bathrooms ?? null,
    age: value.age ?? null,
    propertyCondition: value.propertyCondition ?? null,
    acceptsPets: value.acceptsPets ?? null,
    garage: value.garage ?? null,
    expenses: nullableNumber(value.expenses),
    taxes: nullableNumber(value.taxes),
    commissions: nullableNumber(value.commissions),
    publicationStatus: value.publicationStatus,
    ...coordinates(value.latitude, value.longitude),
    city: city ? { id: city.id, name: city.name } : null,
    province: province ? { id: province.id, name: province.name } : null,
    images: [...(value.images ?? [])]
      .map(plain)
      .sort((left, right) => left.position - right.position)
      .map((image) => image.url),
    services: catalog(value.services),
    amenities: catalog(value.amenities),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function serializePropertyHistory(entry) {
  const value = plain(entry);
  return {
    id: value.id,
    action: value.action,
    previousData: value.previousData ?? null,
    newData: value.newData ?? null,
    createdAt: value.createdAt,
  };
}
