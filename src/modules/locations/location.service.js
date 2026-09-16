import { Op } from "sequelize";
import { City, Province } from "../../models/index.js";
import {
  serializeCity,
  serializeCityResult,
  serializeProvince,
  serializeProvinceResult,
} from "../../serializers/locationSerializer.js";

export async function listProvinces() {
  const provinces = await Province.findAll({
    attributes: ["id", "name"],
    order: [["name", "ASC"]],
  });
  return { provinces: provinces.map(serializeProvince) };
}

export async function listCities(provinceId) {
  const cities = await City.findAll({
    attributes: ["id", "name", "provinceId"],
    ...(provinceId ? { where: { provinceId } } : {}),
    include: [{ association: "province", attributes: ["id", "name"], required: true }],
    order: [[{ model: Province, as: "province" }, "name", "ASC"], ["name", "ASC"]],
  });
  return { cities: cities.map(serializeCity) };
}

function normalized(value) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
}

export async function searchLocations(query) {
  const match = { [Op.iLike]: `%${query}%` };
  const [provinces, cities] = await Promise.all([
    Province.findAll({
      attributes: ["id", "name"],
      where: { name: match },
      order: [["name", "ASC"]],
      limit: 10,
    }),
    City.findAll({
      attributes: ["id", "name", "provinceId"],
      where: { name: match },
      include: [{ association: "province", attributes: ["id", "name"], required: true }],
      order: [["name", "ASC"]],
      limit: 10,
    }),
  ]);
  const prefix = normalized(query);
  const results = [
    ...provinces.map(serializeProvinceResult),
    ...cities.map(serializeCityResult),
  ].sort((left, right) => {
    const leftStarts = normalized(left.name).startsWith(prefix);
    const rightStarts = normalized(right.name).startsWith(prefix);
    if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
    return left.label.localeCompare(right.label, "es");
  }).slice(0, 10);
  return { locations: results };
}
