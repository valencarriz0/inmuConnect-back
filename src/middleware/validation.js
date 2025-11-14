import Joi from "joi";

// Esquema de validación para crear usuario
const createUserSchema = Joi.object({
  tipo: Joi.string().valid("persona", "inmobiliaria").required().messages({
    "any.only": 'El tipo debe ser "persona" o "inmobiliaria"',
    "any.required": "El tipo de usuario es requerido",
  }),

  nombre: Joi.string().min(2).max(50).required().messages({
    "string.empty": "El nombre es requerido",
    "string.min": "El nombre debe tener al menos 2 caracteres",
    "string.max": "El nombre no puede exceder 50 caracteres",
  }),

  apellido: Joi.when("tipo", {
    is: "persona",
    then: Joi.string().min(2).max(50).required().messages({
      "string.empty": "El apellido es requerido para personas",
      "string.min": "El apellido debe tener al menos 2 caracteres",
      "string.max": "El apellido no puede exceder 50 caracteres",
    }),
    otherwise: Joi.forbidden(), // si es inmobiliaria, no se permite apellido
  }),

  email: Joi.string().email().required().messages({
    "string.email": "Debe proporcionar un email válido",
    "string.empty": "El email es requerido",
  }),

  password: Joi.string().min(6).required().messages({
    "string.empty": "La contraseña es requerida",
    "string.min": "La contraseña debe tener al menos 6 caracteres",
  }),

  telefono: Joi.string().optional(),
  CUIT: Joi.string().optional(),
  calle: Joi.string().optional(),
  altura: Joi.number().optional(),
});

export const validateCreateUser = (req, res, next) => {
  const { error } = createUserSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

export const validateUpdateUser = (req, res, next) => {
  const { error } = updateUserSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};
