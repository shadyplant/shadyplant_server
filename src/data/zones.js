// zones.js

export const zones = [
  {
    name: "Bongaigaon Plain",
    type: "Plain",
    serviceable: true,
    truckAccess: true,
    rate: 10,
    polygon: [
      [90.5, 26.45],
      [90.6, 26.45],
      [90.6, 26.55],
      [90.5, 26.55],
      [90.5, 26.45],
    ],
  },
  {
    name: "Abhayapuri Mixed",
    type: "Mixed",
    serviceable: true,
    truckAccess: true,
    rate: 13,
    polygon: [
      [90.6, 26.3],
      [90.75, 26.3],
      [90.75, 26.45],
      [90.6, 26.45],
      [90.6, 26.3],
    ],
  },
  {
    name: "Hill Area",
    type: "Hill",
    serviceable: true,
    truckAccess: false,
    rate: 20,
    polygon: [
      [90.75, 26.3],
      [90.9, 26.3],
      [90.9, 26.45],
      [90.75, 26.45],
      [90.75, 26.3],
    ],
  },
  {
    name: "Restricted Zone",
    type: "Hill",
    serviceable: false,
    truckAccess: false,
    rate: 0,
    polygon: [
      [90.45, 26.3],
      [90.5, 26.3],
      [90.5, 26.35],
      [90.45, 26.35],
      [90.45, 26.3],
    ],
  },
];
