import * as authService from "./auth.service.js";
import serializeUser from "../../serializers/userSerializer.js";

export async function register(req, res) {
  res.status(201).json(await authService.register(req.body));
}

export async function login(req, res) {
  res.status(200).json(await authService.login(req.body));
}
export async function verifyEmail(req, res) { res.status(200).json(await authService.verifyEmail(req.body)); }
export async function resendVerification(req, res) { res.status(200).json(await authService.resendVerification(req.body)); }
export async function forgotPassword(req, res) { res.status(200).json(await authService.forgotPassword(req.body)); }
export async function resetPassword(req, res) { res.status(200).json(await authService.resetPassword(req.body)); }
export async function changePassword(req, res) { res.status(200).json(await authService.changePassword(req.user, req.body)); }

export function me(req, res) {
  res.status(200).json({ user: serializeUser(req.user) });
}
