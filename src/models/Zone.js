// models/Zone.js
import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: ["Plain", "Mixed", "Hill"] },
  serviceable: Boolean,
  truckAccess: Boolean,
  rate: Number,
  polygon: {
    type: { type: String, enum: ["Polygon"], default: "Polygon" },
    coordinates: [[[Number]]], // GeoJSON
  },
});

zoneSchema.index({ polygon: "2dsphere" });

export default mongoose.model("Zone", zoneSchema);
