# North East Delivery Charge Profile

This profile is now powered by the PostgreSQL-backed delivery charge tables.

Default seeded slabs:
- Light goods: `1-800 kg`, `60-1200 km`, charged per `20 kg` unit at `1200`
- Heavy goods: ordered slabs for `800+ kg`, with the more specific rules evaluated first

The admin panel can manage the same slab fields as Pan India:
- conditions
- calculation mode
- rate
- position
- active status

This keeps the delivery charge rules organized, scalable, and editable without touching code.



------------------------------------------------------------------------------------------------------------------
- `Never delete Delete this file or modify , This code for Backup Delivery Charge Calc func for NORTH EAST INDIA `
------------------------------------------------------------------------------------------------------------------


// Calculate the transport charge for the North East region of India based on weight and distance.
// ───────────────────────────────────────────────────────────────────────────────
//  Meghalaya, Mizoram, Nagaland, Tripura, Arunachal Pradesh, Manipur, Sikkim
// ───────────────────────────────────────────────────────────────────────────────
const {
  calculateTransportChargeForProfile,
} = require("./delivery-charge");

function calculateTransportChargeForNorthEast(weight, distance) {

  console.log("Calculating transport charge for North East region:", { weight, distance });
  // ─── Input type guard ───────────────────────────────────────────────────────
  if (
    typeof weight !== "number" ||
    typeof distance !== "number" ||
    isNaN(weight) ||
    isNaN(distance)
  ) {
    return {
      success: false,
      message:
        "Warn: Sorry Invalid Location or Quantity — weight and distance must be numeric values.",
    };
  }
  // ─── Step 1: Validate location (distance) and quantity (weight) ─────────────
  // Mirrors the flowchart node: "If location valid && quantity > 0"
  if (weight <= 0 || distance <= 0) {
    return {
      success: false,
      message: "Warn: Sorry Invalid Location or Quantity",
    };
  }
  // ─── Step 2: Light-goods path ────────────────────────────────────────────────
  // Weight: 1 – 800 kg  |  Distance: 60 – 1200 km
  if (weight >= 1 && weight <= 800) {
    if (distance < 60 || distance > 1200) {
      return {
        success: false,
        message: `Warn! Distance Out Of Range — for weight ${weight} kg (light goods: 1–800 kg), distance must be 60–1200 km. Provided: ${distance} km.`,
      };
    }
    /**
     * Cost formula (from flowchart):
     *   X    = ceil(W / 20)   → number of 20-kg units, always rounded UP
     *   COST = X * Base       → Base is the per-unit cost (rate per km here)
     */
    const BASE_PRICE = 1200; // ₹ per km per unit-of-20kg
    const units = Math.ceil(weight / 20);
    const cost = units * BASE_PRICE;
    return {
      success: true,
      cost,
      rate: BASE_PRICE,
      message: `Response Done — Light goods: ${units} unit(s) × ₹${BASE_PRICE} = ₹${cost}`,
    };
  }
  // ─── Step 3: Heavy-goods path ────────────────────────────────────────────────
  // Weight: 800 – 12500 kg  |  Distance: 60 – 750 km  (outer boundary check)
  if (weight > 800 && weight <= 12500) {
    if (distance < 60 || distance > 750) {
      return {
        success: false,
        message: `Warn! Distance Out Of Range — for weight ${weight} kg (heavy goods: 801–12500 kg), distance must be 60–750 km. Provided: ${distance} km.`,
      };
    }
    let ratePerKm = null;
    // Weight bracket waterfall (highest first, matching flowchart cascade)
  if (weight > 7500 && weight <= 12500) {
      ratePerKm = 96;
    } else if (weight > 5000 && weight <= 7500) {
      ratePerKm = 80;
    } else if (weight > 2500 && weight <= 5000) {
      ratePerKm = 69;
    } else if (weight > 1500 && weight <= 2500 && distance >=60 && distance <=300) {
      ratePerKm = 42;
    }else if(weight > 800 && weight <=2500){
      ratePerKm = 53;
    }
    if (ratePerKm !== null) {
      const cost = ratePerKm * distance;
      return {
        success: true,
        cost,
        rate: ratePerKm,
        message: `Response Done — Rate ₹${ratePerKm}/km × ${distance} km = ₹${cost}`,
      };
    }
  }
  // ─── Step 4: Out-of-range fallback ──────────────────────────────────────────
  // Reached only when weight itself is out of all valid brackets (>12500 kg).
  return {
    success: false,
    message: `Warn! Weight Out Of Range — valid range is 1–12500 kg. Provided: ${weight} kg.`,
  };
}
const calculateTransportChargeForNorthEast = (weight, distance) =>
  calculateTransportChargeForProfile("north_east", weight, distance);

module.exports = {
  calculateTransportChargeForNorthEast,
};