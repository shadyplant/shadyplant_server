const { env } = require("../config/env");
const {
  findRuntimeSettingByKey,
  upsertRuntimeSetting,
} = require("../repositories/app-runtime-setting.repository");
const { ApiError } = require("../utils/apiError");

const PAYMENT_GATEWAY_SETTING_KEY = "payment_gateway";
const SUPPORTED_PAYMENT_GATEWAY_PROVIDERS = ["phonepe", "cashfree"];

const normalizeString = (value) => String(value || "").trim().toLowerCase();

const normalizeProvider = (value) => {
  const provider = normalizeString(value);
  return SUPPORTED_PAYMENT_GATEWAY_PROVIDERS.includes(provider) ? provider : "";
};

const buildGatewayProviderProfile = (provider) => {
  if (provider === "cashfree") {
    return {
      provider: "cashfree",
      label: "Cashfree",
      isCheckoutConfigured: Boolean(
        env.paymentGateway.cashfree.clientId &&
          env.paymentGateway.cashfree.clientSecret &&
          env.paymentGateway.cashfree.apiVersion,
      ),
      isWebhookConfigured: Boolean(
        env.paymentGateway.cashfree.clientSecret &&
          env.paymentGateway.cashfree.apiVersion,
      ),
    };
  }

  return {
    provider: "phonepe",
    label: "PhonePe",
    isCheckoutConfigured: Boolean(
      env.paymentGateway.phonepe.clientId &&
        env.paymentGateway.phonepe.clientVersion &&
        env.paymentGateway.phonepe.clientSecret,
    ),
    isWebhookConfigured: Boolean(
      env.paymentGateway.phonepe.webhookUsername &&
        env.paymentGateway.phonepe.webhookPassword,
    ),
  };
};

const listPaymentGatewayProviderProfiles = () =>
  SUPPORTED_PAYMENT_GATEWAY_PROVIDERS.map(buildGatewayProviderProfile);

const getConfiguredDefaultGatewayProvider = () => {
  const configuredProvider = normalizeProvider(env.paymentGateway.provider);

  if (configuredProvider) {
    return configuredProvider;
  }

  return "phonepe";
};

const getPersistedGatewayProvider = async () => {
  const setting = await findRuntimeSettingByKey(PAYMENT_GATEWAY_SETTING_KEY);
  const provider = normalizeProvider(setting?.value?.activeProvider);

  if (!provider) {
    return null;
  }

  return {
    provider,
    updatedAt: setting.updatedAt,
    updatedByStaffAccountId: setting.updatedByStaffAccountId,
  };
};

const resolveActivePaymentGatewayProvider = async () => {
  const persistedProvider = await getPersistedGatewayProvider();

  if (persistedProvider?.provider) {
    return persistedProvider.provider;
  }

  return getConfiguredDefaultGatewayProvider();
};

const assertPaymentGatewayProviderSupported = (provider) => {
  if (!normalizeProvider(provider)) {
    throw new ApiError(400, "Unsupported payment gateway provider.");
  }
};

const assertPaymentGatewayProviderConfigured = (provider) => {
  const profile = buildGatewayProviderProfile(provider);

  if (!profile.isCheckoutConfigured) {
    throw new ApiError(
      400,
      `${profile.label} checkout credentials are not configured on the server yet.`,
    );
  }

  return profile;
};

const getPaymentGatewayAdminSettings = async () => {
  const providerProfiles = listPaymentGatewayProviderProfiles();
  const persistedProvider = await getPersistedGatewayProvider();
  const activeProvider =
    persistedProvider?.provider || getConfiguredDefaultGatewayProvider();

  return {
    activeProvider,
    defaultProvider: getConfiguredDefaultGatewayProvider(),
    mode: env.paymentGateway.mode,
    providers: providerProfiles,
    updatedAt: persistedProvider?.updatedAt || null,
    updatedByStaffAccountId: persistedProvider?.updatedByStaffAccountId || null,
  };
};

const updateActivePaymentGatewayProvider = async ({
  provider,
  updatedByStaffAccountId,
}) => {
  const normalizedProvider = normalizeProvider(provider);
  assertPaymentGatewayProviderSupported(normalizedProvider);
  assertPaymentGatewayProviderConfigured(normalizedProvider);

  await upsertRuntimeSetting({
    key: PAYMENT_GATEWAY_SETTING_KEY,
    value: {
      activeProvider: normalizedProvider,
    },
    updatedByStaffAccountId,
  });

  return getPaymentGatewayAdminSettings();
};

module.exports = {
  PAYMENT_GATEWAY_SETTING_KEY,
  SUPPORTED_PAYMENT_GATEWAY_PROVIDERS,
  assertPaymentGatewayProviderConfigured,
  buildGatewayProviderProfile,
  getPaymentGatewayAdminSettings,
  resolveActivePaymentGatewayProvider,
  updateActivePaymentGatewayProvider,
};
