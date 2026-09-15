import User from "../../models/User.js";
import AppError from "../../errors/AppError.js";
import { validateData } from "../../middlewares/validate.js";
import { comparePassword } from "../../utils/password.js";
import { signAccessToken } from "../../utils/jwt.js";
import serializeUser from "../../serializers/userSerializer.js";
import { createUser, emailCondition } from "../users/user.service.js";
import { registerSchema, loginSchema } from "./auth.validation.js";

export async function register(data) {
  const { passwordConfirm, ...userData } = validateData(registerSchema, data);
  const user = await createUser(userData);
  return { user, token: signAccessToken(user.id) };
}

export async function login(data) {
  const input = validateData(loginSchema, data);
  const user = await User.unscoped().findOne({ where: emailCondition(input.email) });
  if (!user || !await comparePassword(input.password, user.passwordHash)) {
    throw new AppError(401, "Credenciales inválidas.");
  }
  if (user.accountStatus !== "active") throw new AppError(403, "Cuenta deshabilitada.");
  return { user: serializeUser(user), token: signAccessToken(user.id) };
}
