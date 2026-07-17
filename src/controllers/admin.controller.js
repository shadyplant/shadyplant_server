const {
  addItemToAdminCustomerCart,
  adjustAdminProductStock,
  createAdminCustomerCartPaymentCheckout,
  createAdminCustomer,
  createAdminCoupon,
  createAdminProduct,
  createAdminService,
  createAdminStaffAccount,
  deleteAdminCoupon,
  deleteAdminProduct,
  deleteAdminReview,
  deleteAdminService,
  deleteAdminStaffAccount,
  getAdminCustomer,
  getAdminCustomerCart,
  getAdminCustomerCartPaymentAttempt,
  getAdminOrder,
  getAdminPaymentGatewaySettings,
  getAdminProduct,
  getAdminProductStockSnapshot,
  getAdminSetupStatus,
  getAdminService,
  getCurrentStaffAccount,
  listAdminCoupons,
  listAdminCustomers,
  listAdminOrders,
  listAdminProductStockAdjustmentLogs,
  listAdminProducts,
  listAdminReviews,
  listAdminSalesReport,
  listAdminServices,
  listAdminStaffAccounts,
  listAdminTransactions,
  loginStaffAccount,
  generateAdminMailDraft,
  previewAdminCustomerCartCheckout,
  removeAdminCustomerCartItem,
  setupInitialAdminOwner,
  syncAdminProductsFromSheet,
  sendAdminEmail,
  updateAdminCustomer,
  updateAdminCustomerCartItem,
  updateAdminCoupon,
  updateAdminOrder,
  updateAdminPaymentGatewaySettings,
  updateAdminProduct,
  updateAdminReview,
  updateAdminService,
  updateAdminStaffAccount,
} = require("../services/admin.service");
const {
  createAdminHomeCategoryItem,
  deleteAdminHomeCategoryItem,
  getAdminHomeCategoryItem,
  listAdminHomeCategoryItems,
  updateAdminHomeCategoryItem,
} = require("../services/home-category.service");
const {
  createAdminHomeSliderBanner,
  deleteAdminHomeSliderBanner,
  getAdminHomeSliderBanner,
  listAdminHomeSliderBanners,
  updateAdminHomeSliderBanner,
} = require("../services/home-slider-banner.service");
const {
  getLawnGrassPageSettings,
  updateLawnGrassPageProduct,
} = require("../services/lawn-grass-page.service");
const { cacheProductSyncResponse } = require("../middleware/product-sync.middleware");
const { asyncHandler } = require("../utils/asyncHandler");
const {
  attachStaffAccessCookie,
  clearStaffAccessCookie,
} = require("../utils/cookies");
const {
  completeAdminMediaUploadSession,
  createAdminMediaUploadSession,
} = require("../services/media-upload.service");

const loginAdmin = asyncHandler(async (req, res) => {
  const payload = await loginStaffAccount(req.body);
  attachStaffAccessCookie(res, payload.accessToken);

  res.status(200).json({
    message: "Admin login successful.",
    data: {
      staff: payload.staff,
      expiresIn: payload.expiresIn,
    },
  });
});

const getAdminSetupStatusController = asyncHandler(async (req, res) => {
  const status = await getAdminSetupStatus();

  res.status(200).json({
    message: "Admin setup status fetched successfully.",
    data: status,
  });
});

const setupInitialAdminOwnerController = asyncHandler(async (req, res) => {
  const payload = await setupInitialAdminOwner(req.body);
  attachStaffAccessCookie(res, payload.accessToken);

  res.status(201).json({
    message: "Initial admin owner created successfully.",
    data: {
      staff: payload.staff,
      expiresIn: payload.expiresIn,
    },
  });
});

const logoutAdmin = asyncHandler(async (_req, res) => {
  clearStaffAccessCookie(res);

  res.status(200).json({
    message: "Admin logout successful.",
    data: { success: true },
  });
});

const getAdminMe = asyncHandler(async (req, res) => {
  const staff = await getCurrentStaffAccount(req.staff.staffAccountId);

  res.status(200).json({
    message: "Staff account fetched successfully.",
    data: { staff },
  });
});

const getPaymentGatewaySettingsForAdmin = asyncHandler(async (req, res) => {
  const settings = await getAdminPaymentGatewaySettings();

  res.status(200).json({
    message: "Payment gateway settings fetched successfully.",
    data: { settings },
  });
});

const updatePaymentGatewaySettingsForAdmin = asyncHandler(async (req, res) => {
  const settings = await updateAdminPaymentGatewaySettings(
    req.staff.staffAccountId,
    req.body,
  );

  res.status(200).json({
    message: "Payment gateway settings updated successfully.",
    data: { settings },
  });
});

