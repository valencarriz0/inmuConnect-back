import Joi from "joi";

export const favoriteParamsSchema = Joi.object({
  propertyId: Joi.string().guid({ version: ["uuidv4"] }).required(),
});
