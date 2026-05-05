const { env } = require("../config/env");
const {
  createEmailLayout,
  escapeHtml,
  formatTextSections,
} = require("./template.utils");

const renderGreetingsTemplate = ({
  customerName = "there",
  heading = `Welcome to ${env.appName}`,
  message = "We're glad to have you with us. Fresh plants, better spaces, and greener days are on the way.",
  ctaLabel = "",
  ctaUrl = "",
  footerNote = "Thanks for growing with us.",
} = {}) => {
  const safeCustomerName = customerName.trim() || "there";
  const safeHeading = heading.trim() || `Welcome to ${env.appName}`;
  const safeMessage = message.trim();
  const safeCtaLabel = ctaLabel.trim();
  const safeCtaUrl = ctaUrl.trim();
  const safeFooterNote = footerNote.trim() || "Thanks for growing with us.";

  const ctaHtml =
    safeCtaLabel && safeCtaUrl
      ? `<p style="margin:24px 0 0;">
          <a href="${escapeHtml(safeCtaUrl)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#1f6b3a;color:#ffffff;text-decoration:none;font-weight:700;">
            ${escapeHtml(safeCtaLabel)}
          </a>
        </p>`
      : "";

  return {
    subject: safeHeading,
    html: createEmailLayout({
      title: safeHeading,
      previewText: `${safeHeading} for ${safeCustomerName}`,
      eyebrow: "Greeting",
      intro: `Hi ${safeCustomerName},`,
      bodyHtml: `
        <p style="margin:0;font-size:16px;line-height:1.7;">
          ${escapeHtml(safeMessage)}
        </p>
        ${ctaHtml}
      `,
      footer: safeFooterNote,
    }),
    text: formatTextSections([
      safeHeading,
      `Hi ${safeCustomerName},`,
      safeMessage,
      safeCtaLabel && safeCtaUrl ? `${safeCtaLabel}: ${safeCtaUrl}` : "",
      safeFooterNote,
    ]),
  };
};

module.exports = { renderGreetingsTemplate };
