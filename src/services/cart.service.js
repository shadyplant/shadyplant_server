const {
  clearCartByUserId,
  findCartByUserId,
  saveCartByUserId,
} = require("../repositories/cart.repository");
const {
  findProductById,
  findProductsByIds,
  normalizeProductOptionSelections,
  resolveProductVariant,
} = require("../repositories/product.repository");
const { ApiError } = require("../utils/apiError");

const DEFAULT_CART_VARIANT_KEY = "default";

const toTrimmedString = (value) => String(value || "").trim();

const parseQuantity = (value, fallback = NaN) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const parseOptionalPrice = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? Number(parsedValue.toFixed(2)) : null;
};

const normalizeMetadata = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizeVariantId = (value) => toTrimmedString(value);

const buildCartLineId = (productId, variantId = "") =>
  `${productId}::${variantId || DEFAULT_CART_VARIANT_KEY}`;

const parseCartLineId = (itemId) => {
  const [productId, ...variantParts] = toTrimmedString(itemId).split("::");

  return {
    productId: toTrimmedString(productId),
    variantId: toTrimmedString(
      variantParts.join("::") === DEFAULT_CART_VARIANT_KEY
        ? ""
        : variantParts.join("::"),
    ),
  };
};

const getAvailableStock = (product) =>
  Math.max(0, Math.floor(Number(product?.stock || 0)));

const getResolvedVariantStock = (variant) =>
  Math.max(0, Math.floor(Number(variant?.stock || 0)));

const getConfiguredMinOrderQuantity = (product) =>
  Math.max(1, Math.floor(Number(product?.minOrderQuantity || 1)));

const getEffectiveMinOrderQuantity = (product, variant) => {
  const configuredMinimum = getConfiguredMinOrderQuantity(product);
  const availableStock = getAvailableStock(product);
  const variantStock = getResolvedVariantStock(variant);
  const maxPurchasableQuantity =
    variant && variant.variantId
      ? Math.min(availableStock, variantStock)
      : availableStock;

  if (maxPurchasableQuantity > 0) {
    return Math.max(1, Math.min(configuredMinimum, maxPurchasableQuantity));
  }

  return configuredMinimum;
};

const buildMinOrderQuantityErrorMessage = (product, minimumQuantity) => {
  const productName = String(product?.name || "This product").trim();
  return `Minimum order quantity for ${productName} is ${minimumQuantity} unit(s).`;
};

const buildStockErrorMessage = (product, requestedQuantity) => {
  const productName = String(product?.name || "This product").trim();
  const availableStock = getAvailableStock(product);

  if (availableStock <= 0) {
    return `${productName} is out of stock right now.`;
  }

  return `Only ${availableStock} unit(s) of ${productName} are available right now.`;
};

const buildVariantStockErrorMessage = (product, variant, requestedQuantity) => {
  if (!variant?.displayLabel) {
    return buildStockErrorMessage(product, requestedQuantity);
  }

  const productName = String(product?.name || "This product").trim();
  const availableStock = getResolvedVariantStock(variant);

  if (availableStock <= 0) {
    return `${productName} (${variant.displayLabel}) is out of stock right now.`;
  }

  return `Only ${availableStock} unit(s) of ${productName} (${variant.displayLabel}) are available right now.`;
};

const resolveCartPayloadIdentity = (payload = {}) => {
  const productId = toTrimmedString(
    payload.productId ||
      payload.product_id ||
      payload.itemId ||
      payload.item_id ||
      payload.id ||
      payload.sku,
  );

  if (!productId) {
    throw new ApiError(400, "Cart item product id is required.");
  }

  return {
    productId,
    variantId: normalizeVariantId(payload.variantId || payload.variant_id),
    optionSelections: normalizeProductOptionSelections(payload.optionSelections),
  };
};

