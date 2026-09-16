import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4"] });

export const cityListQuerySchema = Joi.object({ provinceId: uuid });

export const locationSearchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required(),
});
