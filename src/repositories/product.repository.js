const { Product } = require("../models/product.model");

const PRODUCT_ID_PATTERN = /^PRD\d{9,}$/;
const DEFAULT_BACKFILL_STOCK = 10;

const hashStringToProductDigits = (value) => {
  const source = String(value || "").trim() || "product";
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) % 1000000000;
  }

  return String(hash || 1).padStart(9, "0");
};

const buildProductIdentifier = (product = {}) => {
  const existingProductId = String(product.productId || "").trim();

  if (PRODUCT_ID_PATTERN.test(existingProductId)) {
    return existingProductId;
  }

  const source = String(product.id || product._id || "").trim();
  return `PRD${hashStringToProductDigits(source)}`;
};

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeNonNegativeInteger = (value, fallback = 0) => {
  const parsedValue = Math.floor(Number(value));
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallback;
};

const normalizePositiveInteger = (value, fallback = 1) => {
  const parsedValue = Math.floor(Number(value));
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const normalizeOptionalNumber = (value) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
};

const normalizeOptionalInteger = (value) => {
  const parsedValue = Math.floor(Number(value));
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
};

const formatMeasurementValue = (value) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

const normalizeDisplayUnit = (value) => {
  const normalizedValue = String(value || "").trim();
  const collapsedValue = normalizedValue.toLowerCase().replace(/\s+/g, " ");

  if (!collapsedValue) {
    return "";
  }

  if (["sqft", "sq ft", "sq. ft.", "square feet", "square foot"].includes(collapsedValue)) {
    return "sq ft";
  }

  if (["feet", "foot"].includes(collapsedValue)) {
    return "ft";
  }

  if (["in", "inch", "inches"].includes(collapsedValue)) {
    return "inch";
  }

  if (["cm", "centimeter", "centimeters", "centimetre", "centimetres"].includes(collapsedValue)) {
    return "cm";
  }

  if (["gal", "gallon", "gallons"].includes(collapsedValue)) {
    return "gallon";
  }

  return normalizedValue;
};

const buildOptionLabel = (option = {}) => {
  const explicitLabel = String(option.label || "").trim();

  if (explicitLabel) {
    return explicitLabel;
  }

  const normalizedValue = normalizeOptionalNumber(option.value);
  const normalizedUnit = normalizeDisplayUnit(option.unit);

  if (normalizedValue !== null && normalizedUnit) {
    return `${formatMeasurementValue(normalizedValue)} ${normalizedUnit}`;
  }

  if (normalizedValue !== null) {
    return formatMeasurementValue(normalizedValue);
  }

  return "";
};

const normalizeProductOption = (option = {}, index = 0) => {
  const normalizedValue = normalizeOptionalNumber(option.value);
  const normalizedUnit = normalizeDisplayUnit(option.unit);
  const normalizedPrice = normalizeOptionalNumber(option.price);
  const normalizedStock = normalizeOptionalInteger(option.stock);
  const normalizedWeight = normalizeOptionalNumber(option.weight);
  const normalizedPackLabel = String(option.packLabel || "").trim();
  const normalizedLabel = buildOptionLabel({
    ...option,
    value: normalizedValue,
    unit: normalizedUnit,
  });
  const fallbackKeySource =
    normalizedLabel ||
    String(option.key || option.id || option.value || `option-${index + 1}`).trim();

  return {
    key: slugifyValue(fallbackKeySource) || `option-${index + 1}`,
    label: normalizedLabel,
    unit: normalizedUnit,
    value: normalizedValue,
    note: String(option.note || "").trim(),
    price: normalizedPrice,
    stock: normalizedStock,
    packLabel: normalizedPackLabel,
    weight: normalizedWeight,
    isDefault: Boolean(option.isDefault ?? option.selected),
    isDisabled:
      Boolean(option.isDisabled ?? option.disabled) ||
      normalizedStock === 0,
  };
};

