import { Op } from "sequelize";
import AppError from "../../errors/AppError.js";
import User from "../../models/User.js";
import serializeUser from "../../serializers/userSerializer.js";

const attributes = [
  "id", "firstName", "lastName", "email", "phone", "role", "accountStatus", "createdAt", "updatedAt",
];

function managedRoles(role) {
  return role ?? { [Op.in]: ["interested", "publisher"] };
}

async function findManagedUser(id) {
  const user = await User.findOne({ attributes, where: { id, role: { [Op.ne]: "admin" } } });
  if (!user) throw new AppError(404, "Usuario no encontrado.");
  return user;
}

export async function listAdminUsers(filters) {
  const where = { role: managedRoles(filters.role) };
  if (filters.status) where.accountStatus = filters.status;
  if (filters.q) {
    where[Op.or] = ["firstName", "lastName", "email"]
      .map((field) => ({ [field]: { [Op.iLike]: `%${filters.q}%` } }));
  }
  const { count, rows } = await User.findAndCountAll({
    attributes,
    where,
    order: [["createdAt", "DESC"], ["id", "ASC"]],
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  });
  return {
    users: rows.map(serializeUser),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: count,
      totalPages: count === 0 ? 0 : Math.ceil(count / filters.limit),
    },
  };
}

export async function updateAdminUser(id, data) {
  const user = await findManagedUser(id);
  const values = { ...data };
  if (Object.hasOwn(values, "phone")) values.phone = values.phone || null;
  if (user.role === "publisher" && values.phone === null) {
    throw new AppError(400, "El teléfono es obligatorio para usuarios publicadores.");
  }
  await user.update(values, { fields: Object.keys(values) });
  return serializeUser(user);
}

async function changeAccountStatus(id, accountStatus) {
  const user = await findManagedUser(id);
  if (user.accountStatus !== accountStatus) {
    await user.update({ accountStatus }, { fields: ["accountStatus"] });
  }
  return serializeUser(user);
}

export function disableAdminUser(id) {
  return changeAccountStatus(id, "disabled");
}

export function reactivateAdminUser(id) {
  return changeAccountStatus(id, "active");
}
