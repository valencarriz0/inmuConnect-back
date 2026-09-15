import * as userService from "./user.service.js";

export async function updateMe(req, res) {
  res.status(200).json({ user: await userService.updateMe(req.user, req.body) });
}
