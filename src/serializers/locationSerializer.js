function plain(record) {
  return typeof record?.get === "function" ? record.get({ plain: true }) : record;
}

export function serializeProvince(province) {
  const value = plain(province);
  return { id: value.id, name: value.name };
}

export function serializeCity(city) {
  const value = plain(city);
  const province = plain(value.province);
  return {
    id: value.id,
    name: value.name,
    provinceId: value.provinceId,
    provinceName: province.name,
  };
}

export function serializeProvinceResult(province) {
  const value = plain(province);
  return {
    id: value.id,
    type: "province",
    name: value.name,
    label: value.name,
  };
}

export function serializeCityResult(city) {
  const value = serializeCity(city);
  return {
    id: value.id,
    type: "city",
    name: value.name,
    label: `${value.name}, ${value.provinceName}`,
    provinceId: value.provinceId,
    provinceName: value.provinceName,
  };
}
