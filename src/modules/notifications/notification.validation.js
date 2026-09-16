import Joi from "joi";

export const notificationParamsSchema = Joi.object({
  id: Joi.string().guid({ version: ["uuidv4"] }).required(),
});
