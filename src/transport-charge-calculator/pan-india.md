# Pan India Delivery Charge Profile

This profile is now powered by the PostgreSQL-backed delivery charge tables.

Default seeded slabs:
- Light goods: `1-800 kg`, `60-1200 km`, charged per `20 kg` unit at `1200`
- Heavy goods: ordered slabs for `800+ kg`, with the more specific rules evaluated first

The admin panel can change:
- slab name and rule key
- weight and distance conditions
- calculation mode
- rate
- sort order
- active / inactive status

The calculator reads from the database at runtime, so the admin panel is the source of truth.