const assertProductStockForQuantity = async ({
  productId,
  variantId = "",
  optionSelections = [],
  quantity,
  skipMinimumQuantityCheck = false,
}) => {
  const product = await findProductById(productId);

  if (!product) {
    throw new ApiError(404, "Product not found.");
  }

  const resolvedVariant = resolveProductVariant(product, {
    variantId,
    optionSelections,
  });
  const minimumOrderQuantity = getEffectiveMinOrderQuantity(
    product,
    resolvedVariant,
  );

  if (!skipMinimumQuantityCheck && quantity < minimumOrderQuantity) {
    throw new ApiError(
      400,
      buildMinOrderQuantityErrorMessage(product, minimumOrderQuantity),
    );
  }

  if (quantity > getAvailableStock(product)) {
    throw new ApiError(409, buildStockErrorMessage(product, quantity));
  }

  if (quantity > getResolvedVariantStock(resolvedVariant)) {
    throw new ApiError(
      409,
      buildVariantStockErrorMessage(product, resolvedVariant, quantity),
    );
  }

  return {
    product,
    resolvedVariant,
  };
};

const assertCartItemsWithinStock = async (items = []) => {
  const normalizedItems = items.map((item) => ({
    productId: toTrimmedString(item.productId || item.id),
    variantId: normalizeVariantId(item.variantId),
    optionSelections: normalizeProductOptionSelections(
      item.optionSelections || item.metadata?.optionSelections,
    ),
    quantity: parseQuantity(item.quantity ?? item.qty, NaN),
  }));
  const productIds = normalizedItems.map((item) => item.productId).filter(Boolean);
  const products = await findProductsByIds(productIds);
  const productsById = new Map(products.map((product) => [product.id, product]));

  for (const item of normalizedItems) {
    const product = productsById.get(item.productId);

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new ApiError(400, "Every cart item quantity must be greater than zero.");
    }

    const resolvedVariant = resolveProductVariant(product, {
      variantId: item.variantId,
      optionSelections: item.optionSelections,
    });
    const minimumOrderQuantity = getEffectiveMinOrderQuantity(
      product,
      resolvedVariant,
    );

    if (item.quantity < minimumOrderQuantity) {
      throw new ApiError(
        400,
        buildMinOrderQuantityErrorMessage(product, minimumOrderQuantity),
      );
    }

    if (item.quantity > getAvailableStock(product)) {
      throw new ApiError(409, buildStockErrorMessage(product, item.quantity));
    }

    if (item.quantity > getResolvedVariantStock(resolvedVariant)) {
      throw new ApiError(
        409,
        buildVariantStockErrorMessage(product, resolvedVariant, item.quantity),
      );
    }
  }
};

const normalizeCartItemSnapshot = (payload = {}, existingItem = null) => {
  const productId = toTrimmedString(payload.productId || existingItem?.productId);
  const variantId = normalizeVariantId(
    payload.variantId || payload.variant_id || existingItem?.variantId,
  );
  const unitPrice = parseOptionalPrice(
    payload.unitPrice ?? payload.unit_price ?? payload.price,
  );
  const unitMrp = parseOptionalPrice(
    payload.unitMrp ?? payload.unit_mrp ?? payload.mrp,
  );
  const optionSelections = normalizeProductOptionSelections(
    payload.optionSelections ||
      existingItem?.optionSelections ||
      existingItem?.metadata?.optionSelections,
  );

  return {
    id: buildCartLineId(productId, variantId),
    productId,
    variantId,
    variantLabel: toTrimmedString(
      payload.variantLabel || payload.variant_label || existingItem?.variantLabel,
    ),
    packLabel: toTrimmedString(
      payload.packLabel || payload.pack_label || existingItem?.packLabel,
    ),
    optionSelections,
    name: toTrimmedString(payload.name || payload.title || existingItem?.name),
    slug: toTrimmedString(payload.slug || existingItem?.slug),
    image: toTrimmedString(
      payload.image || payload.imageUrl || payload.thumbnail || existingItem?.image,
    ),
    category: toTrimmedString(payload.category || existingItem?.category),
    unitPrice: unitPrice ?? existingItem?.unitPrice ?? null,
    unitMrp: unitMrp ?? existingItem?.unitMrp ?? null,
    currency: toTrimmedString(payload.currency || existingItem?.currency || "INR"),
    metadata: {
      ...(existingItem?.metadata || {}),
      ...normalizeMetadata(payload.metadata),
      optionSelections,
    },
  };
};

