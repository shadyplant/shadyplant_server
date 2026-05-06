const nodemailer = require("nodemailer");
const { env } = require("../config/env");
const {
  renderGreetingsTemplate,
  renderOrderStatusTemplate,
  renderOffersTemplate,
  renderOtpTemplate,
  templateRenderers,
} = require("../email-templates");

const normalizeRecipients = (to) => {
  if (Array.isArray(to)) {
    return to.map((value) => String(value || "").trim()).filter(Boolean);
  }

  return [String(to || "").trim()].filter(Boolean);
};

const formatFromAddress = () => {
  const fromEmail = env.mailer.aliasUser || env.mailer.fromEmail;

  if (!env.mailer.fromName) {
    return fromEmail;
  }

  return `${env.mailer.fromName} <${fromEmail}>`;
};

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!env.mailer.hasSmtpConfig) {
    throw new Error(
      "Mailer SMTP host and port are required when MAILER_TRANSPORT is smtp.",
    );
  }

  transporter = nodemailer.createTransport({
    host: env.mailer.host,
    port: env.mailer.port,
    secure: env.mailer.secure,
    auth: env.mailer.hasSmtpCredentials
      ? {
          user: env.mailer.user,
          pass: env.mailer.pass,
        }
      : undefined,
  });

  return transporter;
};

const renderTemplateMessage = (templateName, payload) => {
  const renderTemplate = templateRenderers[templateName];

  if (!renderTemplate) {
    throw new Error(`Unknown email template: ${templateName}`);
  }

  return renderTemplate(payload);
};

const normalizeAttachments = (attachments) => {
  if (!Array.isArray(attachments)) {
    return [];
  }

  return attachments
    .map((attachment) => {
      if (!attachment || typeof attachment !== "object") {
        return null;
      }

      const filename = String(attachment.filename || "").trim();

      if (!filename) {
        return null;
      }

      return {
        filename,
        content: attachment.content,
        contentType: attachment.contentType
          ? String(attachment.contentType).trim()
          : undefined,
        encoding: attachment.encoding
          ? String(attachment.encoding).trim()
          : undefined,
        path: attachment.path ? String(attachment.path).trim() : undefined,
      };
    })
    .filter(Boolean);
};

const sendEmail = async ({
  to,
  subject,
  html,
  text,
  tags = [],
  metadata = {},
  attachments = [],
}) => {
  const recipients = normalizeRecipients(to);

  if (!recipients.length) {
    throw new Error("Email recipient is required.");
  }

  const message = {
    from: formatFromAddress(),
    replyTo: env.mailer.replyTo || undefined,
    to: recipients,
    subject: String(subject || "").trim(),
    html: String(html || "").trim(),
    text: String(text || "").trim(),
    tags,
    metadata,
    attachments: normalizeAttachments(attachments),
  };

  if (!message.subject) {
    throw new Error("Email subject is required.");
  }

  if (!message.html && !message.text) {
    throw new Error("Email body is required.");
  }

  if (!env.mailer.isEnabled) {
    return {
      delivered: false,
      skipped: true,
      transport: env.mailer.transport,
      message,
    };
  }

  if (env.mailer.transport === "log") {
    console.info("[Mailer] Email preview", {
      to: recipients,
      subject: message.subject,
      tags,
      metadata,
      attachments: message.attachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType || null,
      })),
    });

    return {
      delivered: true,
      skipped: false,
      transport: env.mailer.transport,
      message,
    };
  }

  if (env.mailer.transport === "smtp") {
    const smtpTransporter = getTransporter();
    const info = await smtpTransporter.sendMail({
      from: message.from,
      replyTo: message.replyTo,
      to: message.to.join(", "),
      subject: message.subject,
      html: message.html || undefined,
      text: message.text || undefined,
      headers: tags.length
        ? {
            "X-Email-Tags": tags.join(","),
          }
        : undefined,
      attachments: message.attachments.length ? message.attachments : undefined,
    });

    return {
      delivered: true,
      skipped: false,
      transport: env.mailer.transport,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      message,
    };
  }

  throw new Error(`Unsupported mailer transport: ${env.mailer.transport}`);
};

const sendTemplateEmail = async ({
  to,
  templateName,
  payload = {},
  tags = [],
  metadata = {},
}) => {
  const templateMessage = renderTemplateMessage(templateName, payload);

  return sendEmail({
    to,
    subject: templateMessage.subject,
    html: templateMessage.html,
    text: templateMessage.text,
    tags: [templateName, ...tags],
    metadata,
  });
};

const sendGreetingEmail = async ({ to, ...payload }) =>
  sendTemplateEmail({
    to,
    templateName: "greetings",
    payload,
    tags: ["greetings"],
  });

const sendOtpEmail = async ({ to, ...payload }) =>
  sendTemplateEmail({
    to,
    templateName: "otp",
    payload,
    tags: ["otp"],
  });

const sendOfferEmail = async ({ to, ...payload }) =>
  sendTemplateEmail({
    to,
    templateName: "offers",
    payload,
    tags: ["offers"],
  });

const sendOrderStatusEmail = async ({ to, ...payload }) =>
  sendTemplateEmail({
    to,
    templateName: "orderStatus",
    payload,
    tags: ["order-status"],
  });

module.exports = {
  renderGreetingsTemplate,
  renderOrderStatusTemplate,
  renderOffersTemplate,
  renderOtpTemplate,
  renderTemplateMessage,
  sendEmail,
  sendGreetingEmail,
  sendOrderStatusEmail,
  sendOfferEmail,
  sendOtpEmail,
  sendTemplateEmail,
};
