function plain(record) {
  return typeof record?.get === "function" ? record.get({ plain: true }) : record;
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function serializeInteractionProperty(property) {
  const value = plain(property);
  const city = plain(value?.city);
  const province = plain(city?.province);
  const images = (value?.images ?? [])
    .map(plain)
    .sort((left, right) => left.position - right.position)
    .map(({ url }) => url);
  return {
    id: value?.id ?? null,
    title: value?.title ?? null,
    operationType: value?.operationType ?? null,
    price: numeric(value?.price),
    currency: value?.currency ?? null,
    images,
    city: city ? { id: city.id, name: city.name } : null,
    province: province ? { id: province.id, name: province.name } : null,
  };
}

export function serializeConsultation(consultation, { includeProperty = false } = {}) {
  const value = plain(consultation);
  return {
    id: value.id,
    propertyId: value.propertyId,
    ...(includeProperty ? { property: serializeInteractionProperty(value.property) } : {}),
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    phone: value.phone,
    message: value.message ?? null,
    createdAt: value.createdAt,
  };
}

export function serializeNotification(notification) {
  const value = plain(notification);
  const consultation = plain(value.consultation);
  return {
    id: value.id,
    type: value.type,
    title: value.title,
    message: value.message ?? null,
    consultationId: value.consultationId ?? null,
    publisherApplicationId: value.publisherApplicationId ?? null,
    searchAlertId: value.searchAlertId ?? null,
    propertyId: value.propertyId ?? consultation?.propertyId ?? null,
    readAt: value.readAt ?? null,
    createdAt: value.createdAt,
  };
}
