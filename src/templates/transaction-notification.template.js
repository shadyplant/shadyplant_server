const TRANSACTION_NOTIFICATION_CONTENT = {
  placed: {
    title: "Order placed",
    message: "Your order has been placed successfully. We will keep you updated.",
    icon: "package",
  },
  confirmed: {
    title: "Order confirmed",
    message: "Your order is confirmed and moving into fulfillment.",
    icon: "box",
  },
  shipped: {
    title: "Order shipped",
    message: "Your order has been shipped and is moving toward delivery.",
    icon: "truck",
  },
  out_for_delivery: {
    title: "Out for delivery",
    message: "Your order is out for delivery. Please keep your phone available.",
    icon: "truck",
  },
  delivered: {
    title: "Delivered",
    message: "Your order has been delivered successfully.",
    icon: "check",
  },
  cancelled: {
    title: "Order cancelled",
    message: "Your order has been cancelled by the team.",
    icon: "cancel",
  },
  refunded: {
    title: "Refund processed",
    message: "Your refund has been processed successfully.",
    icon: "refund",
  },
};

function normalizeString(value) {
  return String(value || "").trim();
}

function buildOrderPreviewImage(order = {}) {
  const orderItems = Array.isArray(order.orderItems) ? order.orderItems : [];

  for (const item of orderItems) {
    const nextImage =
      normalizeString(item.image) ||
      (Array.isArray(item.images) ? normalizeString(item.images[0]) : "");

    if (nextImage) {
      return nextImage;
    }
  }

  return "";
}

function getTransactionNotificationTemplate(order = {}, status = "") {
  const normalizedStatus = normalizeString(status || order.currentStatus).toLowerCase();
  const content =
    TRANSACTION_NOTIFICATION_CONTENT[normalizedStatus] ||
    TRANSACTION_NOTIFICATION_CONTENT.placed;
  const orderNumber = normalizeString(order.orderNumber);
  const previewImage = buildOrderPreviewImage(order);
  const itemCount = Array.isArray(order.orderItems) ? order.orderItems.length : 0;
  const orderTotal = Number(order?.pricing?.total || 0);

  return {
    status: normalizedStatus,
    type: "order_status",
    title: orderNumber ? `${content.title} - #${orderNumber}` : content.title,
    message: content.message,
    icon: content.icon,
    imageUrl: previewImage,
    href: order?.id ? `/order/${encodeURIComponent(order.id)}` : "",
    actionLabel: "View order",
    metadata: {
      orderId: normalizeString(order.id),
      orderNumber,
      status: normalizedStatus,
      itemCount,
      orderTotal: Number.isFinite(orderTotal) ? orderTotal : 0,
      previewImage,
    },
  };
}

module.exports = {
  TRANSACTION_NOTIFICATION_CONTENT,
  getTransactionNotificationTemplate,
};
