const {
  createEmailLayout,
  escapeHtml,
  formatTextSections,
} = require("./template.utils");

const renderOtpTemplate = ({
  customerName = "there",
  otp,
  purpose = "verification",
  expiresInMinutes = 10,
} = {}) => {
  const safeCustomerName = customerName.trim() || "there";
  const safeOtp = String(otp || "").trim();
  const safePurpose = purpose.trim() || "verification";
  const safeExpiry = Number.isFinite(Number(expiresInMinutes))
    ? Number(expiresInMinutes)
    : 10;

  if (!safeOtp) {
    throw new Error("OTP template requires an otp value.");
  }

  return {
    subject: `Your ${safePurpose} OTP`,
    html: createEmailLayout({
      title: `Your ${safePurpose} OTP`,
      previewText: `Use ${safeOtp} to complete your ${safePurpose}.`,
      eyebrow: "One-Time Password",
      intro: `Hi ${safeCustomerName},`,
      bodyHtml: `
        <p style="margin:0 0 16px;font-size:16px;line-height:1.7;">
          Use the code below to complete your ${escapeHtml(safePurpose)}.
        </p>
        <div style="margin:0 0 18px;padding:18px 20px;border-radius:14px;background:#eff8f1;border:1px solid #cfe8d3;text-align:center;">
          <div style="font-size:30px;letter-spacing:8px;font-weight:700;color:#1f6b3a;">
            ${escapeHtml(safeOtp)}
          </div>
        </div>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#52606d;">
          This OTP expires in ${escapeHtml(String(safeExpiry))} minutes. Do not share it with anyone.
        </p>
      `,
      footer: "If you did not request this OTP, you can ignore this email.",
    }),
    text: formatTextSections([
      `Your ${safePurpose} OTP`,
      `Hi ${safeCustomerName},`,
      `Use this code to complete your ${safePurpose}: ${safeOtp}`,
      `This OTP expires in ${safeExpiry} minutes.`,
      "If you did not request this OTP, you can ignore this email.",
    ]),
  };
};

module.exports = { renderOtpTemplate };
