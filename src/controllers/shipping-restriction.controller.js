const { asyncHandler } = require("../utils/asyncHandler");
const {
  checkShippingServiceability,
  createCountry,
  createState,
  createShippingRule,
  deleteCountry,
  deleteState,
  deleteShippingRule,
  listCountriesForAdmin,
  listShippingServiceabilityRegions,
  listShippingServiceabilityRules,
  listStatesForAdmin,
  updateCountry,
  updateState,
  updateShippingRegion,
  updateShippingRule,
} = require("../services/shipping-restriction.service");

const checkShippingServiceabilityController = asyncHandler(async (req, res) => {
  const result = await checkShippingServiceability(req.query);
  res.status(200).json(result);
});

const listShippingRegionsForAdmin = asyncHandler(async (req, res) => {
  const regions = await listShippingServiceabilityRegions(req.query);
  res.status(200).json({
    message: "Shipping regions fetched successfully.",
    data: { regions },
  });
});

const listCountriesForAdminController = asyncHandler(async (req, res) => {
  const countries = await listCountriesForAdmin();
  res.status(200).json({
    message: "Countries fetched successfully.",
    data: { countries },
  });
});

const listStatesForAdminController = asyncHandler(async (req, res) => {
  const states = await listStatesForAdmin(req.query);
  res.status(200).json({
    message: "States fetched successfully.",
    data: { states },
  });
});

const createCountryForAdmin = asyncHandler(async (req, res) => {
  const country = await createCountry(req.body);
  res.status(201).json({
    message: "Country created successfully.",
    data: { country },
  });
});

const updateCountryForAdmin = asyncHandler(async (req, res) => {
  const country = await updateCountry(req.params.countryId, req.body);
  res.status(200).json({
    message: "Country updated successfully.",
    data: { country },
  });
});

const deleteCountryForAdmin = asyncHandler(async (req, res) => {
  const country = await deleteCountry(req.params.countryId);
  res.status(200).json({
    message: "Country deleted successfully.",
    data: { country },
  });
});

const createStateForAdmin = asyncHandler(async (req, res) => {
  const state = await createState(req.body);
  res.status(201).json({
    message: "State created successfully.",
    data: { state },
  });
});

const updateStateForAdmin = asyncHandler(async (req, res) => {
  const state = await updateState(req.params.stateId, req.body);
  res.status(200).json({
    message: "State updated successfully.",
    data: { state },
  });
});

const deleteStateForAdmin = asyncHandler(async (req, res) => {
  const state = await deleteState(req.params.stateId);
  res.status(200).json({
    message: "State deleted successfully.",
    data: { state },
  });
});

const updateShippingRegionForAdmin = asyncHandler(async (req, res) => {
  const region = await updateShippingRegion(req.params.regionId, req.body);
  res.status(200).json({
    message: "Shipping region updated successfully.",
    data: { region },
  });
});

const listShippingRulesForAdmin = asyncHandler(async (req, res) => {
  const rules = await listShippingServiceabilityRules(req.query);
  res.status(200).json({
    message: "Shipping rules fetched successfully.",
    data: { rules },
  });
});

const createShippingRuleForAdmin = asyncHandler(async (req, res) => {
  const rule = await createShippingRule(req.body);
  res.status(201).json({
    message: "Shipping rule created successfully.",
    data: { rule },
  });
});

const updateShippingRuleForAdmin = asyncHandler(async (req, res) => {
  const rule = await updateShippingRule(req.params.ruleId, req.body);
  res.status(200).json({
    message: "Shipping rule updated successfully.",
    data: { rule },
  });
});

const deleteShippingRuleForAdmin = asyncHandler(async (req, res) => {
  const rule = await deleteShippingRule(req.params.ruleId);
  res.status(200).json({
    message: "Shipping rule deleted successfully.",
    data: { rule },
  });
});

module.exports = {
  createCountryForAdmin,
  checkShippingServiceabilityController,
  createStateForAdmin,
  createShippingRuleForAdmin,
  deleteCountryForAdmin,
  deleteShippingRuleForAdmin,
  deleteStateForAdmin,
  listCountriesForAdminController,
  listShippingRegionsForAdmin,
  listShippingRulesForAdmin,
  listStatesForAdminController,
  updateCountryForAdmin,
  updateShippingRegionForAdmin,
  updateStateForAdmin,
  updateShippingRuleForAdmin,
};
