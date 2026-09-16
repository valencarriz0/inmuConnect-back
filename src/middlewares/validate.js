import AppError from "../errors/AppError.js";

const fieldMessages = {
  firstName: "Ingresá un nombre válido de al menos 2 caracteres.",
  lastName: "Ingresá un apellido válido de al menos 2 caracteres.",
  email: "Ingresá un correo electrónico válido.",
  phone: "Ingresá un teléfono con entre 7 y 15 dígitos.",
  password: "La contraseña debe tener entre 6 y 72 caracteres y no superar 72 bytes UTF-8.",
  passwordConfirm: "La confirmación debe coincidir con la contraseña.",
  publisherType: "Seleccioná un tipo de publicador válido.",
  taxId: "Ingresá un CUIT/CUIL válido de 11 dígitos.",
  agencyName: "Ingresá el nombre de la inmobiliaria.",
  rejectionReason: "Ingresá un motivo de rechazo válido.",
  status: "Seleccioná un estado de solicitud válido.",
  id: "Ingresá un identificador válido.",
  operationType: "Seleccioná un tipo de operación válido.",
  propertyType: "Seleccioná un tipo de propiedad válido.",
  provinceId: "Ingresá una provincia válida.",
  cityId: "Ingresá una ciudad válida.",
  currency: "Seleccioná una moneda válida.",
  minPrice: "Ingresá un precio mínimo válido.",
  maxPrice: "Ingresá un precio máximo válido.",
  sort: "Seleccioná un orden válido.",
  page: "Ingresá una página válida.",
  limit: "Ingresá un límite entre 1 y 50.",
  q: "Ingresá al menos 2 caracteres para buscar.",
  street: "Ingresá una calle válida de entre 2 y 150 caracteres.",
  streetNumber: "Ingresá una altura válida de hasta 30 caracteres.",
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

export default function validate(schema, source = "body") {
  return (req, res, next) => {
    try {
      req[source] = validateData(schema, req[source]);
      next();
    } catch (error) {
      next(error);
    }
  };
}
