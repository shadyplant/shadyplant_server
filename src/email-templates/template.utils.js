const { env } = require("../config/env");

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createEmailLayout = ({
  title,
  previewText,
  eyebrow,
  intro,
  bodyHtml,
  footer = env.appName,
}) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f8f2;font-family:Arial,sans-serif;color:#1f2933;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(previewText || title)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:20px 28px;background:#1f6b3a;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:0.82;">
            ${escapeHtml(eyebrow || env.appName)}
          </div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.25;">
            ${escapeHtml(title)}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;">
            ${escapeHtml(intro)}
          </p>
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;background:#f7faf7;color:#52606d;font-size:13px;line-height:1.6;">
          ${escapeHtml(footer)}
        </td>
      </tr>
    </table>
  </body>
</html>`;

const formatTextSections = (sections) =>
  sections
    .filter(Boolean)
    .map((section) => String(section).trim())
    .join("\n\n");

module.exports = {
  createEmailLayout,
  escapeHtml,
  formatTextSections,
};
