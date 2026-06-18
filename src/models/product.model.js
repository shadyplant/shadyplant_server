const mongoose = require("mongoose");

const productOptionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
      default: "",
    },
    unit: {
      type: String,
      trim: true,
      default: "",
    },
    value: {
      type: Number,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      min: 0,
      default: null,
    },
    mrp: {
      type: Number,
      min: 0,
      default: null,
    },
    stock: {
      type: Number,
      min: 0,
      default: null,
    },
    packLabel: {
      type: String,
      trim: true,
      default: "",
    },
    weight: {
      type: Number,
      min: 0,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
    id: false,
  },
);

const productOptionGroupSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    guideLabel: {
      type: String,
      trim: true,
      default: "",
    },
    options: {
      type: [productOptionSchema],
      default: undefined,
    },
  },
  {
    _id: false,
    id: false,
  },
);

const productVideoClipSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    poster: {
      type: String,
      trim: true,
      default: "",
    },
    src: {
      type: String,
      trim: true,
      default: "",
    },
    views: {
      type: String,
      trim: true,
      default: "",
    },
    products: {
      type: Number,
      min: 0,
      default: null,
    },
    isVideo: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
    id: false,
  },
);

const productDetailSectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
    id: false,
  },
);

const productSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    productId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      default: null,
    },
    skuId: {
      type: String,
      trim: true,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    variety: {
      type: String,
      trim: true,
      default: "",
    },
    containerSize: {
      type: String,
      trim: true,
      default: "",
    },
    height: {
      type: String,
      trim: true,
      default: "",
    },
    brand: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    mrp: {
      type: Number,
      min: 0,
      default: null,
    },
    weight: {
      type: Number,
      required: true,
      min: 0.01,
    },
    offer: {
      type: String,
      trim: true,
      default: "",
    },
    minOrderQuantity: {
      type: Number,
      min: 1,
      default: 1,
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
    },
    isOnTrend: {
      type: Boolean,
      default: false,
    },
    isFeaturedLatest: {
      type: Boolean,
      default: false,
    },
    packLabel: {
      type: String,
      required: true,
      trim: true,
    },
    variant: {
      type: String,
      trim: true,
      default: "",
    },
    unit: {
      type: String,
      required: true,
      trim: true,
    },
    badge: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    images: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: undefined,
    },
    usesImages: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: undefined,
    },
    tags: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: undefined,
    },
    optionGroups: {
      type: [productOptionGroupSchema],
      default: undefined,
    },
    videoClips: {
      type: [productVideoClipSchema],
      default: undefined,
    },
    detailSections: {
      type: [productDetailSectionSchema],
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

productSchema.index({ category: 1 });
productSchema.index(
  { sku: 1 },
  {
    unique: true,
    sparse: true,
  },
);
productSchema.index(
  { skuId: 1 },
  {
    unique: true,
    sparse: true,
  },
);
productSchema.index({ status: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ badge: 1 });
productSchema.index({ isOnTrend: 1 });
productSchema.index({ isFeaturedLatest: 1 });
productSchema.index({ stock: 1 });
productSchema.index({ tags: 1 });
productSchema.index({
  name: "text",
  category: "text",
  badge: "text",
  description: "text",
  tags: "text",
});

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

module.exports = { Product };