const getLawnGrassPageSettingsForAdmin = asyncHandler(async (_req, res) => {
  const settings = await getLawnGrassPageSettings();

  res.status(200).json({
    message: "Lawn grass page settings fetched successfully.",
    data: { settings },
  });
});

const updateLawnGrassPageSettingsForAdmin = asyncHandler(async (req, res) => {
  const settings = await updateLawnGrassPageProduct({
    productId: req.body?.productId,
    updatedByStaffAccountId: req.staff.staffAccountId,
  });

  res.status(200).json({
    message: "Lawn grass page settings updated successfully.",
    data: { settings },
  });
});

const sendAdminEmailForAdmin = asyncHandler(async (req, res) => {
  const result = await sendAdminEmail({
    recipients: req.body?.recipients,
    to: req.body?.to,
    subject: req.body?.subject,
    html: req.body?.html,
    text: req.body?.text,
    source: req.body?.source || "admin-mailer",
  });

  res.status(200).json({
    message: "Email processed successfully.",
    data: { result },
  });
});

const generateAdminMailDraftForAdmin = asyncHandler(async (req, res) => {
  const draft = await generateAdminMailDraft({
    prompt: req.body?.prompt,
    mode: req.body?.mode,
    subject: req.body?.subject,
    currentBody: req.body?.currentBody,
  });

  res.status(200).json({
    message: "AI mail draft generated successfully.",
    data: { draft },
  });
});

const listHomeCategoriesForAdmin = asyncHandler(async (req, res) => {
  const items = await listAdminHomeCategoryItems(req.staff.organizationId);

  res.status(200).json({
    message: "Admin home category items fetched successfully.",
    data: { items },
  });
});

const getHomeCategoryForAdmin = asyncHandler(async (req, res) => {
  const item = await getAdminHomeCategoryItem(
    req.params.itemId,
    req.staff.organizationId,
  );

  res.status(200).json({
    message: "Admin home category item fetched successfully.",
    data: { item },
  });
});

const createHomeCategoryForAdmin = asyncHandler(async (req, res) => {
  const item = await createAdminHomeCategoryItem(req.staff.organizationId, req.body);

  res.status(201).json({
    message: "Admin home category item created successfully.",
    data: { item },
  });
});

const updateHomeCategoryForAdmin = asyncHandler(async (req, res) => {
  const item = await updateAdminHomeCategoryItem(
    req.params.itemId,
    req.staff.organizationId,
    req.body,
  );

  res.status(200).json({
    message: "Admin home category item updated successfully.",
    data: { item },
  });
});

const deleteHomeCategoryForAdmin = asyncHandler(async (req, res) => {
  const item = await deleteAdminHomeCategoryItem(
    req.params.itemId,
    req.staff.organizationId,
  );

  res.status(200).json({
    message: "Admin home category item deleted successfully.",
    data: { item },
  });
});

const listHomeSliderBannersForAdmin = asyncHandler(async (req, res) => {
  const items = await listAdminHomeSliderBanners(req.staff.organizationId);

  res.status(200).json({
    message: "Admin home slider banners fetched successfully.",
    data: { items },
  });
});

const getHomeSliderBannerForAdmin = asyncHandler(async (req, res) => {
  const item = await getAdminHomeSliderBanner(
    req.params.itemId,
    req.staff.organizationId,
  );

  res.status(200).json({
    message: "Admin home slider banner fetched successfully.",
    data: { item },
  });
});

const createHomeSliderBannerForAdmin = asyncHandler(async (req, res) => {
  const item = await createAdminHomeSliderBanner(req.staff.organizationId, req.body);

  res.status(201).json({
    message: "Admin home slider banner created successfully.",
    data: { item },
  });
});

const updateHomeSliderBannerForAdmin = asyncHandler(async (req, res) => {
  const item = await updateAdminHomeSliderBanner(
    req.params.itemId,
    req.staff.organizationId,
    req.body,
  );

  res.status(200).json({
    message: "Admin home slider banner updated successfully.",
    data: { item },
  });
});

const deleteHomeSliderBannerForAdmin = asyncHandler(async (req, res) => {
  const item = await deleteAdminHomeSliderBanner(
    req.params.itemId,
    req.staff.organizationId,
  );

  res.status(200).json({
    message: "Admin home slider banner deleted successfully.",
    data: { item },
  });
});

const listProductsForAdmin = asyncHandler(async (req, res) => {
  const products = await listAdminProducts();
  res.status(200).json({
    message: "Admin products fetched successfully.",
    data: { products },
  });
});