const normalizeSyncCartItems = (items) => {
  if (!Array.isArray(items)) {
    throw new ApiError(400, "Cart sync requires an items array.");
  }

  return items.map((item) => {
    const quantity = parseQuantity(item.quantity ?? item.qty, NaN);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, "Every cart item quantity must be greater than zero.");
    }

    const snapshot = normalizeCartItemSnapshot(item);
    const timestamp = new Date().toISOString();

    return {
      ...snapshot,
      quantity,
      addedAt: item.addedAt || timestamp,
      updatedAt: timestamp,
    };
  });
};

const buildCartResponse = (state) => {
  const items = [...state.items].sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")),
  );
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0)),
    0,
  );

  return {
    items,
    summary: {
      itemCount: items.length,
      totalQuantity,
      subtotal: Number(subtotal.toFixed(2)),
      currency: items.find((item) => item.currency)?.currency || "INR",
    },
    updatedAt: state.updatedAt,
  };
};

const getUserCart = async (userId) => buildCartResponse(await findCartByUserId(userId));

const addCartItem = async (userId, payload) => {
  const state = await findCartByUserId(userId);
  const identity = resolveCartPayloadIdentity(payload);
  const quantityToAdd = parseQuantity(payload.quantity ?? payload.qty, 1);

  if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) {
    throw new ApiError(400, "Cart item quantity must be greater than zero.");
  }

  const { product, resolvedVariant } = await assertProductStockForQuantity({
    ...identity,
    quantity: quantityToAdd,
    skipMinimumQuantityCheck: true,
  });
  const variantId = resolvedVariant.variantId;
  const cartLineId = buildCartLineId(identity.productId, variantId);
  const existingIndex = state.items.findIndex((item) => item.id === cartLineId);
  const timestamp = new Date().toISOString();
  const nextQuantity =
    existingIndex >= 0
      ? Number(state.items[existingIndex].quantity || 0) + quantityToAdd
      : quantityToAdd;

  await assertProductStockForQuantity({
    productId: identity.productId,
    variantId,
    optionSelections: resolvedVariant.optionSelections,
    quantity: nextQuantity,
  });

  const nextSnapshotPayload = {
    ...payload,
    productId: identity.productId,
    variantId,
    optionSelections: resolvedVariant.optionSelections,
    variantLabel: resolvedVariant.displayLabel,
    packLabel: resolvedVariant.packLabel,
    price: resolvedVariant.price,
    mrp: resolvedVariant.mrp,
    name: product.name,
    image: product.image,
    category: product.category,
  };

  if (existingIndex >= 0) {
    const existingItem = state.items[existingIndex];

    state.items[existingIndex] = {
      ...existingItem,
      ...normalizeCartItemSnapshot(nextSnapshotPayload, existingItem),
      quantity: existingItem.quantity + quantityToAdd,
      updatedAt: timestamp,
    };
  } else {
    state.items.push({
      ...normalizeCartItemSnapshot(nextSnapshotPayload),
      quantity: quantityToAdd,
      addedAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return buildCartResponse(await saveCartByUserId(userId, state.items));
};

const replaceCartItem = async (userId, itemId, payload) => {
  const state = await findCartByUserId(userId);
  const normalizedItemId = toTrimmedString(itemId);
  const existingIndex = state.items.findIndex((item) => item.id === normalizedItemId);

  if (existingIndex < 0) {
    throw new ApiError(404, "Cart item not found.");
  }

  const quantity = parseQuantity(payload.quantity ?? payload.qty, NaN);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, "Cart item quantity must be greater than zero.");
  }

  const existingItem = state.items[existingIndex];
  const { product, resolvedVariant } = await assertProductStockForQuantity({
    productId: existingItem.productId,
    variantId: existingItem.variantId,
    optionSelections: existingItem.optionSelections,
    quantity,
  });

  state.items[existingIndex] = {
    ...existingItem,
    ...normalizeCartItemSnapshot(
      {
        ...payload,
        productId: existingItem.productId,
        variantId: existingItem.variantId,
        optionSelections: resolvedVariant.optionSelections,
        variantLabel: resolvedVariant.displayLabel,
        packLabel: resolvedVariant.packLabel,
        price: resolvedVariant.price,
        mrp: resolvedVariant.mrp,
        name: product.name,
        image: product.image,
        category: product.category,
      },
      existingItem,
    ),
    quantity,
    updatedAt: new Date().toISOString(),
  };

  return buildCartResponse(await saveCartByUserId(userId, state.items));
};

