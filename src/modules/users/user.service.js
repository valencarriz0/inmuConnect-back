import { col, fn, where, UniqueConstraintError } from "sequelize";
import User from "../../models/User.js";
import AppError from "../../errors/AppError.js";
import { validateData } from "../../middlewares/validate.js";
import { normalizeEmail } from "../../utils/email.js";
import { hashPassword } from "../../utils/password.js";
import serializeUser from "../../serializers/userSerializer.js";
import { createUserSchema, updateMeSchema } from "./user.validation.js";

export function emailCondition(email) {
  return where(fn("lower", col("email")), normalizeEmail(email));
}

function isDuplicateEmail(error) {
  if (!(error instanceof UniqueConstraintError)) return false;
  const constraint = error.original?.constraint ?? error.parent?.constraint;
  if (constraint) return constraint === "users_email_unique";
  return Object.keys(error.fields ?? {}).some((field) => ["email", "lower(email)"].includes(field));
}

// La transacción pertenece al caller: se propaga a ambas queries sin abrirla ni finalizarla.
// Devuelve datos públicos, de modo que otros services pueden usar user.id sin recibir el hash.
export async function createUser(data, { transaction } = {}) {
  const input = validateData(createUserSchema, data);
  const existing = await User.findOne({ where: emailCondition(input.email), transaction });
  if (existing) throw new AppError(409, "El correo electrónico ya está registrado.");

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone || null,
      passwordHash,
      role: "interested",
      accountStatus: "active",
    }, { transaction });
    return serializeUser(user);
  } catch (error) {
    if (isDuplicateEmail(error)) {
      throw new AppError(409, "El correo electrónico ya está registrado.");
    }
    throw error;
  }
}

export async function updateMe(user, data) {
  const input = validateData(updateMeSchema, data);
  if (Object.hasOwn(input, "phone")) input.phone = input.phone || null;
  if (user.role === "publisher" && input.phone === null) {
    throw new AppError(400, "El teléfono es obligatorio para usuarios publicadores.");
  }
  await user.update(input, { fields: Object.keys(input) });
  return serializeUser(user);
}
