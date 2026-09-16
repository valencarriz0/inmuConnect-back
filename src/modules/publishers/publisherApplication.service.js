import { Op, UniqueConstraintError } from "sequelize";
import sequelize from "../../config/database.js";
import { PublisherApplication, PublisherProfile, Notification, User } from "../../models/index.js";
import AppError from "../../errors/AppError.js";
import { validateData } from "../../middlewares/validate.js";
import serializePublisherApplication from "../../serializers/publisherApplicationSerializer.js";
import { issueToken } from "../auth/auth.service.js";
import { mailer } from "../../integrations/mail/mailer.js";
import { createUser } from "../users/user.service.js";
import { applicationSchema, publicApplicationSchema, rejectSchema } from "./publisherApplication.validation.js";

const activeStatuses = ["pending", "approved"];

function constraintName(error) {
  return error.original?.constraint ?? error.parent?.constraint;
}

function mapApplicationConflict(error) {
  if (!(error instanceof UniqueConstraintError)) throw error;
  const constraint = constraintName(error);
  if (constraint === "publisher_applications_user_open_unique") {
    throw new AppError(409, "Ya existe una solicitud activa para esta cuenta.");
  }
  if (constraint === "publisher_applications_tax_id_open_unique") {
    throw new AppError(409, "El CUIT/CUIL ya está asociado a una solicitud activa.");
  }
  throw error;
}

function applicationValues(userId, input) {
  return {
    userId,
    publisherType: input.publisherType,
    taxId: input.taxId,
    agencyName: input.publisherType === "agency" ? input.agencyName : null,
    phone: input.phone,
    status: "pending",
  };
}

async function ensureNoActiveApplication(userId, taxId, transaction) {
  const byUser = await PublisherApplication.findOne({
    where: { userId, status: { [Op.in]: activeStatuses } },
    transaction,
  });
  if (byUser) throw new AppError(409, "Ya existe una solicitud activa para esta cuenta.");

  const byTaxId = await PublisherApplication.findOne({
    where: { taxId, status: { [Op.in]: activeStatuses } },
    transaction,
  });
  if (byTaxId) throw new AppError(409, "El CUIT/CUIL ya está asociado a una solicitud activa.");
}

async function persistApplication(userId, input, transaction) {
  await ensureNoActiveApplication(userId, input.taxId, transaction);
  try {
    return await PublisherApplication.create(applicationValues(userId, input), { transaction });
  } catch (error) {
    mapApplicationConflict(error);
  }
}

export async function registerPublicApplication(data) {
  const input = validateData(publicApplicationSchema, data);
  let result;
  try {
    result = await sequelize.transaction(async (transaction) => {
      const user = await createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        password: input.password,
      }, { transaction });
      const application = await persistApplication(user.id, input, transaction);
      const token = await issueToken(user.id, "email_verification", { transaction });
      return { user, application: serializePublisherApplication(application), token };
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 409 &&
        error.message === "El correo electrónico ya está registrado.") {
      throw new AppError(409, "El correo electrónico ya está registrado. Iniciá sesión para continuar.");
    }
    throw error;
  }

  await mailer.sendVerificationEmail({ to: result.user.email, token: result.token });
  return { user: result.user, application: result.application, verificationRequired: true, message: "Te enviamos un correo para verificar tu cuenta." };
}

export async function createApplication(user, data) {
  const input = validateData(applicationSchema, data);
  if (user.role === "publisher") {
    throw new AppError(409, "La cuenta ya está habilitada como publicador.");
  }
  if (user.role !== "interested") throw new AppError(403, "La cuenta no puede solicitar ser publicador.");

  const application = await sequelize.transaction((transaction) =>
    persistApplication(user.id, input, transaction));
  return serializePublisherApplication(application);
}

export async function getMyLatestApplication(userId) {
  const application = await PublisherApplication.findOne({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  return application ? serializePublisherApplication(application) : null;
}

export async function listApplications(status) {
  const applications = await PublisherApplication.findAll({
    where: { status },
    order: [["createdAt", "ASC"]],
    include: [{
      association: "applicant",
      attributes: ["id", "firstName", "lastName", "email", "phone", "role", "accountStatus"],
    }],
  });
  return applications.map((application) =>
    serializePublisherApplication(application, { includeApplicant: true }));
}

async function getPendingApplication(id, transaction) {
  const application = await PublisherApplication.findByPk(id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!application) throw new AppError(404, "Solicitud no encontrada.");
  if (application.status !== "pending") throw new AppError(409, "La solicitud ya fue resuelta.");
  return application;
}

async function getValidApplicant(userId, transaction) {
  const applicant = await User.findByPk(userId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!applicant || applicant.accountStatus !== "active" || applicant.role !== "interested") {
    throw new AppError(409, "La cuenta solicitante ya no puede convertirse en publicador.");
  }
  if (!applicant.emailVerifiedAt) {
    throw new AppError(409, "La cuenta solicitante debe verificar su correo electrónico antes de ser aprobada.");
  }
  return applicant;
}

export async function approveApplication(id, adminId) {
  return sequelize.transaction(async (transaction) => {
    const application = await getPendingApplication(id, transaction);
    const applicant = await getValidApplicant(application.userId, transaction);
    const reviewedAt = new Date();

    await applicant.update({ phone: application.phone, role: "publisher" }, {
      transaction,
      fields: ["phone", "role"],
    });
    await PublisherProfile.create({
      userId: applicant.id,
      publisherType: application.publisherType,
      taxId: application.taxId,
      agencyName: application.agencyName ?? null,
    }, { transaction });
    await application.update({
      status: "approved",
      reviewedAt,
      reviewedBy: adminId,
      rejectionReason: null,
    }, { transaction, fields: ["status", "reviewedAt", "reviewedBy", "rejectionReason"] });
    await Notification.create({
      userId: applicant.id,
      type: "publisher_approved",
      title: "Solicitud de publicación aprobada",
      message: "Tu cuenta ya está habilitada para publicar propiedades.",
      publisherApplicationId: application.id,
    }, { transaction });

    return serializePublisherApplication(application);
  });
}

export async function rejectApplication(id, adminId, data) {
  const input = validateData(rejectSchema, data);
  const rejectionReason = input.rejectionReason?.trim() || null;
  return sequelize.transaction(async (transaction) => {
    const application = await getPendingApplication(id, transaction);
    const reviewedAt = new Date();
    await application.update({
      status: "rejected",
      reviewedAt,
      reviewedBy: adminId,
      rejectionReason,
    }, { transaction, fields: ["status", "reviewedAt", "reviewedBy", "rejectionReason"] });
    await Notification.create({
      userId: application.userId,
      type: "publisher_rejected",
      title: "Solicitud de publicación rechazada",
      message: rejectionReason,
      publisherApplicationId: application.id,
    }, { transaction });

    return serializePublisherApplication(application);
  });
}
