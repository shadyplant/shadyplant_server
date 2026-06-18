const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapMediaUploadRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    createdByStaffAccountId: row.created_by_staff_account_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    slotKey: row.slot_key,
    purpose: row.purpose,
    originalFileName: row.original_file_name,
    contentType: row.content_type,
    byteSize: Number(row.byte_size || 0),
    s3Key: row.s3_key,
    publicUrl: row.public_url,
    status: row.status,
    expiresAt: row.expires_at,
    uploadedAt: row.uploaded_at,
    completedAt: row.completed_at,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const createMediaUpload = async (payload) => {
  const id = generateId();
  const now = new Date();

  await query(
    `INSERT INTO media_uploads (
      id,
      organization_id,
      created_by_staff_account_id,
      entity_type,
      entity_id,
      slot_key,
      purpose,
      original_file_name,
      content_type,
      byte_size,
      s3_key,
      public_url,
      status,
      expires_at,
      uploaded_at,
      completed_at,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    )`,
    [
      id,
      payload.organizationId,
      payload.createdByStaffAccountId || null,
      payload.entityType || "",
      payload.entityId || "",
      payload.slotKey || "",
      payload.purpose,
      payload.originalFileName || "",
      payload.contentType || "",
      payload.byteSize || 0,
      payload.s3Key,
      payload.publicUrl,
      payload.status || "pending",
      payload.expiresAt,
      payload.uploadedAt || null,
      payload.completedAt || null,
      payload.metadata || {},
      now,
      now,
    ],
  );

  return {
    id,
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
};

const findMediaUploadById = async (uploadId) => {
  const result = await query(
    "SELECT * FROM media_uploads WHERE id = $1 LIMIT 1",
    [uploadId],
  );

  return mapMediaUploadRow(result.rows[0]);
};

const updateMediaUpload = async (uploadId, updates) => {
  const statement = buildUpdateStatement(
    {
      status: updates.status,
      uploadedAt: updates.uploadedAt,
      completedAt: updates.completedAt,
      metadata: updates.metadata,
      updatedAt: new Date(),
    },
    {
      status: "status",
      uploadedAt: "uploaded_at",
      completedAt: "completed_at",
      metadata: "metadata",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findMediaUploadById(uploadId);
  }

  await query(
    `UPDATE media_uploads SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, uploadId],
  );

  return findMediaUploadById(uploadId);
};

module.exports = {
  createMediaUpload,
  findMediaUploadById,
  mapMediaUploadRow,
  updateMediaUpload,
};
