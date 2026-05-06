const { env } = require("../config/env");
const {
  createEmailLayout,
  escapeHtml,
  formatTextSections,
} = require("./template.utils");

const ORDER_STATUS_CONTENT = {
  confirmed: {
    eyebrow: "Order confirmed",
    heading: "Your order is confirmed",
    preview: "Your order has been confirmed and moved into fulfillment.",
    message:
      "We have reviewed your order and moved it into active fulfillment. Our nursery team is preparing the next steps for dispatch.",
    nextStep:
      "We will email you again as soon as your order moves to shipping.",
  },
  shipped: {
    eyebrow: "Order shipped",
    heading: "Your order is on the move",
    preview: "Your order has moved into shipping.",
    message:
      "Your order has progressed to shipping. Transport planning and dispatch updates are now active for this order.",
    nextStep:
      "We will keep you posted when the driver is out for delivery.",
  },
  out_for_delivery: {
    eyebrow: "Out for delivery",
    heading: "Your order is out for delivery",
    preview: "Your order is on the final route to your address.",
    message:
      "Your order is now on the final route to your address. Please keep your phone available in case the delivery team needs to coordinate.",
    nextStep:
      "A final confirmation will be sent once the delivery is completed.",
  },
  delivered: {
    eyebrow: "Order delivered",
    heading: "Your order has been delivered",
    preview: "Your order has been delivered successfully.",
    message:
      "Your order has been marked as delivered successfully. We hope everything arrived in excellent condition.",
    nextStep:
      "If you have a moment, we would love your feedback on the order experience.",
  },
};

const formatDeliveryDate = (value) => {
  if (!value) {
    return "To be confirmed";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAddress = (deliveryAddress = {}) =>
  [
    deliveryAddress.line1,
    deliveryAddress.line2,
    deliveryAddress.city,
    deliveryAddress.state,
    deliveryAddress.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

const formatBillingAddress = (billingDetails = {}) =>
  [
    billingDetails.address,
    billingDetails.city,
    billingDetails.state,
  ]
    .filter(Boolean)
    .join(", ");

const formatAmount = (value) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const renderMetaRow = (label, value) => `
  <tr>
    <td style="padding:0 0 10px;color:#6b7280;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:0 0 10px;color:#1f2933;font-size:14px;text-align:right;">
      ${escapeHtml(value)}
    </td>
  </tr>
`;

const renderOrderStatusTemplate = ({
  customerName = "there",
  status = "confirmed",
  orderNumber = "",
  trackingCode = "",
  deliveryDate = "",
  deliveryAddress = {},
  billingDetails = {},
  paymentMethodLabel = "",
  paymentStatusLabel = "",
  totalAmount = 0,
  itemSummary = "",
} = {}) => {
  const template =
    ORDER_STATUS_CONTENT[String(status || "").trim().toLowerCase()] ||
    ORDER_STATUS_CONTENT.confirmed;
  const safeCustomerName = String(customerName || "").trim() || "there";
  const safeOrderNumber = String(orderNumber || "").trim();
  const safeTrackingCode = String(trackingCode || "").trim();
  const safeItemSummary = String(itemSummary || "").trim();
  const safeAddress = formatAddress(deliveryAddress);
  const safeBillingAddress = formatBillingAddress(billingDetails);
  const safeDeliveryDate = formatDeliveryDate(deliveryDate);
  const safeBillingName = String(billingDetails.name || "").trim();
  const safeBillingContact = String(billingDetails.contact || "").trim();
  const safeBillingEmail = String(billingDetails.email || "").trim();
  const safeBillingGstin = String(billingDetails.gstin || "").trim();
  const safePaymentMethod = String(paymentMethodLabel || "").trim();
  const safePaymentStatus = String(paymentStatusLabel || "").trim();
  const safeTotalAmount =
    Number(totalAmount || 0) > 0 ? `INR ${formatAmount(totalAmount)}` : "";

  const summaryTable = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;padding:20px;border:1px solid #e5eadf;border-radius:16px;background:#f8fbf5;">
      ${renderMetaRow("Order", safeOrderNumber || "Pending assignment")}
      ${safeTrackingCode ? renderMetaRow("Tracking code", safeTrackingCode) : ""}
      ${safeItemSummary ? renderMetaRow("Items", safeItemSummary) : ""}
      ${safeTotalAmount ? renderMetaRow("Total", safeTotalAmount) : ""}
      ${safePaymentMethod ? renderMetaRow("Payment method", safePaymentMethod) : ""}
      ${safePaymentStatus ? renderMetaRow("Payment status", safePaymentStatus) : ""}
      ${renderMetaRow("Delivery target", safeDeliveryDate)}
      ${safeAddress ? renderMetaRow("Address", safeAddress) : ""}
    </table>
  `;

  const billingTable =
    safeBillingName ||
    safeBillingContact ||
    safeBillingEmail ||
    safeBillingGstin ||
    safeBillingAddress
      ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 0;padding:20px;border:1px solid #e5eadf;border-radius:16px;background:#ffffff;">
          ${safeBillingName ? renderMetaRow("Billing name", safeBillingName) : ""}
          ${safeBillingContact ? renderMetaRow("Billing contact", safeBillingContact) : ""}
          ${safeBillingEmail ? renderMetaRow("Billing email", safeBillingEmail) : ""}
          ${safeBillingGstin ? renderMetaRow("GSTIN", safeBillingGstin) : ""}
          ${safeBillingAddress ? renderMetaRow("Billing address", safeBillingAddress) : ""}
        </table>
      `
      : "";

  return {
    subject: `${template.heading} • ${safeOrderNumber || env.appName}`,
    html: createEmailLayout({
      title: template.heading,
      previewText: template.preview,
      eyebrow: template.eyebrow,
      intro: `Hi ${safeCustomerName},`,
      bodyHtml: `
        <p style="margin:0;font-size:16px;line-height:1.7;">
          ${escapeHtml(template.message)}
        </p>
        ${summaryTable}
        ${billingTable}
        <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#44515c;">
          ${escapeHtml(template.nextStep)}
        </p>
      `,
      footer: `This update was sent by ${env.appName}. If you need help, reply to this email and our team will assist you.`,
    }),
    text: formatTextSections([
      template.heading,
      `Hi ${safeCustomerName},`,
      template.message,
      safeOrderNumber ? `Order: ${safeOrderNumber}` : "",
      safeTrackingCode ? `Tracking code: ${safeTrackingCode}` : "",
      safeItemSummary ? `Items: ${safeItemSummary}` : "",
      safeTotalAmount ? `Total: ${safeTotalAmount}` : "",
      safePaymentMethod ? `Payment method: ${safePaymentMethod}` : "",
      safePaymentStatus ? `Payment status: ${safePaymentStatus}` : "",
      `Delivery target: ${safeDeliveryDate}`,
      safeAddress ? `Address: ${safeAddress}` : "",
      safeBillingName ? `Billing name: ${safeBillingName}` : "",
      safeBillingContact ? `Billing contact: ${safeBillingContact}` : "",
      safeBillingEmail ? `Billing email: ${safeBillingEmail}` : "",
      safeBillingGstin ? `GSTIN: ${safeBillingGstin}` : "",
      safeBillingAddress ? `Billing address: ${safeBillingAddress}` : "",
      template.nextStep,
      `This update was sent by ${env.appName}.`,
    ]),
  };
};

module.exports = { renderOrderStatusTemplate };
