const axios = require("axios");

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Verify Webhook
 */
exports.verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WhatsApp Webhook Verified");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

/**
 * Receive Incoming Messages
 */
exports.receiveWebhook = async (req, res) => {
  try {
    console.log(
      "Incoming Webhook:",
      JSON.stringify(req.body, null, 2)
    );

    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      return res.sendStatus(200);
    }

    const message = value.messages[0];
    const from = message.from;

    let incomingText = "";

    if (message.type === "text") {
      incomingText = message.text.body;
    }

    console.log(`Message from ${from}: ${incomingText}`);

    // Auto Reply
    await sendTextMessage(
      from,
      `Hello 👋\n\nYou said:\n"${incomingText}"\n\nWelcome to ShadyPlant 🌿`
    );

    res.sendStatus(200);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.sendStatus(500);
  }
};

/**
 * Send Text Message
 */
async function sendTextMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: {
        body: text,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}