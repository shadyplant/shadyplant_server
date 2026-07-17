const {
  findRuntimeSettingByKey,
  upsertRuntimeSetting,
} = require("../repositories/app-runtime-setting.repository");
const { findProductById } = require("../repositories/product.repository");
const { ApiError } = require("../utils/apiError");

const LAWN_GRASS_PAGE_SETTING_KEY = "lawn_grass_page";

const normalizeProductId = (value) => String(value || "").trim();

const resolveLinkedProduct = async (setting) => {
  const productId = normalizeProductId(setting?.value?.productId);

  if (!productId) {
    return null;
  }

  return findProductById(productId);
};

const serializeLawnGrassPageSettings = async (setting) => {
  const product = await resolveLinkedProduct(setting);

  return {
    productId: normalizeProductId(setting?.value?.productId),
    product,
    updatedAt: setting?.updatedAt || null,
    updatedByStaffAccountId: setting?.updatedByStaffAccountId || null,
  };
};

const getLawnGrassPageSettings = async () => {
  const setting = await findRuntimeSettingByKey(LAWN_GRASS_PAGE_SETTING_KEY);
  return serializeLawnGrassPageSettings(setting);
};

const updateLawnGrassPageProduct = async ({
  productId,
  updatedByStaffAccountId,
}) => {
  const normalizedProductId = normalizeProductId(productId);

  if (normalizedProductId) {
    const product = await findProductById(normalizedProductId);

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }
  }

  const setting = await upsertRuntimeSetting({
    key: LAWN_GRASS_PAGE_SETTING_KEY,
    value: {
      productId: normalizedProductId,
    },
    updatedByStaffAccountId,
  });

  return serializeLawnGrassPageSettings(setting);
};

module.exports = {
  LAWN_GRASS_PAGE_SETTING_KEY,
  getLawnGrassPageSettings,
  updateLawnGrassPageProduct,
};