const updateCartItemQuantity = async (userId, itemId, payload) => {
  const quantity = parseQuantity(payload.quantity ?? payload.qty, NaN);
  const normalizedItemId = toTrimmedString(itemId);

  if (!Number.isFinite(quantity)) {
    throw new ApiError(400, "Cart item quantity is required.");
  }

  if (quantity <= 0) {
    return removeCartItem(userId, normalizedItemId);
  }

  return replaceCartItem(userId, normalizedItemId, { quantity });
};

const syncUserCart = async (userId, payload = {}) => {
  const mode = toTrimmedString(payload.mode || "replace").toLowerCase();
  const incomingItems = normalizeSyncCartItems(payload.items);

  if (mode === "replace") {
    await assertCartItemsWithinStock(incomingItems);
    return buildCartResponse(await saveCartByUserId(userId, incomingItems));
  }

  if (mode !== "merge") {
    throw new ApiError(400, "Cart sync mode must be either replace or merge.");
  }

  const state = await findCartByUserId(userId);
  const mergedItems = [...state.items];

  for (const incomingItem of incomingItems) {
    const existingIndex = mergedItems.findIndex((item) => item.id === incomingItem.id);

    if (existingIndex >= 0) {
      const existingItem = mergedItems[existingIndex];
      mergedItems[existingIndex] = {
        ...existingItem,
        ...incomingItem,
        quantity: incomingItem.quantity,
        addedAt: existingItem.addedAt || incomingItem.addedAt,
        updatedAt: new Date().toISOString(),
      };
    } else {
      mergedItems.push(incomingItem);
    }
  }

  await assertCartItemsWithinStock(mergedItems);

  return buildCartResponse(await saveCartByUserId(userId, mergedItems));
};

const removeCartItem = async (userId, itemId) => {
  const state = await findCartByUserId(userId);
  const normalizedItemId = toTrimmedString(itemId);
  const nextItems = state.items.filter((item) => item.id !== normalizedItemId);

  if (nextItems.length === state.items.length) {
    throw new ApiError(404, "Cart item not found.");
  }

  return buildCartResponse(await saveCartByUserId(userId, nextItems));
};

const clearUserCart = async (userId) => {
  await clearCartByUserId(userId);

  return {
    items: [],
    summary: {
      itemCount: 0,
      totalQuantity: 0,
      subtotal: 0,
      currency: "INR",
    },
    updatedAt: null,
  };
};

const consumeUserCartItems = async (userId, purchasedItems = []) => {
  if (!Array.isArray(purchasedItems) || !purchasedItems.length) {
    return getUserCart(userId);
  }

  const state = await findCartByUserId(userId);
  const remainingItems = [...state.items];

  for (const purchasedItem of purchasedItems) {
    const { productId, variantId } = parseCartLineId(
      buildCartLineId(
        purchasedItem.productId || purchasedItem.id,
        purchasedItem.variantId,
      ),
    );
    const purchasedQuantity = parseQuantity(
      purchasedItem.quantity ?? purchasedItem.qty,
      0,
    );

    if (!productId || !Number.isFinite(purchasedQuantity) || purchasedQuantity <= 0) {
      continue;
    }

    const existingIndex = remainingItems.findIndex(
      (item) => item.id === buildCartLineId(productId, variantId),
    );

    if (existingIndex < 0) {
      continue;
    }

    const existingItem = remainingItems[existingIndex];
    const nextQuantity = Number(existingItem.quantity || 0) - purchasedQuantity;

    if (nextQuantity > 0) {
      remainingItems[existingIndex] = {
        ...existingItem,
        quantity: nextQuantity,
        updatedAt: new Date().toISOString(),
      };
    } else {
      remainingItems.splice(existingIndex, 1);
    }
  }

  return buildCartResponse(await saveCartByUserId(userId, remainingItems));
};

module.exports = {
  addCartItem,
  buildCartLineId,
  clearUserCart,
  consumeUserCartItems,
  getUserCart,
  removeCartItem,
  replaceCartItem,
  syncUserCart,
  updateCartItemQuantity,
};
