const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapServiceRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: Number(row.price || 0),
    unit: row.unit,
    badge: row.badge,
    description: row.description,
    image: row.image,
    images: row.images || [],
    tags: row.tags || [],
    isActive: Boolean(row.is_active),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const listServicesByOrganizationId = async (organizationId) => {
  const result = await query(
    `SELECT *
     FROM service_catalog
     WHERE organization_id = $1
     ORDER BY created_at DESC`,
    [organizationId],
  );

  return result.rows.map(mapServiceRow).filter(Boolean);
};

const findServiceById = async (serviceId) => {
  const result = await query(
    "SELECT * FROM service_catalog WHERE id = $1 LIMIT 1",
    [serviceId],
  );

  return mapServiceRow(result.rows[0]);
};

const createService = async (serviceData) => {
  const id = generateId();
  const now = new Date();
  const service = {
    ...serviceData,
    createdAt: now,
    updatedAt: now,
  };

  await query(
    `INSERT INTO service_catalog (
      id,
      organization_id,
      slug,
      name,
      category,
      price,
      unit,
      badge,
      description,
      image,
      images,
      tags,
      is_active,
      metadata,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14::jsonb, $15, $16
    )`,
    [
      id,
      service.organizationId,
      service.slug,
      service.name,
      service.category,
      service.price,
      service.unit,
      service.badge,
      service.description,
      service.image,
      JSON.stringify(service.images || []),
      JSON.stringify(service.tags || []),
      service.isActive,
      JSON.stringify(service.metadata || {}),
      service.createdAt,
      service.updatedAt,
    ],
  );

  return {
    id,
    ...service,
  };
};

const updateService = async (serviceId, updates) => {
  const statement = buildUpdateStatement(
    {
      organizationId: updates.organizationId,
      slug: updates.slug,
      name: updates.name,
      category: updates.category,
      price: updates.price,
      unit: updates.unit,
      badge: updates.badge,
      description: updates.description,
      image: updates.image,
      images:
        updates.images !== undefined ? JSON.stringify(updates.images || []) : undefined,
      tags:
        updates.tags !== undefined ? JSON.stringify(updates.tags || []) : undefined,
      isActive: updates.isActive,
      metadata:
        updates.metadata !== undefined
          ? JSON.stringify(updates.metadata || {})
          : undefined,
      updatedAt: new Date(),
    },
    {
      organizationId: "organization_id",
      isActive: "is_active",
      images: { column: "images", cast: "jsonb" },
      tags: { column: "tags", cast: "jsonb" },
      metadata: { column: "metadata", cast: "jsonb" },
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findServiceById(serviceId);
  }

  await query(
    `UPDATE service_catalog SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, serviceId],
  );

  return findServiceById(serviceId);
};

const deleteService = async (serviceId) => {
  await query("DELETE FROM service_catalog WHERE id = $1", [serviceId]);
};

module.exports = {
  createService,
  deleteService,
  findServiceById,
  listServicesByOrganizationId,
  updateService,
};