const normalizeProductOptionGroup = (group = {}, index = 0) => {
  const title = String(group.title || "").trim();
  const normalizedOptions = Array.isArray(group.options)
    ? group.options
        .map((option, optionIndex) => normalizeProductOption(option, optionIndex))
        .filter((option) => option.label || option.key)
    : [];

  if (!title || !normalizedOptions.length) {
    return null;
  }

  const normalizedGroup = {
    key:
      slugifyValue(String(group.key || "").trim() || title) ||
      `group-${index + 1}`,
    title,
    subtitle: String(group.subtitle || "").trim(),
    guideLabel: String(group.guideLabel || "").trim(),
    options: normalizedOptions.map((option) => ({ ...option, isDefault: false })),
  };
  const defaultOptionIndex = normalizedOptions.findIndex(
    (option) => option.isDefault && !option.isDisabled,
  );
  const fallbackOptionIndex = normalizedOptions.findIndex(
    (option) => !option.isDisabled,
  );
  const selectedOptionIndex =
    defaultOptionIndex >= 0
      ? defaultOptionIndex
      : fallbackOptionIndex >= 0
        ? fallbackOptionIndex
        : 0;

  if (normalizedGroup.options[selectedOptionIndex]) {
    normalizedGroup.options[selectedOptionIndex].isDefault = true;
  }

  return normalizedGroup;
};

const normalizeProductOptionGroups = (product = {}) =>
  Array.isArray(product.optionGroups)
    ? product.optionGroups
        .map((group, index) => normalizeProductOptionGroup(group, index))
        .filter(Boolean)
    : [];

const normalizeProductOptionSelections = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Map(
    value
      .map((selection) => {
        if (!selection || typeof selection !== "object") {
          return null;
        }

        const groupKey = slugifyValue(selection.groupKey || selection.group || selection.title);
        const optionKey = slugifyValue(selection.optionKey || selection.option || selection.key);

        if (!groupKey || !optionKey) {
          return null;
        }

        return [
          groupKey,
          {
            groupKey,
            optionKey,
          },
        ];
      })
      .filter(Boolean),
  ).values()];
};

const buildProductVariantId = (selections = []) =>
  normalizeProductOptionSelections(selections)
    .map((selection) => `${selection.groupKey}~${selection.optionKey}`)
    .join("|");

const parseProductVariantId = (variantId) =>
  String(variantId || "")
    .split("|")
    .map((entry) => {
      const [groupKey, optionKey] = String(entry || "").split("~");

      if (!groupKey || !optionKey) {
        return null;
      }

      return {
        groupKey: slugifyValue(groupKey),
        optionKey: slugifyValue(optionKey),
      };
    })
    .filter(Boolean);

const getDefaultProductOptionSelections = (product = {}) =>
  normalizeProductOptionGroups(product).flatMap((group) => {
    const defaultOption =
      group.options.find((option) => option.isDefault && !option.isDisabled) ||
      group.options.find((option) => !option.isDisabled) ||
      null;

    return defaultOption
      ? [
          {
            groupKey: group.key,
            optionKey: defaultOption.key,
          },
        ]
      : [];
  });