const getProductForAdmin = asyncHandler(async (req, res) => {
  const product = await getAdminProduct(req.params.productId);
  res.status(200).json({
    message: "Admin product fetched successfully.",
    data: { product },
  });
});

const createProductForAdmin = asyncHandler(async (req, res) => {
  const product = await createAdminProduct(req.body);
  res.status(201).json({
    message: "Admin product created successfully.",
    data: { product },
  });
});

const updateProductForAdmin = asyncHandler(async (req, res) => {
  const product = await updateAdminProduct(req.params.productId, req.body);
  res.status(200).json({
    message: "Admin product updated successfully.",
    data: { product },
  });
});

const adjustProductStockForAdmin = asyncHandler(async (req, res) => {
  const result = await adjustAdminProductStock(req.params.productId, req.body, {
    staffAccountId: req.staff.staffAccountId,
    email: req.staff.email,
    role: req.staff.role,
  });
  res.status(200).json({
    message: "Product stock adjusted successfully.",
    data: result,
  });
});

const listProductStockAdjustmentLogsForAdmin = asyncHandler(async (req, res) => {
  const result = await listAdminProductStockAdjustmentLogs(
    req.params.productId,
    req.query,
  );
  res.status(200).json({
    message: "Product stock logs fetched successfully.",
    data: result,
  });
});

const deleteProductForAdmin = asyncHandler(async (req, res) => {
  const product = await deleteAdminProduct(req.params.productId);
  res.status(200).json({
    message: "Admin product deleted successfully.",
    data: { product },
  });
});

const syncProductsForAdmin = asyncHandler(async (req, res) => {
  const dryRun =
    String(req.query.dryRun || req.body?.dryRun || "")
      .trim()
      .toLowerCase() === "true";
  const result = await syncAdminProductsFromSheet(req.productSyncPayload, {
    dryRun,
    context: req.productSyncContext,
  });
  await cacheProductSyncResponse(req.productSyncContext, result);

  res.status(200).json(result);
});

const getProductStockSnapshotForAdmin = asyncHandler(async (req, res) => {
  const snapshot = await getAdminProductStockSnapshot(req.body);

  res.status(200).json({
    success: true,
    requestId: req.productSyncContext?.requestId || null,
    ...snapshot,
    fetchedAt: new Date().toISOString(),
  });
});

const listServicesForAdmin = asyncHandler(async (req, res) => {
  const services = await listAdminServices(req.staff.organizationId);
  res.status(200).json({
    message: "Admin services fetched successfully.",
    data: { services },
  });
});

const getServiceForAdmin = asyncHandler(async (req, res) => {
  const service = await getAdminService(
    req.params.serviceId,
    req.staff.organizationId,
  );
  res.status(200).json({
    message: "Admin service fetched successfully.",
    data: { service },
  });
});

const createServiceForAdmin = asyncHandler(async (req, res) => {
  const service = await createAdminService(req.staff.organizationId, req.body);
  res.status(201).json({
    message: "Admin service created successfully.",
    data: { service },
  });
});

const updateServiceForAdmin = asyncHandler(async (req, res) => {
  const service = await updateAdminService(
    req.params.serviceId,
    req.staff.organizationId,
    req.body,
  );
  res.status(200).json({
    message: "Admin service updated successfully.",
    data: { service },
  });
});

const deleteServiceForAdmin = asyncHandler(async (req, res) => {
  const service = await deleteAdminService(
    req.params.serviceId,
    req.staff.organizationId,
  );
  res.status(200).json({
    message: "Admin service deleted successfully.",
    data: { service },
  });
});

const listReviewsForAdmin = asyncHandler(async (req, res) => {
  const reviews = await listAdminReviews(req.query);
  res.status(200).json({
    message: "Admin reviews fetched successfully.",
    data: { reviews },
  });
});

const updateReviewForAdmin = asyncHandler(async (req, res) => {
  const review = await updateAdminReview(req.params.reviewId, req.body, {
    staffAccountId: req.staff.staffAccountId,
    email: req.staff.email,
  });
  res.status(200).json({
    message: "Admin review updated successfully.",
    data: { review },
  });
});

const deleteReviewForAdmin = asyncHandler(async (req, res) => {
  const review = await deleteAdminReview(req.params.reviewId);
  res.status(200).json({
    message: "Admin review deleted successfully.",
    data: { review },
  });
});

