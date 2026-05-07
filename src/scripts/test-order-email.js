const { env } = require("../config/env");
const { sendOrderStatusEmail } = require("../mailer");

const recipient = String(
  process.argv[2] || "anisalomgirhassan@gmail.com",
).trim();

async function main() {
  if (!recipient) {
    throw new Error("Recipient email is required.");
  }

  const timestamp = new Date();
  const deliveryDate = new Date(timestamp.getTime() + 2 * 24 * 60 * 60 * 1000);

  console.info("[Order Mail Test] Starting order status email test.");
  console.info("[Order Mail Test] Transport:", env.mailer.transport);
  console.info("[Order Mail Test] Recipient:", recipient);

  const result = await sendOrderStatusEmail({
    to: recipient,
    customerName: "Anis Alomgir Hassan",
    status: "confirmed",
    orderNumber: "GGN-TEST-ORDER-001",
    trackingCode: "GGNTRACKTEST001",
    deliveryDate: deliveryDate.toISOString(),
    deliveryAddress: {
      line1: "House 12, Green Lane",
      line2: "Near Nursery Gate",
      city: "Guwahati",
      state: "Assam",
      postalCode: "781001",
      landmark: "Main Road",
    },
    billingDetails: {
      name: "Anis Alomgir Hassan",
      contact: "+91 6001518547",
      email: recipient,
      address: "House 12, Green Lane",
      city: "Guwahati",
      state: "Assam",
      gstin: "",
    },
    paymentMethodLabel: "Online payment",
    paymentStatusLabel: "Paid online",
    totalAmount: 25176,
    itemSummary: "Red Hibiscus x 24",
  });

  console.info("[Order Mail Test] Result:", JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(
    "[Order Mail Test] Failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