const resolveProductVariant = (product = {}, payload = {}) => {
  const optionGroups = normalizeProductOptionGroups(product);

  if (!optionGroups.length) {
    return {
      variantId: "",
      optionSelections: [],
      selectedOptions: [],
      displayLabel: "",
      price: Number(product.price || 0),
      stock: normalizeNonNegativeInteger(product.stock, 0),
      packLabel: String(product.packLabel || "").trim(),
      weight: Number(product.weight || 0),
    };
  }

  const requestedSelections = normalizeProductOptionSelections(
    payload.optionSelections,
  );
  const parsedVariantSelections =
    requestedSelections.length > 0
      ? requestedSelections
      : parseProductVariantId(payload.variantId);
  const selectionMap = new Map(
    (parsedVariantSelections.length
      ? parsedVariantSelections
      : getDefaultProductOptionSelections(product)
    ).map((selection) => [selection.groupKey, selection.optionKey]),
  );
  const selectedOptions = optionGroups.flatMap((group) => {
    const requestedOptionKey = selectionMap.get(group.key);
    const selectedOption =
      group.options.find(
        (option) => option.key === requestedOptionKey && !option.isDisabled,
      ) ||
      group.options.find((option) => option.isDefault && !option.isDisabled) ||
      group.options.find((option) => !option.isDisabled) ||
      null;

    return selectedOption
      ? [
          {
            groupKey: group.key,
            groupTitle: group.title,
            optionKey: selectedOption.key,
            label: selectedOption.label,
            unit: selectedOption.unit,
            value: selectedOption.value,
            note: selectedOption.note,
            price: selectedOption.price,
            stock: selectedOption.stock,
            packLabel: selectedOption.packLabel,
            weight: selectedOption.weight,
          },
        ]
      : [];
  });
  const resolvedSelections = selectedOptions.map((option) => ({
    groupKey: option.groupKey,
    optionKey: option.optionKey,
    label: option.label,
    groupTitle: option.groupTitle,
  }));
  const variantId = buildProductVariantId(resolvedSelections);
  const finalPriceCandidate = [...selectedOptions]
    .reverse()
    .find((option) => option.price !== null)?.price;
  const finalStockCandidate = [...selectedOptions]
    .reverse()
    .find((option) => option.stock !== null)?.stock;
  const finalPackLabelCandidate = [...selectedOptions]
    .reverse()
    .find((option) => option.packLabel)?.packLabel;
  const finalWeightCandidate = [...selectedOptions]
    .reverse()
    .find((option) => option.weight !== null)?.weight;

  return {
    variantId,
    optionSelections: resolvedSelections,
    selectedOptions,
    displayLabel: selectedOptions.map((option) => option.label).join(" / "),
    price:
      finalPriceCandidate !== undefined && finalPriceCandidate !== null
        ? Number(finalPriceCandidate)
        : Number(product.price || 0),
    stock:
      finalStockCandidate !== undefined && finalStockCandidate !== null
        ? normalizeNonNegativeInteger(finalStockCandidate, 0)
        : normalizeNonNegativeInteger(product.stock, 0),
    packLabel:
      String(finalPackLabelCandidate || "").trim() ||
      String(product.packLabel || "").trim(),
    weight:
      finalWeightCandidate !== undefined && finalWeightCandidate !== null
        ? Number(finalWeightCandidate)
        : Number(product.weight || 0),
  };
};

const prepareProductForStorage = (product = {}) => {
  const id =
    String(product.id || "").trim() ||
    `${slugifyValue(product.name) || "product"}-${Date.now()}`;

  return {
    ...product,
    id,
    productId: buildProductIdentifier({ ...product, id }),
    stock: normalizeNonNegativeInteger(product.stock, 0),
    images: normalizeProductImages(product),
    videoClips: normalizeProductVideoClips({ ...product, id }),
    optionGroups: normalizeProductOptionGroups(product),
  };
};

const normalizeProductImages = (product = {}) => {
  const imageCandidates = [
    ...(Array.isArray(product.images) ? product.images : []),
    product.image,
  ];

  return [...new Set(imageCandidates
    .map((image) => String(image || "").trim())
    .filter(Boolean))];
};

const normalizeProductVideoClip = (
  clip = {},
  index = 0,
  fallbackBaseId = "product",
) => {
  const title = String(clip.title || "").trim();
  const poster = String(clip.poster || clip.image || "").trim();
  const src = String(clip.src || clip.video || "").trim();
  const views = String(clip.views || "").trim();
  const products = normalizeOptionalInteger(clip.products);
  const fallbackIdSource =
    String(clip.id || clip.key || "").trim() ||
    title ||
    `${fallbackBaseId}-clip-${index + 1}`;

  if (!title && !poster && !src) {
    return null;
  }

  return {
    id: slugifyValue(fallbackIdSource) || `${fallbackBaseId}-clip-${index + 1}`,
    title,
    poster,
    src,
    views,
    products,
    isVideo: clip.isVideo !== undefined ? Boolean(clip.isVideo) : Boolean(src),
  };
};

const normalizeProductVideoClips = (product = {}) => {
  const fallbackBaseId = slugifyValue(
    product.productId || product.id || product.name || "product",
  );

  return Array.isArray(product.videoClips)
    ? product.videoClips
        .map((clip, index) =>
          normalizeProductVideoClip(clip, index, fallbackBaseId || "product"),
        )
        .filter(Boolean)
    : [];
};

