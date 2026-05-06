const { env } = require("../config/env");
const { sendEmail } = require("../mailer");

const recipient = String(process.argv[2] || "azmirulhoque93@gmail.com").trim();

const maskValue = (value, visibleStart = 2, visibleEnd = 2) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "(empty)";
  }

  if (normalizedValue.length <= visibleStart + visibleEnd) {
    return "*".repeat(normalizedValue.length);
  }

  return `${normalizedValue.slice(0, visibleStart)}${"*".repeat(
    Math.max(4, normalizedValue.length - (visibleStart + visibleEnd)),
  )}${normalizedValue.slice(-visibleEnd)}`;
};

async function main() {
  if (!recipient) {
    throw new Error("Recipient email is required.");
  }

  console.info("[Mailer Test] Starting email test with current environment.");
  console.info("[Mailer Test] Transport:", env.mailer.transport);
  console.info("[Mailer Test] From name:", env.mailer.fromName || "(empty)");
  console.info("[Mailer Test] From email:", env.mailer.fromEmail || "(empty)");
  console.info("[Mailer Test] Alias user:", env.mailer.aliasUser || "(empty)");
  console.info("[Mailer Test] Reply-to:", env.mailer.replyTo || "(empty)");
  console.info("[Mailer Test] Host:", env.mailer.host || "(empty)");
  console.info("[Mailer Test] Port:", env.mailer.port);
  console.info("[Mailer Test] Secure:", env.mailer.secure);
  console.info("[Mailer Test] SMTP user:", maskValue(env.mailer.user));
  console.info(
    "[Mailer Test] SMTP password:",
    env.mailer.pass ? `${"*".repeat(10)} (${env.mailer.pass.length} chars)` : "(empty)",
  );
  console.info("[Mailer Test] Recipient:", recipient);

  const timestamp = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const result = await sendEmail({
    to: recipient,
    subject: `${env.appName} mailer test`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f4f8f2;padding:24px;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3ebd8;">
          <div style="background:#1f6b3a;color:#ffffff;padding:22px 28px;">
            <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.84;">Mailer Test</div>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.25;">SMTP configuration is working</h1>
          </div>
          <div style="padding:28px;color:#1f2933;">
            <p style="margin:0 0 14px;font-size:16px;line-height:1.7;">
              This is a direct test email sent from the backend mail service for <strong>${env.appName}</strong>.
            </p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#4b5563;">
              Sent at: <strong>${timestamp}</strong>
            </p>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#4b5563;">
              If you received this email, the current SMTP settings are functional.
            </p>
          </div>
        </div>
      </div>
    `,
    text: [
      `${env.appName} mailer test`,
      `Sent at: ${timestamp}`,
      "If you received this email, the current SMTP settings are functional.",
    ].join("\n\n"),
    tags: ["mailer-test"],
    metadata: {
      script: "src/scripts/test-mailer.js",
    },
  });

  console.info("[Mailer Test] Result:", JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(
    "[Mailer Test] Failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
