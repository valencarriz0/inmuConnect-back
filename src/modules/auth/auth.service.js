import sequelize from "../../config/database.js";
import { AuthToken, User } from "../../models/index.js";
import AppError from "../../errors/AppError.js";
import { validateData } from "../../middlewares/validate.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { signAccessToken } from "../../utils/jwt.js";
import { generateAuthToken, hashAuthToken } from "../../utils/authToken.js";
import serializeUser from "../../serializers/userSerializer.js";
import { mailer } from "../../integrations/mail/mailer.js";
import env from "../../config/env.js";
import { createUser, emailCondition } from "../users/user.service.js";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resendVerificationSchema, resetPasswordSchema, verifyEmailSchema } from "./auth.validation.js";

const verificationPurpose = "email_verification";
const resetPurpose = "password_reset";
const expiresAt = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

export async function invalidateTokens(userId, purpose, transaction) {
  await AuthToken.update({ usedAt: new Date() }, { where: { userId, purpose, usedAt: null }, transaction });
}

export async function issueToken(userId, purpose, { transaction } = {}) {
  await invalidateTokens(userId, purpose, transaction);
  const token = generateAuthToken();
  await AuthToken.create({
    userId, purpose, tokenHash: hashAuthToken(token),
    expiresAt: expiresAt(purpose === verificationPurpose ? env.EMAIL_VERIFICATION_TTL_MINUTES : env.PASSWORD_RESET_TTL_MINUTES),
  }, { transaction });
  return token;
}

async function getUsableToken(token, purpose, transaction, invalidCode, expiredCode) {
  const authToken = await AuthToken.unscoped().findOne({
    where: { tokenHash: hashAuthToken(token), purpose }, transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!authToken || authToken.usedAt) throw new AppError(400, "El enlace no es válido.", undefined, invalidCode);
  if (authToken.expiresAt <= new Date()) {
    await authToken.update({ usedAt: new Date() }, { transaction, fields: ["usedAt"] });
    throw new AppError(400, "El enlace venció.", undefined, expiredCode);
  }
  return authToken;
}

export async function register(data) {
  const { passwordConfirm, ...userData } = validateData(registerSchema, data);
  const result = await sequelize.transaction(async (transaction) => {
    const user = await createUser(userData, { transaction });
    return { user, token: await issueToken(user.id, verificationPurpose, { transaction }) };
  });
  await mailer.sendVerificationEmail({ to: result.user.email, token: result.token });
  return { user: result.user, verificationRequired: true, message: "Te enviamos un correo para verificar tu cuenta." };
}

export async function login(data) {
  const input = validateData(loginSchema, data);
  const user = await User.unscoped().findOne({ where: emailCondition(input.email) });
  if (!user || !await comparePassword(input.password, user.passwordHash)) {
    throw new AppError(401, "Credenciales inválidas.");
  }
  if (user.accountStatus !== "active") throw new AppError(403, "Cuenta deshabilitada.");
  if (!user.emailVerifiedAt) throw new AppError(403, "Debés verificar tu correo electrónico antes de iniciar sesión.", undefined, "EMAIL_NOT_VERIFIED");
  return { user: serializeUser(user), token: signAccessToken(user) };
}

export async function verifyEmail(data) {
  const input = validateData(verifyEmailSchema, data);
  return sequelize.transaction(async (transaction) => {
    const authToken = await getUsableToken(input.token, verificationPurpose, transaction, "INVALID_VERIFICATION_TOKEN", "EXPIRED_VERIFICATION_TOKEN");
    const user = await User.findByPk(authToken.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new AppError(400, "El enlace no es válido.", undefined, "INVALID_VERIFICATION_TOKEN");
    const now = new Date();
    await user.update({ emailVerifiedAt: now }, { transaction, fields: ["emailVerifiedAt"] });
    await authToken.update({ usedAt: now }, { transaction, fields: ["usedAt"] });
    await invalidateTokens(user.id, verificationPurpose, transaction);
    return { user: serializeUser(user), token: signAccessToken(user) };
  });
}

export async function resendVerification(data) {
  const input = validateData(resendVerificationSchema, data);
  const user = await User.findOne({ where: emailCondition(input.email) });
  if (user && user.accountStatus === "active" && !user.emailVerifiedAt) {
    const token = await sequelize.transaction((transaction) => issueToken(user.id, verificationPurpose, { transaction }));
    await mailer.sendVerificationEmail({ to: user.email, token });
  }
  return { message: "Si existe una cuenta pendiente de verificación, recibirás un correo con las instrucciones." };
}

export async function forgotPassword(data) {
  const input = validateData(forgotPasswordSchema, data);
  const user = await User.findOne({ where: emailCondition(input.email) });
  if (user && user.accountStatus === "active") {
    const token = await sequelize.transaction((transaction) => issueToken(user.id, resetPurpose, { transaction }));
    await mailer.sendPasswordResetEmail({ to: user.email, token });
  }
  return { message: "Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer tu contraseña." };
}

export async function resetPassword(data) {
  const input = validateData(resetPasswordSchema, data);
  return sequelize.transaction(async (transaction) => {
    const authToken = await getUsableToken(input.token, resetPurpose, transaction, "INVALID_RESET_TOKEN", "EXPIRED_RESET_TOKEN");
    const user = await User.unscoped().findByPk(authToken.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new AppError(400, "El enlace no es válido.", undefined, "INVALID_RESET_TOKEN");
    const now = new Date();
    await user.update({ passwordHash: await hashPassword(input.password), authVersion: user.authVersion + 1 }, { transaction, fields: ["passwordHash", "authVersion"] });
    await authToken.update({ usedAt: now }, { transaction, fields: ["usedAt"] });
    await invalidateTokens(user.id, resetPurpose, transaction);
    return { message: "Tu contraseña fue restablecida correctamente." };
  });
}

export async function changePassword(currentUser, data) {
  const input = validateData(changePasswordSchema, data);
  const user = await User.unscoped().findByPk(currentUser.id);
  if (!user || !await comparePassword(input.currentPassword, user.passwordHash)) throw new AppError(400, "La contraseña actual es incorrecta.");
  if (await comparePassword(input.newPassword, user.passwordHash)) throw new AppError(400, "La nueva contraseña debe ser distinta de la actual.");
  return sequelize.transaction(async (transaction) => {
    const lockedUser = await User.unscoped().findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
    await lockedUser.update({ passwordHash: await hashPassword(input.newPassword), authVersion: lockedUser.authVersion + 1 }, { transaction, fields: ["passwordHash", "authVersion"] });
    await invalidateTokens(lockedUser.id, resetPurpose, transaction);
    return { user: serializeUser(lockedUser), token: signAccessToken(lockedUser) };
  });
}
