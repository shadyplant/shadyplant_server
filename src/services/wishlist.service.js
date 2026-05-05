const {
  clearWishlistByUserId,
  findWishlistByUserId,
  saveWishlistByUserId,
} = require("../repositories/wishlist.repository");
const { ApiError } = require("../utils/apiError");

const toTrimmedString = (value) => String(value || "").trim();

const parseOptionalPrice = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? Number(parsedValue.toFixed(2)) : null;
};

const normalizeMetadata = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizeItemIdentity = (payload = {}) => {
  const productId = toTrimmedString(
    payload.productId ||
      payload.product_id ||
      payload.itemId ||
      payload.item_id ||
      payload.id ||
      payload.sku,
  );

  if (!productId) {
    throw new ApiError(400, "Wishlist item product id is required.");
  }

  return productId;
};

const normalizeWishlistItem = (payload = {}, existingItem = null) => {
  const productId = normalizeItemIdentity(payload);
  const timestamp = new Date().toISOString();
  const unitPrice = parseOptionalPrice(
    payload.unitPrice ?? payload.unit_price ?? payload.price,
  );

  return {
    id: productId,
    productId,
    name: toTrimmedString(payload.name || payload.title || existingItem?.name),
    slug: toTrimmedString(payload.slug || existingItem?.slug),
    image: toTrimmedString(
      payload.image || payload.imageUrl || payload.thumbnail || existingItem?.image,
    ),
    category: toTrimmedString(payload.category || existingItem?.category),
    unitPrice: unitPrice ?? existingItem?.unitPrice ?? null,
    currency: toTrimmedString(payload.currency || existingItem?.currency || "INR"),
    metadata: {
      ...(existingItem?.metadata || {}),
      ...normalizeMetadata(payload.metadata),
    },
    addedAt: existingItem?.addedAt || payload.addedAt || timestamp,
    updatedAt: timestamp,
  };
};

const normalizeSyncWishlistItems = (items) => {
  if (!Array.isArray(items)) {
    throw new ApiError(400, "Wishlist sync requires an items array.");
  }

  return items.map((item) => normalizeWishlistItem(item));
};

const buildWishlistResponse = (state) => ({
  items: [...state.items].sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")),
  ),
  count: state.items.length,
  updatedAt: state.updatedAt,
});

const getUserWishlist = async (userId) =>
  buildWishlistResponse(await findWishlistByUserId(userId));

const addWishlistItem = async (userId, payload) => {
  const state = await findWishlistByUserId(userId);
  const productId = normalizeItemIdentity(payload);
  const existingIndex = state.items.findIndex((item) => item.productId === productId);

  if (existingIndex >= 0) {
    state.items[existingIndex] = normalizeWishlistItem(
      {
        ...payload,
        productId,
      },
      state.items[existingIndex],
    );
  } else {
    state.items.push(normalizeWishlistItem(payload));
  }

  return buildWishlistResponse(await saveWishlistByUserId(userId, state.items));
};

const syncUserWishlist = async (userId, payload = {}) => {
  const mode = toTrimmedString(payload.mode || "replace").toLowerCase();
  const incomingItems = normalizeSyncWishlistItems(payload.items);

  if (mode === "replace") {
    return buildWishlistResponse(await saveWishlistByUserId(userId, incomingItems));
  }

  if (mode !== "merge") {
    throw new ApiError(400, "Wishlist sync mode must be either replace or merge.");
  }

  const state = await findWishlistByUserId(userId);
  const mergedItems = [...state.items];

  for (const incomingItem of incomingItems) {
    const existingIndex = mergedItems.findIndex(
      (item) => item.productId === incomingItem.productId,
    );

    if (existingIndex >= 0) {
      mergedItems[existingIndex] = {
        ...mergedItems[existingIndex],
        ...incomingItem,
        addedAt: mergedItems[existingIndex].addedAt || incomingItem.addedAt,
        updatedAt: new Date().toISOString(),
      };
    } else {
      mergedItems.push(incomingItem);
    }
  }

  return buildWishlistResponse(await saveWishlistByUserId(userId, mergedItems));
};

const removeWishlistItem = async (userId, itemId) => {
  const state = await findWishlistByUserId(userId);
  const normalizedItemId = toTrimmedString(itemId);
  const nextItems = state.items.filter((item) => item.productId !== normalizedItemId);

  if (nextItems.length === state.items.length) {
    throw new ApiError(404, "Wishlist item not found.");
  }

  return buildWishlistResponse(await saveWishlistByUserId(userId, nextItems));
};

const clearUserWishlist = async (userId) => {
  await clearWishlistByUserId(userId);

  return {
    items: [],
    count: 0,
    updatedAt: null,
  };
};

module.exports = {
  addWishlistItem,
  clearUserWishlist,
  getUserWishlist,
  removeWishlistItem,
  syncUserWishlist,
};