const serializeProduct = (product) => {
  const images = normalizeProductImages(product);
  const tags = Array.isArray(product.tags)
    ? [...new Set(product.tags.map((tag) => String(tag || "").trim()).filter(Boolean))]
    : [];

  return {
    id: product.id,
    productId: buildProductIdentifier(product),
    name: product.name,
    category: product.category,
    price: product.price,
    weight: Number(product.weight) > 0 ? Number(product.weight) : 0,
    offer: String(product.offer || "").trim(),
    minOrderQuantity: Number(product.minOrderQuantity) > 0
      ? Number(product.minOrderQuantity)
      : 1,
    stock: normalizeNonNegativeInteger(product.stock, 0),
    isOnTrend: Boolean(product.isOnTrend),
    isFeaturedLatest: Boolean(product.isFeaturedLatest),
    packLabel: product.packLabel,
    unit: product.unit,
    badge: product.badge,
    description: product.description,
    image: images[0] || "",
    images,
    tags,
    videoClips: normalizeProductVideoClips(product),
    optionGroups: normalizeProductOptionGroups(product),
  };
};

const buildProductFilters = (filters = {}) => {
  const query = {};

  if (filters.id) {
    query.id = filters.id;
  }

  if (filters.productId) {
    query.productId = filters.productId;
  }

  if (filters.excludeId) {
    query.id = { $ne: filters.excludeId };
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.badge) {
    query.badge = filters.badge;
  }

  if (filters.query) {
    const escapedQuery = String(filters.query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { name: { $regex: escapedQuery, $options: "i" } },
      { category: { $regex: escapedQuery, $options: "i" } },
      { badge: { $regex: escapedQuery, $options: "i" } },
      { description: { $regex: escapedQuery, $options: "i" } },
      { tags: { $regex: escapedQuery, $options: "i" } },
    ];
  }

  return query;
};

const listProducts = async (filters = {}) => {
  let productQuery = Product.find(buildProductFilters(filters)).sort({
    name: 1,
  });

  if (filters.limit) {
    productQuery = productQuery.limit(filters.limit);
  }

  const products = await productQuery.lean();
  return products.map(serializeProduct);
};

const findProductById = async (id) => {
  const normalizedId = String(id || "").trim();
  const product = await Product.findOne({
    $or: [{ productId: normalizedId }, { id: normalizedId }],
  }).lean();
  return product ? serializeProduct(product) : null;
};

const findProductsByIds = async (ids = []) => {
  const normalizedIds = [...new Set(
    ids.map((id) => String(id || "").trim()).filter(Boolean),
  )];

  if (!normalizedIds.length) {
    return [];
  }

  const products = await Product.find({ id: { $in: normalizedIds } }).lean();
  return products.map(serializeProduct);
};

const createProduct = async (productData = {}) => {
  const preparedProduct = prepareProductForStorage(productData);
  const createdProduct = await Product.create(preparedProduct);
  return serializeProduct(createdProduct.toObject());
};

const updateProduct = async (productLookupId, updates = {}) => {
  const existingProduct = await Product.findOne({
    $or: [
      { id: String(productLookupId || "").trim() },
      { productId: String(productLookupId || "").trim() },
    ],
  });

  if (!existingProduct) {
    return null;
  }

  const nextData = {
    ...existingProduct.toObject(),
    ...updates,
  };
  const nextImages = normalizeProductImages(nextData);

  existingProduct.name =
    updates.name !== undefined ? String(updates.name || "").trim() : existingProduct.name;
  existingProduct.category =
    updates.category !== undefined
      ? String(updates.category || "").trim()
      : existingProduct.category;
  existingProduct.price =
    updates.price !== undefined ? Number(updates.price) : existingProduct.price;
  existingProduct.weight =
    updates.weight !== undefined ? Number(updates.weight) : existingProduct.weight;
  existingProduct.offer =
    updates.offer !== undefined ? String(updates.offer || "").trim() : existingProduct.offer;
  existingProduct.minOrderQuantity =
    updates.minOrderQuantity !== undefined
      ? Number(updates.minOrderQuantity)
      : existingProduct.minOrderQuantity;
  existingProduct.stock =
    updates.stock !== undefined
      ? normalizeNonNegativeInteger(updates.stock, 0)
      : existingProduct.stock;
  existingProduct.isOnTrend =
    updates.isOnTrend !== undefined ? Boolean(updates.isOnTrend) : existingProduct.isOnTrend;
  existingProduct.isFeaturedLatest =
    updates.isFeaturedLatest !== undefined
      ? Boolean(updates.isFeaturedLatest)
      : existingProduct.isFeaturedLatest;
  existingProduct.packLabel =
    updates.packLabel !== undefined
      ? String(updates.packLabel || "").trim()
      : existingProduct.packLabel;
  existingProduct.unit =
    updates.unit !== undefined ? String(updates.unit || "").trim() : existingProduct.unit;
  existingProduct.badge =
    updates.badge !== undefined ? String(updates.badge || "").trim() : existingProduct.badge;
  existingProduct.description =
    updates.description !== undefined
      ? String(updates.description || "").trim()
      : existingProduct.description;
  if (updates.tags !== undefined) {
    existingProduct.tags = Array.isArray(updates.tags)
      ? updates.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
      : [];
  }
  if (updates.videoClips !== undefined) {
    existingProduct.videoClips = normalizeProductVideoClips({
      ...existingProduct.toObject(),
      videoClips: updates.videoClips,
    });
  }
  if (updates.optionGroups !== undefined) {
    existingProduct.optionGroups = normalizeProductOptionGroups({
      optionGroups: updates.optionGroups,
    });
  }
  existingProduct.image = nextImages[0] || "";
  existingProduct.images = nextImages;
  await existingProduct.save();

  return serializeProduct(existingProduct.toObject());
};

