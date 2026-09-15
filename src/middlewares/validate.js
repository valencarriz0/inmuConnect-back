import AppError from "../errors/AppError.js";

const fieldMessages = {
  firstName: "Ingresá un nombre válido de al menos 2 caracteres.",
  lastName: "Ingresá un apellido válido de al menos 2 caracteres.",
  email: "Ingresá un correo electrónico válido.",
  phone: "Ingresá un teléfono con entre 7 y 15 dígitos.",
  password: "La contraseña debe tener entre 6 y 72 caracteres y no superar 72 bytes UTF-8.",
  passwordConfirm: "La confirmación debe coincidir con la contraseña.",
};

export function validateData(schema, data) {
  const { error, value } = schema.validate(data, { abortEarly: false, allowUnknown: false });
  if (error) {
    const details = {};
    for (const detail of error.details) {
      const field = detail.path[0];
      // No devolver mensajes, valores ni nombres de campos arbitrarios recibidos por Joi.
      if (detail.type !== "object.unknown" && Object.hasOwn(fieldMessages, field)) {
        details[field] = fieldMessages[field];
      } else {
        details.request = "Enviá un objeto con los campos permitidos y al menos un dato válido.";
      }
    }
    throw new AppError(400, "Datos inválidos.", details);
  }
  return value;
}

export default function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = validateData(schema, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}
