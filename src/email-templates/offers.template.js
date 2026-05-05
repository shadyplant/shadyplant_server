const { env } = require("../config/env");
const {
  createEmailLayout,
  escapeHtml,
  formatTextSections,
} = require("./template.utils");

const renderOffersTemplate = ({
  customerName = "there",
  headline = `Fresh offers from ${env.appName}`,
  offerTitle = "Seasonal nursery specials",
  offerDescription = "Explore this week's handpicked plant offers and garden bundles.",
  couponCode = "",
  validUntil = "",
  ctaLabel = "Browse offers",
  ctaUrl = "",
} = {}) => {
  const safeCustomerName = customerName.trim() || "there";
  const safeHeadline = headline.trim() || `Fresh offers from ${env.appName}`;
  const safeOfferTitle = offerTitle.trim() || "Seasonal nursery specials";
  const safeOfferDescription = offerDescription.trim();
  const safeCouponCode = couponCode.trim();
  const safeValidUntil = validUntil.trim();
  const safeCtaLabel = ctaLabel.trim() || "Browse offers";
  const safeCtaUrl = ctaUrl.trim();

  const couponHtml = safeCouponCode
    ? `<div style="margin:18px 0 0;padding:14px 16px;border-radius:12px;background:#fff7e6;border:1px solid #f0d9a7;">
         <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#8d5e00;">Coupon code</div>
         <div style="margin-top:8px;font-size:24px;font-weight:700;color:#7a4f01;">${escapeHtml(safeCouponCode)}</div>
       </div>`
    : "";

  const ctaHtml = safeCtaUrl
    ? `<p style="margin:24px 0 0;">
         <a href="${escapeHtml(safeCtaUrl)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#1f6b3a;color:#ffffff;text-decoration:none;font-weight:700;">
           ${escapeHtml(safeCtaLabel)}
         </a>
       </p>`
    : "";

  return {
    subject: safeHeadline,
    html: createEmailLayout({
      title: safeHeadline,
      previewText: safeOfferTitle,
      eyebrow: "Offers",
      intro: `Hi ${safeCustomerName},`,
      bodyHtml: `
        <div style="padding:20px;border-radius:16px;background:#f9fbf7;border:1px solid #dcead9;">
          <h2 style="margin:0 0 10px;font-size:22px;line-height:1.35;color:#1f2933;">
            ${escapeHtml(safeOfferTitle)}
          </h2>
          <p style="margin:0;font-size:16px;line-height:1.7;color:#52606d;">
            ${escapeHtml(safeOfferDescription)}
          </p>
          ${couponHtml}
          ${
            safeValidUntil
              ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#7b8794;">
                   Valid until ${escapeHtml(safeValidUntil)}.
                 </p>`
              : ""
          }
        </div>
        ${ctaHtml}
      `,
      footer: "You received this message because you subscribed to Grass Green Nursery updates.",
    }),
    text: formatTextSections([
      safeHeadline,
      `Hi ${safeCustomerName},`,
      safeOfferTitle,
      safeOfferDescription,
      safeCouponCode ? `Coupon code: ${safeCouponCode}` : "",
      safeValidUntil ? `Valid until: ${safeValidUntil}` : "",
      safeCtaUrl ? `${safeCtaLabel}: ${safeCtaUrl}` : "",
    ]),
  };
};

module.exports = { renderOffersTemplate };
