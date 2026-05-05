const {
  createAdminProduct,
  createAdminService,
  createAdminStaffAccount,
  deleteAdminProduct,
  deleteAdminReview,
  deleteAdminService,
  deleteAdminStaffAccount,
  getAdminCustomer,
  getAdminOrder,
  getAdminProduct,
  getAdminSetupStatus,
  getAdminService,
  getCurrentStaffAccount,
  listAdminCustomers,
  listAdminOrders,
  listAdminProducts,
  listAdminReviews,
  listAdminServices,
  listAdminStaffAccounts,
  listAdminTransactions,
  loginStaffAccount,
  setupInitialAdminOwner,
  updateAdminCustomer,
  updateAdminOrder,
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
const { asyncHandler } = require("../utils/asyncHandler");

const loginAdmin = asyncHandler(async (req, res) => {
  const payload = await loginStaffAccount(req.body);

  res.status(200).json({
    message: "Admin login successful.",
    data: payload,
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

  res.status(201).json({
    message: "Initial admin owner created successfully.",
    data: payload,
  });
});

const getAdminMe = asyncHandler(async (req, res) => {
  const staff = await getCurrentStaffAccount(req.staff.staffAccountId);

  res.status(200).json({
    message: "Staff account fetched successfully.",
    data: { staff },
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

const deleteProductForAdmin = asyncHandler(async (req, res) => {
  const product = await deleteAdminProduct(req.params.productId);
  res.status(200).json({
    message: "Admin product deleted successfully.",
    data: { product },
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
  const review = await updateAdminReview(req.params.reviewId, req.body);
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
  const orders = await listAdminOrders();
  res.status(200).json({
    message: "Admin orders fetched successfully.",
    data: { orders },
  });
});

const listTransactionsForAdmin = asyncHandler(async (req, res) => {
  const payload = await listAdminTransactions();
  res.status(200).json({
    message: "Admin transactions fetched successfully.",
    data: payload,
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

const getCustomerForAdmin = asyncHandler(async (req, res) => {
  const customer = await getAdminCustomer(req.params.customerId);
  res.status(200).json({
    message: "Admin customer fetched successfully.",
    data: { customer },
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
  createProductForAdmin,
  createServiceForAdmin,
  createHomeCategoryForAdmin,
  createStaffForAdmin,
  deleteProductForAdmin,
  deleteHomeCategoryForAdmin,
  deleteReviewForAdmin,
  deleteServiceForAdmin,
  deleteStaffForAdmin,
  getAdminMe,
  getAdminSetupStatusController,
  getCustomerForAdmin,
  getHomeCategoryForAdmin,
  getOrderForAdmin,
  getProductForAdmin,
  getServiceForAdmin,
  listCustomersForAdmin,
  listHomeCategoriesForAdmin,
  listOrdersForAdmin,
  listProductsForAdmin,
  listReviewsForAdmin,
  listServicesForAdmin,
  listStaffForAdmin,
  listTransactionsForAdmin,
  loginAdmin,
  setupInitialAdminOwnerController,
  updateCustomerForAdmin,
  updateHomeCategoryForAdmin,
  updateOrderForAdmin,
  updateProductForAdmin,
  updateReviewForAdmin,
  updateServiceForAdmin,
  updateStaffForAdmin,
};
