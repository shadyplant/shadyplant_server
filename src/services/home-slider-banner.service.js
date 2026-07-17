const { HOME_SLIDER_BANNER_SEED } = require("../data/home-slider-banners.seed");
const { env } = require("../config/env");
const {
  countHomeSliderBannersByOrganizationId,
  createHomeSliderBanner,
  deleteHomeSliderBanner,
  findHomeSliderBannerById,
  findHomeSliderBannerByOrganizationAndKey,
  listHomeSliderBannersByOrganizationId,
  updateHomeSliderBanner,
} = require("../repositories/home-slider-banner.repository");
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

const sanitizeHomeSliderBanner = (item) => ({
  id: item.id,
  organizationId: item.organizationId,
  itemKey: item.itemKey,
  title: item.title,
  actionType: item.actionType || "link",
  href: item.href,
  popupKey: item.popupKey || "",
  desktopImage: item.desktopImage,
  mobileImage: item.mobileImage,
  isActive: Boolean(item.isActive),
  sortOrder: Number(item.sortOrder || 0),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const normalizeHomeSliderBannerPayload = (payload = {}, { partial = false } = {}) => {
  const title =
    payload.title !== undefined ? String(payload.title || "").trim() : undefined;
  const rawItemKey =
    payload.itemKey !== undefined ? String(payload.itemKey || "").trim() : undefined;
  const itemKey =
    rawItemKey || (!partial && title
        ? slugifyValue(title)
        : undefined);
  const href =
    payload.href !== undefined ? String(payload.href || "").trim() : undefined;
  const actionTypeRaw =
    payload.actionType !== undefined
      ? String(payload.actionType || "").trim().toLowerCase()
      : undefined;
  const actionType =
    actionTypeRaw === "popup"
      ? "popup"
      : actionTypeRaw === "link"
        ? "link"
        : undefined;
  const popupKey =
    payload.popupKey !== undefined ? String(payload.popupKey || "").trim() : undefined;
  const desktopImage =
    payload.desktopImage !== undefined
      ? String(payload.desktopImage || "").trim()
      : undefined;
  const mobileImage =
    payload.mobileImage !== undefined
      ? String(payload.mobileImage || "").trim()
      : undefined;

  if (!partial) {
    if (!title) {
      throw new ApiError(400, "Home slider banner title is required.");
    }

    if (!itemKey) {
      throw new ApiError(400, "Home slider banner key is required.");
    }

    if (!desktopImage) {
      throw new ApiError(400, "Desktop banner image is required.");
    }

    if (!mobileImage) {
      throw new ApiError(400, "Mobile banner image is required.");
    }
  }

  return {
    itemKey,
    title,
    actionType,
    href,
    popupKey,
    desktopImage,
    mobileImage,
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

const listPublicHomeSliderBanners = async () => {
  const organization = await resolveDefaultOrganization();

  if (!organization) {
    return [];
  }

  return (await listHomeSliderBannersByOrganizationId(organization.id, {
    activeOnly: true,
  })).map(sanitizeHomeSliderBanner);
};

const listAdminHomeSliderBanners = async (organizationId) =>
  (await listHomeSliderBannersByOrganizationId(organizationId)).map(
    sanitizeHomeSliderBanner,
  );

const getAdminHomeSliderBanner = async (itemId, organizationId) => {
  const item = await findHomeSliderBannerById(itemId);

  if (!item || item.organizationId !== organizationId) {
    throw new ApiError(404, "Home slider banner not found.");
  }

  return sanitizeHomeSliderBanner(item);
};

const createAdminHomeSliderBanner = async (organizationId, payload = {}) => {
  const organization = await findOrganizationById(organizationId);

  if (!organization) {
    throw new ApiError(404, "Organization not found.");
  }

  const normalizedPayload = normalizeHomeSliderBannerPayload(payload);
  const existingItem = await findHomeSliderBannerByOrganizationAndKey(
    organizationId,
    normalizedPayload.itemKey,
  );

  if (existingItem) {
    throw new ApiError(409, "A home slider banner with this key already exists.");
  }

  const item = await createHomeSliderBanner({
    organizationId,
    itemKey: normalizedPayload.itemKey,
    title: normalizedPayload.title,
    actionType: normalizedPayload.actionType || "link",
    href: normalizedPayload.href || "",
    popupKey: normalizedPayload.popupKey || "",
    desktopImage: normalizedPayload.desktopImage,
    mobileImage: normalizedPayload.mobileImage,
    isActive:
      normalizedPayload.isActive === undefined ? true : normalizedPayload.isActive,
    sortOrder: normalizedPayload.sortOrder === undefined ? 100 : normalizedPayload.sortOrder,
  });

  return sanitizeHomeSliderBanner(item);
};

const updateAdminHomeSliderBanner = async (itemId, organizationId, payload = {}) => {
  const currentItem = await findHomeSliderBannerById(itemId);

  if (!currentItem || currentItem.organizationId !== organizationId) {
    throw new ApiError(404, "Home slider banner not found.");
  }

  const normalizedPayload = normalizeHomeSliderBannerPayload(payload, { partial: true });

  if (
    normalizedPayload.itemKey &&
    normalizedPayload.itemKey.toLowerCase() !== currentItem.itemKey.toLowerCase()
  ) {
    const existingItem = await findHomeSliderBannerByOrganizationAndKey(
      organizationId,
      normalizedPayload.itemKey,
    );

    if (existingItem && existingItem.id !== currentItem.id) {
      throw new ApiError(409, "A home slider banner with this key already exists.");
    }
  }

  const updatedItem = await updateHomeSliderBanner(itemId, normalizedPayload);
  return sanitizeHomeSliderBanner(updatedItem);
};

const deleteAdminHomeSliderBanner = async (itemId, organizationId) => {
  const item = await findHomeSliderBannerById(itemId);

  if (!item || item.organizationId !== organizationId) {
    throw new ApiError(404, "Home slider banner not found.");
  }

  await deleteHomeSliderBanner(itemId);
  return sanitizeHomeSliderBanner(item);
};

const seedHomeSliderBanners = async () => {
  const organization = await resolveDefaultOrganization();

  if (!organization) {
    return;
  }

  return seedHomeSliderBannersForOrganization(organization.id, organization.slug);
};

const seedHomeSliderBannersForOrganization = async (
  organizationId,
  organizationSlug = "organization",
) => {
  if ((await countHomeSliderBannersByOrganizationId(organizationId)) > 0) {
    return;
  }

  for (const item of HOME_SLIDER_BANNER_SEED) {
    await createHomeSliderBanner({
      organizationId,
      ...item,
    });
  }

  console.log(
    `Seeded ${HOME_SLIDER_BANNER_SEED.length} home slider banners for ${organizationSlug}.`,
  );
};

module.exports = {
  createAdminHomeSliderBanner,
  deleteAdminHomeSliderBanner,
  getAdminHomeSliderBanner,
  listAdminHomeSliderBanners,
  listPublicHomeSliderBanners,
  seedHomeSliderBanners,
  seedHomeSliderBannersForOrganization,
  updateAdminHomeSliderBanner,
};