const reserveProductStock = async (productLookupId, quantity, variantId = "") => {
  const normalizedLookupId = String(productLookupId || "").trim();
  const normalizedQuantity = normalizePositiveInteger(quantity, 0);

  if (!normalizedLookupId || normalizedQuantity <= 0) {
    return null;
  }

  const product = await Product.findOne({
    $or: [
      { id: normalizedLookupId },
      { productId: normalizedLookupId },
    ],
  });

  if (!product) {
    return null;
  }

  const resolvedVariant = resolveProductVariant(product.toObject(), { variantId });

  if (normalizeNonNegativeInteger(product.stock, 0) < normalizedQuantity) {
    return null;
  }

  for (const selection of resolvedVariant.selectedOptions) {
    if (selection.stock === null) {
      continue;
    }

    if (normalizeNonNegativeInteger(selection.stock, 0) < normalizedQuantity) {
      return null;
    }
  }

  product.stock = normalizeNonNegativeInteger(product.stock, 0) - normalizedQuantity;

  if (resolvedVariant.selectedOptions.length) {
    product.optionGroups = normalizeProductOptionGroups({
      optionGroups: product.optionGroups,
    }).map((group) => ({
      ...group,
      options: group.options.map((option) => {
        const selectedOption = resolvedVariant.selectedOptions.find(
          (entry) =>
            entry.groupKey === group.key && entry.optionKey === option.key,
        );

        if (!selectedOption || selectedOption.stock === null) {
          return option;
        }

        const nextStock = Math.max(
          0,
          normalizeNonNegativeInteger(option.stock, 0) - normalizedQuantity,
        );

        return {
          ...option,
          stock: nextStock,
          isDisabled: option.isDisabled || nextStock === 0,
        };
      }),
    }));
  }

  await product.save();
  return serializeProduct(product.toObject());
};

const releaseProductStock = async (productLookupId, quantity, variantId = "") => {
  const normalizedLookupId = String(productLookupId || "").trim();
  const normalizedQuantity = normalizePositiveInteger(quantity, 0);

  if (!normalizedLookupId || normalizedQuantity <= 0) {
    return null;
  }

  const product = await Product.findOne({
    $or: [
      { id: normalizedLookupId },
      { productId: normalizedLookupId },
    ],
  });

  if (!product) {
    return null;
  }

  const resolvedVariant = resolveProductVariant(product.toObject(), { variantId });

  product.stock = normalizeNonNegativeInteger(product.stock, 0) + normalizedQuantity;

  if (resolvedVariant.selectedOptions.length) {
    product.optionGroups = normalizeProductOptionGroups({
      optionGroups: product.optionGroups,
    }).map((group) => ({
      ...group,
      options: group.options.map((option) => {
        const selectedOption = resolvedVariant.selectedOptions.find(
          (entry) =>
            entry.groupKey === group.key && entry.optionKey === option.key,
        );

        if (!selectedOption || selectedOption.stock === null) {
          return option;
        }

        return {
          ...option,
          stock: normalizeNonNegativeInteger(option.stock, 0) + normalizedQuantity,
          isDisabled: false,
        };
      }),
    }));
  }

  await product.save();
  return serializeProduct(product.toObject());
};

