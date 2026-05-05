const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapHomeCategoryRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    itemKey: row.item_key,
    label: row.label,
    href: row.href,
    image: row.image,
    accentFrom: row.accent_from,
    accentVia: row.accent_via,
    accentTo: row.accent_to,
    showOfferBadge: Boolean(row.show_offer_badge),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const listHomeCategoryItemsByOrganizationId = async (
  organizationId,
  { activeOnly = false } = {},
) => {
  const values = [organizationId];
  const activeClause = activeOnly ? "AND is_active = TRUE" : "";
  const result = await query(
    `SELECT *
     FROM home_category_items
     WHERE organization_id = $1
     ${activeClause}
     ORDER BY sort_order ASC, created_at ASC`,
    values,
  );

  return result.rows.map(mapHomeCategoryRow).filter(Boolean);
};

const countHomeCategoryItemsByOrganizationId = async (organizationId) => {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM home_category_items
     WHERE organization_id = $1`,
    [organizationId],
  );

  return Number(result.rows[0]?.count || 0);
};

const findHomeCategoryItemById = async (itemId) => {
  const result = await query(
    "SELECT * FROM home_category_items WHERE id = $1 LIMIT 1",
    [itemId],
  );

  return mapHomeCategoryRow(result.rows[0]);
};

const findHomeCategoryItemByOrganizationAndKey = async (organizationId, itemKey) => {
  const result = await query(
    `SELECT *
     FROM home_category_items
     WHERE organization_id = $1 AND LOWER(item_key) = LOWER($2)
     LIMIT 1`,
    [organizationId, itemKey],
  );

  return mapHomeCategoryRow(result.rows[0]);
};

const createHomeCategoryItem = async ({
  organizationId,
  itemKey,
  label,
  href,
  image,
  accentFrom,
  accentVia,
  accentTo,
  showOfferBadge,
  isActive,
  sortOrder,
}) => {
  const id = generateId();
  const now = new Date();

  await query(
    `INSERT INTO home_category_items (
      id,
      organization_id,
      item_key,
      label,
      href,
      image,
      accent_from,
      accent_via,
      accent_to,
      show_offer_badge,
      is_active,
      sort_order,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )`,
    [
      id,
      organizationId,
      itemKey,
      label,
      href,
      image,
      accentFrom,
      accentVia,
      accentTo,
      showOfferBadge,
      isActive,
      sortOrder,
      now,
      now,
    ],
  );

  return {
    id,
    organizationId,
    itemKey,
    label,
    href,
    image,
    accentFrom,
    accentVia,
    accentTo,
    showOfferBadge,
    isActive,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
};

const updateHomeCategoryItem = async (itemId, updates) => {
  const statement = buildUpdateStatement(
    {
      organizationId: updates.organizationId,
      itemKey: updates.itemKey,
      label: updates.label,
      href: updates.href,
      image: updates.image,
      accentFrom: updates.accentFrom,
      accentVia: updates.accentVia,
      accentTo: updates.accentTo,
      showOfferBadge: updates.showOfferBadge,
      isActive: updates.isActive,
      sortOrder: updates.sortOrder,
      updatedAt: new Date(),
    },
    {
      organizationId: "organization_id",
      itemKey: "item_key",
      accentFrom: "accent_from",
      accentVia: "accent_via",
      accentTo: "accent_to",
      showOfferBadge: "show_offer_badge",
      isActive: "is_active",
      sortOrder: "sort_order",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findHomeCategoryItemById(itemId);
  }

  await query(
    `UPDATE home_category_items SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, itemId],
  );

  return findHomeCategoryItemById(itemId);
};

const deleteHomeCategoryItem = async (itemId) => {
  await query("DELETE FROM home_category_items WHERE id = $1", [itemId]);
};

module.exports = {
  countHomeCategoryItemsByOrganizationId,
  createHomeCategoryItem,
  deleteHomeCategoryItem,
  findHomeCategoryItemById,
  findHomeCategoryItemByOrganizationAndKey,
  listHomeCategoryItemsByOrganizationId,
  updateHomeCategoryItem,
};
