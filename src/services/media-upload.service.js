const path = require("path");
const { env } = require("../config/env");
const { findOrganizationById } = require("../repositories/staff.repository");
const {
  createMediaUpload,
  findMediaUploadById,
  updateMediaUpload,
} = require("../repositories/media-upload.repository");
const { ApiError } = require("../utils/apiError");
const { generateId } = require("../utils/crypto");
const { createPresignedS3PutUrl } = require("../utils/s3");

const MAX_MEDIA_UPLOAD_SIZE_BYTES = 12 * 1024 * 1024;
const MEDIA_UPLOAD_TTL_SECONDS = 15 * 60;

const SUPPORTED_IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["image/avif", ".avif"],
]);

const ALLOWED_PURPOSES = new Set([
  "product-image",
  "product-gallery-image",
  "product-uses-view-image",
  "home-category-image",
  "home-slider-desktop-image",
  "home-slider-mobile-image",
  "service-image",
]);

function slugifyValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFileExtension(fileName, contentType) {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const nameExtension = path.extname(normalizedName);
  if (nameExtension && nameExtension.length <= 8) {
    return nameExtension;
  }

  if (SUPPORTED_IMAGE_EXTENSIONS.has(String(contentType || "").trim().toLowerCase())) {
    return SUPPORTED_IMAGE_EXTENSIONS.get(
      String(contentType || "").trim().toLowerCase(),
    );
  }

  return ".jpg";
}

function buildMediaPurposeFolder(purpose) {
  return slugifyValue(purpose || "media") || "media";
}

function buildMediaKey({
  organizationSlug,
  purpose,
  entityType,
  entityId,
  slotKey,
  originalFileName,
  contentType,
}) {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeSlug =
    slugifyValue(entityId) ||
    slugifyValue(originalFileName) ||
    slugifyValue(entityType) ||
    "item";
  const keyId = generateId().replace(/-/g, "");
  const extension = sanitizeFileExtension(originalFileName, contentType);
  const pathParts = [
    "media",
    slugifyValue(organizationSlug) || "organization",
    buildMediaPurposeFolder(purpose),
    entityType ? slugifyValue(entityType) : null,
    safeSlug,
    slotKey ? slugifyValue(slotKey) : null,
    yyyy,
    mm,
    `${keyId}${extension}`,
  ].filter(Boolean);

  return pathParts.join("/");
}

function normalizeUploadRequest(payload = {}) {
  const purpose = String(payload.purpose || "").trim().toLowerCase();
  const entityType = String(payload.entityType || "").trim().toLowerCase();
  const entityId = String(payload.entityId || "").trim();
  const slotKey = String(payload.slotKey || "").trim();
  const originalFileName = String(payload.fileName || payload.originalFileName || "").trim();
  const contentType = String(payload.contentType || "").trim().toLowerCase();
  const byteSize = Math.max(0, Math.floor(Number(payload.byteSize || 0)));

  if (!ALLOWED_PURPOSES.has(purpose)) {
    throw new ApiError(400, "Unsupported media upload purpose.");
  }

  if (!originalFileName) {
    throw new ApiError(400, "Image file name is required.");
  }

  if (!contentType.startsWith("image/")) {
    throw new ApiError(400, "Only image uploads are supported.");
  }

  if (byteSize <= 0) {
    throw new ApiError(400, "Image file size is required.");
  }

  if (byteSize > MAX_MEDIA_UPLOAD_SIZE_BYTES) {
    throw new ApiError(400, "Image uploads must be 12 MB or smaller.");
  }

  if (!entityType) {
    throw new ApiError(400, "Media entity type is required.");
  }

  return {
    purpose,
    entityType,
    entityId,
    slotKey,
    originalFileName,
    contentType,
    byteSize,
  };
}

async function createAdminMediaUploadSession(staff, payload = {}) {
  if (!env.awsS3.bucketName || !env.awsS3.region || !env.awsS3.accessKeyId || !env.awsS3.secretAccessKey) {
    throw new ApiError(503, "S3 uploads are not configured on the server.");
  }

  const normalized = normalizeUploadRequest(payload);
  const organization = await findOrganizationById(staff.organizationId);

  if (!organization) {
    throw new ApiError(404, "Organization not found.");
  }

  const key = buildMediaKey({
    organizationSlug: organization.slug,
    purpose: normalized.purpose,
    entityType: normalized.entityType,
    entityId: normalized.entityId || "draft",
    slotKey: normalized.slotKey,
    originalFileName: normalized.originalFileName,
    contentType: normalized.contentType,
  });

  const expiresAt = new Date(Date.now() + MEDIA_UPLOAD_TTL_SECONDS * 1000);
  const signed = createPresignedS3PutUrl({
    accessKeyId: env.awsS3.accessKeyId,
    bucketName: env.awsS3.bucketName,
    region: env.awsS3.region,
    secretAccessKey: env.awsS3.secretAccessKey,
    key,
    expiresInSeconds: MEDIA_UPLOAD_TTL_SECONDS,
    publicBaseUrl: env.awsS3.cdnBaseUrl,
  });

  const session = await createMediaUpload({
    organizationId: staff.organizationId,
    createdByStaffAccountId: staff.staffAccountId,
    entityType: normalized.entityType,
    entityId: normalized.entityId,
    slotKey: normalized.slotKey,
    purpose: normalized.purpose,
    originalFileName: normalized.originalFileName,
    contentType: normalized.contentType,
    byteSize: normalized.byteSize,
    s3Key: key,
    publicUrl: signed.publicUrl,
    status: "pending",
    expiresAt,
    metadata: {
      purpose: normalized.purpose,
      entityType: normalized.entityType,
      entityId: normalized.entityId,
      slotKey: normalized.slotKey,
      region: env.awsS3.region,
      bucketName: env.awsS3.bucketName,
      cdnBaseUrl: env.awsS3.cdnBaseUrl,
    },
  });

  return {
    session,
    signedUrl: signed.signedUrl,
    publicUrl: signed.publicUrl,
    method: "PUT",
    headers: {
      "Content-Type": normalized.contentType,
    },
    expiresInSeconds: MEDIA_UPLOAD_TTL_SECONDS,
  };
}

async function completeAdminMediaUploadSession(uploadId, staff, payload = {}) {
  const upload = await findMediaUploadById(uploadId);

  if (!upload || upload.organizationId !== staff.organizationId) {
    throw new ApiError(404, "Media upload session not found.");
  }

  const publicUrl = String(payload.publicUrl || upload.publicUrl || "").trim();

  if (!publicUrl) {
    throw new ApiError(400, "Media upload public URL is required.");
  }

  const nextUpload = await updateMediaUpload(uploadId, {
    status: "uploaded",
    uploadedAt: new Date(),
    completedAt: new Date(),
    metadata: {
      ...(upload.metadata || {}),
      completedByStaffAccountId: staff.staffAccountId,
      publicUrl,
    },
  });

  return nextUpload;
}

module.exports = {
  completeAdminMediaUploadSession,
  createAdminMediaUploadSession,
  MAX_MEDIA_UPLOAD_SIZE_BYTES,
};
