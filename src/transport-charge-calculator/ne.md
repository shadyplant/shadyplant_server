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