const listOrdersForAdmin = asyncHandler(async (req, res) => {
  const payload = await listAdminOrders(req.query);
  res.status(200).json({
    message: "Admin orders fetched successfully.",
    data: payload,
  });
});

const createMediaUploadSessionForAdmin = asyncHandler(async (req, res) => {
  const uploadSession = await createAdminMediaUploadSession(req.staff, req.body);

  res.status(201).json({
    message: "Media upload session created successfully.",
    data: uploadSession,
  });
});

const completeMediaUploadSessionForAdmin = asyncHandler(async (req, res) => {
  const session = await completeAdminMediaUploadSession(
    req.params.uploadId,
    req.staff,
    req.body,
  );

  res.status(200).json({
    message: "Media upload session completed successfully.",
    data: { session },
  });
});

const listTransactionsForAdmin = asyncHandler(async (req, res) => {
  const payload = await listAdminTransactions(req.query);
  res.status(200).json({
    message: "Admin transactions fetched successfully.",
    data: payload,
  });
});

const listSalesReportForAdmin = asyncHandler(async (req, res) => {
  const payload = await listAdminSalesReport(req.query);
  res.status(200).json({
    message: "Admin sales report fetched successfully.",
    data: payload,
  });
});

const listCouponsForAdmin = asyncHandler(async (req, res) => {
  const coupons = await listAdminCoupons();
  res.status(200).json({
    message: "Admin coupons fetched successfully.",
    data: { coupons },
  });
});

const createCouponForAdmin = asyncHandler(async (req, res) => {
  const coupon = await createAdminCoupon(req.staff.staffAccountId, req.body);
  res.status(201).json({
    message: "Coupon created successfully.",
    data: { coupon },
  });
});

const updateCouponForAdmin = asyncHandler(async (req, res) => {
  const coupon = await updateAdminCoupon(req.params.couponId, req.body);
  res.status(200).json({
    message: "Coupon updated successfully.",
    data: { coupon },
  });
});

const deleteCouponForAdmin = asyncHandler(async (req, res) => {
  const coupon = await deleteAdminCoupon(req.params.couponId);
  res.status(200).json({
    message: "Coupon deleted successfully.",
    data: { coupon },
  });
});

const getOrderForAdmin = asyncHandler(async (req, res) => {
  const order = await getAdminOrder(req.params.orderId);
  res.status(200).json({
    message: "Admin order fetched successfully.",
    data: { order },
  });
});

const updateOrderForAdmin = asyncHandler(async (req, res) => {
  const order = await updateAdminOrder(req.params.orderId, req.body);
  res.status(200).json({
    message: "Admin order updated successfully.",
    data: { order },
  });
});

const listCustomersForAdmin = asyncHandler(async (req, res) => {
  const customers = await listAdminCustomers();
  res.status(200).json({
    message: "Admin customers fetched successfully.",
    data: { customers },
  });
});

const createCustomerForAdmin = asyncHandler(async (req, res) => {
  const customer = await createAdminCustomer(req.body);
  res.status(201).json({
    message: "Admin customer created successfully.",
    data: { customer },
  });
});

const getCustomerForAdmin = asyncHandler(async (req, res) => {
  const customer = await getAdminCustomer(req.params.customerId);
  res.status(200).json({
    message: "Admin customer fetched successfully.",
    data: { customer },
  });
});

const getCustomerCartForAdmin = asyncHandler(async (req, res) => {
  const result = await getAdminCustomerCart(req.params.customerId);
  res.status(200).json({
    message: "Admin customer cart fetched successfully.",
    data: result,
  });
});

const previewCustomerCartCheckoutForAdmin = asyncHandler(async (req, res) => {
  const result = await previewAdminCustomerCartCheckout(
    req.params.customerId,
    req.body,
  );
  res.status(200).json({
    message: "Admin customer checkout preview generated successfully.",
    data: result,
  });
});

const createCustomerCartPaymentCheckoutForAdmin = asyncHandler(async (req, res) => {
  const result = await createAdminCustomerCartPaymentCheckout(
    req.params.customerId,
    req.body,
  );
  res.status(201).json({
    message: "Admin customer payment transaction created successfully.",
    data: result,
  });
});

const getCustomerCartPaymentAttemptForAdmin = asyncHandler(async (req, res) => {
  const result = await getAdminCustomerCartPaymentAttempt(
    req.params.customerId,
    req.params.paymentAttemptId,
  );
  res.status(200).json({
    message: "Admin customer payment transaction fetched successfully.",
    data: result,
  });
});

const addCustomerCartItemForAdmin = asyncHandler(async (req, res) => {
  const result = await addItemToAdminCustomerCart(req.params.customerId, req.body);
  res.status(200).json({
    message: "Admin customer cart updated successfully.",
    data: result,
  });
});