const reserveProductStocks = async (items = []) => {
  const normalizedItems = items
    .map((item) => ({
      productId: String(item.productId || item.id || "").trim(),
      variantId: String(item.variantId || "").trim(),
      quantity: normalizePositiveInteger(item.quantity ?? item.qty, 0),
    }))
    .filter((item) => item.productId && item.quantity > 0);
  const reservedItems = [];

  for (const item of normalizedItems) {
    const reservedProduct = await reserveProductStock(
      item.productId,
      item.quantity,
      item.variantId,
    );

    if (!reservedProduct) {
      for (let index = reservedItems.length - 1; index >= 0; index -= 1) {
        const reservedItem = reservedItems[index];
        await releaseProductStock(
          reservedItem.productId,
          reservedItem.quantity,
          reservedItem.variantId,
        );
      }

      return {
        success: false,
        failedItem: item,
      };
    }

    reservedItems.push(item);
  }

  return {
    success: true,
  };
};

const releaseProductStocks = async (items = []) => {
  for (const item of items) {
    const productId = String(item.productId || item.id || "").trim();
    const variantId = String(item.variantId || "").trim();
    const quantity = normalizePositiveInteger(item.quantity ?? item.qty, 0);

    if (!productId || quantity <= 0) {
      continue;
    }

    await releaseProductStock(productId, quantity, variantId);
  }
};

const deleteProduct = async (productLookupId) => {
  const deletedProduct = await Product.findOneAndDelete({
    $or: [
      { id: String(productLookupId || "").trim() },
      { productId: String(productLookupId || "").trim() },
    ],
  }).lean();

  return deletedProduct ? serializeProduct(deletedProduct) : null;
};

const countProducts = async () => Product.countDocuments();

const createManyProducts = async (products) => {
  if (!products.length) {
    return [];
  }

  const createdProducts = await Product.insertMany(
    products.map(prepareProductForStorage),
    { ordered: true },
  );
  return createdProducts.map(serializeProduct);
};

const syncProductIdentifiers = async () => {
  const products = await Product.find({});
  let updatedCount = 0;

  for (const product of products) {
    const nextProductId = buildProductIdentifier(product);

    if (nextProductId === String(product.productId || "").trim()) {
      continue;
    }

    product.productId = nextProductId;
    await product.save();
    updatedCount += 1;
  }

  return updatedCount;
};

const syncProductImages = async () => {
  const products = await Product.find({});
  let updatedCount = 0;

  for (const product of products) {
    const normalizedImages = normalizeProductImages(product.toObject());

    if (!normalizedImages.length) {
      continue;
    }

    const currentPrimaryImage = String(product.image || "").trim();
    const currentImages = Array.isArray(product.images)
      ? product.images.map((image) => String(image || "").trim()).filter(Boolean)
      : [];
    const needsPrimaryUpdate = currentPrimaryImage !== normalizedImages[0];
    const needsImagesUpdate =
      currentImages.length !== normalizedImages.length ||
      currentImages.some((image, index) => image !== normalizedImages[index]);

    if (!needsPrimaryUpdate && !needsImagesUpdate) {
      continue;
    }

    product.image = normalizedImages[0];
    product.images = normalizedImages;
    await product.save();
    updatedCount += 1;
  }

  return updatedCount;
};

