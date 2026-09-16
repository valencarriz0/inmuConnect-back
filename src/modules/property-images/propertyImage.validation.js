import Joi from "joi";

export const deletePropertyImagesSchema = Joi.object({
  paths: Joi.array().items(Joi.string().trim().min(1).max(500)).min(1).max(5).required(),
});