const updateCustomerCartItemForAdmin = asyncHandler(async (req, res) => {
  const result = await updateAdminCustomerCartItem(
    req.params.customerId,
    req.params.itemId,
    req.body,
  );
  res.status(200).json({
    message: "Admin customer cart item updated successfully.",
    data: result,
  });
});

const removeCustomerCartItemForAdmin = asyncHandler(async (req, res) => {
  const result = await removeAdminCustomerCartItem(
    req.params.customerId,
    req.params.itemId,
  );
  res.status(200).json({
    message: "Admin customer cart item removed successfully.",
    data: result,
  });
});

const updateCustomerForAdmin = asyncHandler(async (req, res) => {
  const customer = await updateAdminCustomer(req.params.customerId, req.body);
  res.status(200).json({
    message: "Admin customer updated successfully.",
    data: { customer },
  });
});

const listStaffForAdmin = asyncHandler(async (req, res) => {
  const staff = await listAdminStaffAccounts(req.staff.organizationId);
  res.status(200).json({
    message: "Admin staff fetched successfully.",
    data: { staff },
  });
});

const createStaffForAdmin = asyncHandler(async (req, res) => {
  const staff = await createAdminStaffAccount(req.staff.staffAccountId, req.body);
  res.status(201).json({
    message: "Admin staff account created successfully.",
    data: { staff },
  });
});

const updateStaffForAdmin = asyncHandler(async (req, res) => {
  const staff = await updateAdminStaffAccount(
    req.staff.staffAccountId,
    req.params.staffId,
    req.body,
  );
  res.status(200).json({
    message: "Admin staff account updated successfully.",
    data: { staff },
  });
});

const deleteStaffForAdmin = asyncHandler(async (req, res) => {
  const staff = await deleteAdminStaffAccount(
    req.staff.staffAccountId,
    req.params.staffId,
  );
  res.status(200).json({
    message: "Admin staff account deleted successfully.",
    data: { staff },
  });
});

module.exports = {
  addCustomerCartItemForAdmin,
  adjustProductStockForAdmin,
  listProductStockAdjustmentLogsForAdmin,
  createCustomerForAdmin,
  createCouponForAdmin,
  createProductForAdmin,
  createServiceForAdmin,
  createHomeCategoryForAdmin,
  createHomeSliderBannerForAdmin,
  createStaffForAdmin,
  deleteCouponForAdmin,
  deleteProductForAdmin,
  deleteHomeCategoryForAdmin,
  deleteHomeSliderBannerForAdmin,
  deleteReviewForAdmin,
  deleteServiceForAdmin,
  deleteStaffForAdmin,
  getAdminMe,
  getAdminSetupStatusController,
  getCustomerForAdmin,
  getCustomerCartForAdmin,
  getCustomerCartPaymentAttemptForAdmin,
  getPaymentGatewaySettingsForAdmin,
  getHomeCategoryForAdmin,
  getHomeSliderBannerForAdmin,
  getLawnGrassPageSettingsForAdmin,
  getOrderForAdmin,
  getProductForAdmin,
  getProductStockSnapshotForAdmin,
  getServiceForAdmin,
  listCustomersForAdmin,
  listCouponsForAdmin,
  listHomeCategoriesForAdmin,
  listHomeSliderBannersForAdmin,
  listOrdersForAdmin,
  listProductsForAdmin,
  listReviewsForAdmin,
  listSalesReportForAdmin,
  listServicesForAdmin,
  listStaffForAdmin,
  listTransactionsForAdmin,
  loginAdmin,
  logoutAdmin,
  previewCustomerCartCheckoutForAdmin,
  removeCustomerCartItemForAdmin,
  setupInitialAdminOwnerController,
  syncProductsForAdmin,
  createCustomerCartPaymentCheckoutForAdmin,
  updateCustomerForAdmin,
  updateCustomerCartItemForAdmin,
  updateCouponForAdmin,
  updateHomeCategoryForAdmin,
  updateHomeSliderBannerForAdmin,
  updateLawnGrassPageSettingsForAdmin,
  createMediaUploadSessionForAdmin,
  completeMediaUploadSessionForAdmin,
  generateAdminMailDraftForAdmin,
  sendAdminEmailForAdmin,
  updateOrderForAdmin,
  updatePaymentGatewaySettingsForAdmin,
  updateProductForAdmin,
  updateReviewForAdmin,
  updateServiceForAdmin,
  updateStaffForAdmin,
};
