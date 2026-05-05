# GRASS_GREEN_NURSERY Database Architecture

## Current Local Stack

The backend now uses the database split described in the project plan:

- PostgreSQL: users, sessions, orders, payment attempts
- Redis: OTP storage and OTP attempt tracking
- MongoDB: product/catalog layer placeholder for flexible document models

Firebase Admin is still used for Google ID token verification, but Firestore is no longer the primary application database.

## Service Ownership

| Feature | Storage |
| --- | --- |
| Users | PostgreSQL |
| Auth sessions | PostgreSQL |
| Orders | PostgreSQL |
| Payment attempts / transaction state | PostgreSQL |
| Signup OTP | Redis |
| Password reset OTP | Redis |
| Cart | Redis |
| Wishlist | Redis |
| Product catalog | MongoDB |
| Reviews | MongoDB |

## Docker Setup

The repository includes a root [docker-compose.yml](/d:/ProductionApplication/GrassPlant/grass_green_nursery_server/docker-compose.yml:1) with:

- `postgres`
- `redis`
- `mongo`

PostgreSQL schema bootstraps from [docker/postgres/init/001_schema.sql](/d:/ProductionApplication/GrassPlant/grass_green_nursery_server/docker/postgres/init/001_schema.sql:1).

### Commands

```bash
npm run db:up
npm run db:down
```

### Default Local URLs

```env
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/grass_green_nursery
REDIS_URL=redis://localhost:6379
MONGO_URI=mongodb://localhost:27017/grass_green_nursery
```

## Why This Split

- PostgreSQL handles relational consistency, session rotation, and order/payment records.
- Redis gives fast TTL-based OTP storage and easy attempt limiting.
- MongoDB stays available for flexible catalog and review documents without forcing product variants into rigid tables.

## Notes

- Cart and wishlist now persist per authenticated user in Redis.
- Elasticsearch and BigQuery are not part of the current local implementation.
- The server now checks PostgreSQL, Redis, and MongoDB connectivity during startup.