const syncSeedProductMetadata = async (seedProducts = []) => {
  if (!Array.isArray(seedProducts) || !seedProducts.length) {
    return 0;
  }

  const seedProductsById = new Map(
    seedProducts.map((product) => [String(product.id || "").trim(), product]),
  );
  const productIds = [...seedProductsById.keys()].filter(Boolean);

  if (!productIds.length) {
    return 0;
  }

  const products = await Product.find({ id: { $in: productIds } });
  let updatedCount = 0;

  for (const product of products) {
    const seedProduct = seedProductsById.get(String(product.id || "").trim());

    if (!seedProduct) {
      continue;
    }

    const normalizedTags = Array.isArray(seedProduct.tags)
      ? [...new Set(seedProduct.tags.map((tag) => String(tag || "").trim()).filter(Boolean))]
      : [];
    const nextWeight = Number(seedProduct.weight || 0);
    const nextOffer = String(seedProduct.offer || "").trim();
    const nextMinOrderQuantity = Number(seedProduct.minOrderQuantity || 1);
    const needsUpdate =
      Number(product.weight || 0) !== nextWeight ||
      String(product.offer || "").trim() !== nextOffer ||
      Number(product.minOrderQuantity || 1) !== nextMinOrderQuantity ||
      Boolean(product.isOnTrend) !== Boolean(seedProduct.isOnTrend) ||
      Boolean(product.isFeaturedLatest) !== Boolean(seedProduct.isFeaturedLatest) ||
      JSON.stringify(
        Array.isArray(product.tags)
          ? product.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
          : [],
      ) !== JSON.stringify(normalizedTags);

    if (!needsUpdate) {
      continue;
    }

    product.weight = nextWeight;
    product.offer = nextOffer;
    product.minOrderQuantity = nextMinOrderQuantity;
    product.isOnTrend = Boolean(seedProduct.isOnTrend);
    product.isFeaturedLatest = Boolean(seedProduct.isFeaturedLatest);
    product.tags = normalizedTags;
    await product.save();
    updatedCount += 1;
  }

  return updatedCount;
};

const syncProductStockValues = async (seedProducts = []) => {
  const seedProductsById = new Map(
    seedProducts.map((product) => [
      String(product.id || "").trim(),
      normalizeNonNegativeInteger(product.stock, DEFAULT_BACKFILL_STOCK),
    ]),
  );
  const products = await Product.find({});
  let updatedCount = 0;

  for (const product of products) {
    const currentStock = Number(product.stock);

    if (Number.isFinite(currentStock) && currentStock >= 0) {
      continue;
    }

    product.stock =
      seedProductsById.get(String(product.id || "").trim()) ??
      Math.max(
        normalizePositiveInteger(product.minOrderQuantity, 1),
        DEFAULT_BACKFILL_STOCK,
      );
    await product.save();
    updatedCount += 1;
  }

  return updatedCount;
};

const syncProductOptionGroups = async () => 0;

const applyProductGalleryImport = async (galleryEntries = []) => {
  if (!Array.isArray(galleryEntries) || !galleryEntries.length) {
    return { matched: 0, updated: 0 };
  }

  let matched = 0;
  let updated = 0;

  for (const entry of galleryEntries) {
    const normalizedLookupId = String(
      entry.productId || entry.id || "",
    ).trim();

    if (!normalizedLookupId) {
      continue;
    }

    const product = await Product.findOne({
      $or: [{ productId: normalizedLookupId }, { id: normalizedLookupId }],
    });

    if (!product) {
      continue;
    }

    matched += 1;

    const importedImages = Array.isArray(entry.images) ? entry.images : [];
    const normalizedImages = normalizeProductImages({
      image:
        entry.image ||
        (importedImages.length ? importedImages[0] : product.image),
      images: importedImages,
    });

    if (!normalizedImages.length) {
      continue;
    }

    const currentImages = normalizeProductImages(product.toObject());
    const needsUpdate =
      String(product.image || "").trim() !== normalizedImages[0] ||
      JSON.stringify(currentImages) !== JSON.stringify(normalizedImages);

    if (!needsUpdate) {
      continue;
    }

    product.image = normalizedImages[0];
    product.images = normalizedImages;
    await product.save();
    updated += 1;
  }

  return { matched, updated };
};

module.exports = {
  PRODUCT_ID_PATTERN,
  applyProductGalleryImport,
  buildProductIdentifier,
  buildProductVariantId,
  countProducts,
  createProduct,
  createManyProducts,
  deleteProduct,
  findProductById,
  findProductsByIds,
  getDefaultProductOptionSelections,
  listProducts,
  normalizeProductOptionSelections,
  parseProductVariantId,
  releaseProductStock,
  releaseProductStocks,
  reserveProductStock,
  reserveProductStocks,
  resolveProductVariant,
  syncProductIdentifiers,
  syncProductImages,
  syncProductOptionGroups,
  syncProductStockValues,
  syncSeedProductMetadata,
  updateProduct,
};
