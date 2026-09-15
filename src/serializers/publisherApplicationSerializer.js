import serializeUser from "./userSerializer.js";

function serializeApplicant(user) {
  const { createdAt, updatedAt, ...applicant } = serializeUser(user);
  return applicant;
}

export default function serializePublisherApplication(application, { includeApplicant = false } = {}) {
  const result = {
    id: application.id,
    userId: application.userId,
    publisherType: application.publisherType,
    taxId: application.taxId,
    agencyName: application.agencyName ?? null,
    phone: application.phone,
    status: application.status,
    reviewedAt: application.reviewedAt ?? null,
    reviewedBy: application.reviewedBy ?? null,
    rejectionReason: application.rejectionReason ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };

  if (includeApplicant) result.applicant = serializeApplicant(application.applicant);
  return result;
}
