const { query } = require("../config/postgres");
const { generateId } = require("../utils/crypto");
const { buildUpdateStatement } = require("../utils/sql");

const mapHomeSliderBannerRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    itemKey: row.item_key,
    title: row.title,
    actionType: row.action_type || "link",
    href: row.href,
    popupKey: row.popup_key || "",
    desktopImage: row.desktop_image,
    mobileImage: row.mobile_image,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const listHomeSliderBannersByOrganizationId = async (
  organizationId,
  { activeOnly = false } = {},
) => {
  const values = [organizationId];
  const activeClause = activeOnly ? "AND is_active = TRUE" : "";
  const result = await query(
    `SELECT *
     FROM home_slider_banners
     WHERE organization_id = $1
     ${activeClause}
     ORDER BY sort_order ASC, created_at ASC`,
    values,
  );

  return result.rows.map(mapHomeSliderBannerRow).filter(Boolean);
};

const countHomeSliderBannersByOrganizationId = async (organizationId) => {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM home_slider_banners
     WHERE organization_id = $1`,
    [organizationId],
  );

  return Number(result.rows[0]?.count || 0);
};

const findHomeSliderBannerById = async (itemId) => {
  const result = await query(
    "SELECT * FROM home_slider_banners WHERE id = $1 LIMIT 1",
    [itemId],
  );

  return mapHomeSliderBannerRow(result.rows[0]);
};

const findHomeSliderBannerByOrganizationAndKey = async (
  organizationId,
  itemKey,
) => {
  const result = await query(
    `SELECT *
     FROM home_slider_banners
     WHERE organization_id = $1 AND LOWER(item_key) = LOWER($2)
     LIMIT 1`,
    [organizationId, itemKey],
  );

  return mapHomeSliderBannerRow(result.rows[0]);
};

const createHomeSliderBanner = async ({
  organizationId,
  itemKey,
  title,
  actionType,
  href,
  popupKey,
  desktopImage,
  mobileImage,
  isActive,
  sortOrder,
}) => {
  const id = generateId();
  const now = new Date();
  const normalizedActionType = actionType === "popup" ? "popup" : "link";

  await query(
    `INSERT INTO home_slider_banners (
      id,
      organization_id,
      item_key,
      title,
      action_type,
      href,
      popup_key,
      desktop_image,
      mobile_image,
      is_active,
      sort_order,
      created_at,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )`,
    [
      id,
      organizationId,
      itemKey,
      title,
      normalizedActionType,
      href || "",
      popupKey || "",
      desktopImage,
      mobileImage,
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
    title,
    actionType: normalizedActionType,
    href: href || "",
    popupKey: popupKey || "",
    desktopImage,
    mobileImage,
    isActive,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
};

const updateHomeSliderBanner = async (itemId, updates) => {
  const statement = buildUpdateStatement(
    {
      organizationId: updates.organizationId,
      itemKey: updates.itemKey,
      title: updates.title,
      actionType: updates.actionType,
      href: updates.href,
      popupKey: updates.popupKey,
      desktopImage: updates.desktopImage,
      mobileImage: updates.mobileImage,
      isActive: updates.isActive,
      sortOrder: updates.sortOrder,
      updatedAt: new Date(),
    },
    {
      organizationId: "organization_id",
      itemKey: "item_key",
      actionType: "action_type",
      desktopImage: "desktop_image",
      popupKey: "popup_key",
      mobileImage: "mobile_image",
      isActive: "is_active",
      sortOrder: "sort_order",
      updatedAt: "updated_at",
    },
  );

  if (!statement) {
    return findHomeSliderBannerById(itemId);
  }

  await query(
    `UPDATE home_slider_banners SET ${statement.setClause} WHERE id = $${
      statement.values.length + 1
    }`,
    [...statement.values, itemId],
  );

  return findHomeSliderBannerById(itemId);
};

const deleteHomeSliderBanner = async (itemId) => {
  await query("DELETE FROM home_slider_banners WHERE id = $1", [itemId]);
};

module.exports = {
  countHomeSliderBannersByOrganizationId,
  createHomeSliderBanner,
  deleteHomeSliderBanner,
  findHomeSliderBannerById,
  findHomeSliderBannerByOrganizationAndKey,
  listHomeSliderBannersByOrganizationId,
  updateHomeSliderBanner,
};
