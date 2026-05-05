const { HOME_CATEGORY_ITEM_SEED } = require("../data/home-category-items.seed");
const { env } = require("../config/env");
const {
  countHomeCategoryItemsByOrganizationId,
  createHomeCategoryItem,
  deleteHomeCategoryItem,
  findHomeCategoryItemById,
  findHomeCategoryItemByOrganizationAndKey,
  listHomeCategoryItemsByOrganizationId,
  updateHomeCategoryItem,
} = require("../repositories/home-category.repository");
const {
  findOrganizationById,
  findOrganizationBySlug,
} = require("../repositories/staff.repository");
const { ApiError } = require("../utils/apiError");

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const sanitizeHomeCategoryItem = (item) => ({
  id: item.id,
  organizationId: item.organizationId,
  itemKey: item.itemKey,
  label: item.label,
  href: item.href,
  image: item.image,
  accentFrom: item.accentFrom,
  accentVia: item.accentVia,
  accentTo: item.accentTo,
  showOfferBadge: Boolean(item.showOfferBadge),
  isActive: Boolean(item.isActive),
  sortOrder: Number(item.sortOrder || 0),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const normalizeHomeCategoryPayload = (payload = {}, { partial = false } = {}) => {
  const label =
    payload.label !== undefined ? String(payload.label || "").trim() : undefined;
  const itemKey =
    payload.itemKey !== undefined
      ? String(payload.itemKey || "").trim()
      : !partial && label
        ? slugifyValue(label)
        : undefined;
  const href =
    payload.href !== undefined ? String(payload.href || "").trim() : undefined;
  const image =
    payload.image !== undefined ? String(payload.image || "").trim() : undefined;
  const accentFrom =
    payload.accentFrom !== undefined
      ? String(payload.accentFrom || "").trim()
      : undefined;
  const accentVia =
    payload.accentVia !== undefined
      ? String(payload.accentVia || "").trim()
      : undefined;
  const accentTo =
    payload.accentTo !== undefined
      ? String(payload.accentTo || "").trim()
      : undefined;

  if (!partial) {
    if (!label) {
      throw new ApiError(400, "Category bar label is required.");
    }

    if (!itemKey) {
      throw new ApiError(400, "Category bar item key is required.");
    }

    if (!href) {
      throw new ApiError(400, "Category bar link is required.");
    }
  }

  return {
    itemKey,
    label,
    href,
    image,
    accentFrom,
    accentVia,
    accentTo,
    showOfferBadge:
      payload.showOfferBadge !== undefined ? Boolean(payload.showOfferBadge) : undefined,
    isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : undefined,
    sortOrder:
      payload.sortOrder !== undefined
        ? Math.max(0, Math.round(Number(payload.sortOrder || 0)))
        : undefined,
  };
};

const resolveDefaultOrganization = async () => {
  const defaultOrganizationSlug = String(
    env.staff.bootstrapOrganizationSlug || "grass-green-nursery",
  ).trim();

  if (!defaultOrganizationSlug) {
    return null;
  }

  return findOrganizationBySlug(defaultOrganizationSlug);
};

const listPublicHomeCategoryItems = async () => {
  const organization = await resolveDefaultOrganization();

  if (!organization) {
    return [];
  }

  return (await listHomeCategoryItemsByOrganizationId(organization.id, {
    activeOnly: true,
  })).map(sanitizeHomeCategoryItem);
};

const listAdminHomeCategoryItems = async (organizationId) =>
  (await listHomeCategoryItemsByOrganizationId(organizationId)).map(
    sanitizeHomeCategoryItem,
  );

const getAdminHomeCategoryItem = async (itemId, organizationId) => {
  const item = await findHomeCategoryItemById(itemId);

  if (!item || item.organizationId !== organizationId) {
    throw new ApiError(404, "Home category item not found.");
  }

  return sanitizeHomeCategoryItem(item);
};

const createAdminHomeCategoryItem = async (organizationId, payload = {}) => {
  const organization = await findOrganizationById(organizationId);

  if (!organization) {
    throw new ApiError(404, "Organization not found.");
  }

  const normalizedPayload = normalizeHomeCategoryPayload(payload);
  const existingItem = await findHomeCategoryItemByOrganizationAndKey(
    organizationId,
    normalizedPayload.itemKey,
  );

  if (existingItem) {
    throw new ApiError(409, "A category bar item with this key already exists.");
  }

  const item = await createHomeCategoryItem({
    organizationId,
    itemKey: normalizedPayload.itemKey,
    label: normalizedPayload.label,
    href: normalizedPayload.href,
    image: normalizedPayload.image || "",
    accentFrom: normalizedPayload.accentFrom || "#d8c38f",
    accentVia: normalizedPayload.accentVia || "#f0d9a6",
    accentTo: normalizedPayload.accentTo || "#fbf3cf",
    showOfferBadge: Boolean(normalizedPayload.showOfferBadge),
    isActive:
      normalizedPayload.isActive === undefined ? true : normalizedPayload.isActive,
    sortOrder: normalizedPayload.sortOrder === undefined ? 100 : normalizedPayload.sortOrder,
  });

  return sanitizeHomeCategoryItem(item);
};

const updateAdminHomeCategoryItem = async (itemId, organizationId, payload = {}) => {
  const currentItem = await findHomeCategoryItemById(itemId);

  if (!currentItem || currentItem.organizationId !== organizationId) {
    throw new ApiError(404, "Home category item not found.");
  }

  const normalizedPayload = normalizeHomeCategoryPayload(payload, { partial: true });

  if (
    normalizedPayload.itemKey &&
    normalizedPayload.itemKey.toLowerCase() !== currentItem.itemKey.toLowerCase()
  ) {
    const existingItem = await findHomeCategoryItemByOrganizationAndKey(
      organizationId,
      normalizedPayload.itemKey,
    );

    if (existingItem && existingItem.id !== currentItem.id) {
      throw new ApiError(409, "A category bar item with this key already exists.");
    }
  }

  const updatedItem = await updateHomeCategoryItem(itemId, normalizedPayload);
  return sanitizeHomeCategoryItem(updatedItem);
};

const deleteAdminHomeCategoryItem = async (itemId, organizationId) => {
  const item = await findHomeCategoryItemById(itemId);

  if (!item || item.organizationId !== organizationId) {
    throw new ApiError(404, "Home category item not found.");
  }

  await deleteHomeCategoryItem(itemId);
  return sanitizeHomeCategoryItem(item);
};

const seedHomeCategoryItems = async () => {
  const organization = await resolveDefaultOrganization();

  if (!organization) {
    return;
  }

  return seedHomeCategoryItemsForOrganization(organization.id, organization.slug);
};

const seedHomeCategoryItemsForOrganization = async (
  organizationId,
  organizationSlug = "organization",
) => {
  if ((await countHomeCategoryItemsByOrganizationId(organizationId)) > 0) {
    return;
  }

  for (const item of HOME_CATEGORY_ITEM_SEED) {
    await createHomeCategoryItem({
      organizationId,
      ...item,
    });
  }

  console.log(
    `Seeded ${HOME_CATEGORY_ITEM_SEED.length} home category items for ${organizationSlug}.`,
  );
};

module.exports = {
  createAdminHomeCategoryItem,
  deleteAdminHomeCategoryItem,
  getAdminHomeCategoryItem,
  listAdminHomeCategoryItems,
  listPublicHomeCategoryItems,
  seedHomeCategoryItems,
  seedHomeCategoryItemsForOrganization,
  updateAdminHomeCategoryItem,
};
