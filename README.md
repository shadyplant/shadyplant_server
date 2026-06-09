# Grass Green Nursery Server

Express backend for Grass Green Nursery with a local polyglot setup:

- PostgreSQL for users, sessions, orders, and payment attempts
- Redis for OTP storage and verification attempt tracking
- MongoDB wired for catalog-style data and future product/review models
- Firebase Admin kept for Google ID token verification only
- PostgreSQL schema changes now run through a lightweight migration ledger instead of replaying the full DDL on every boot

## Auth Flow

- `POST /api/v1/auth/register`
  Creates an unverified local user and sends a signup OTP.
- `POST /api/v1/auth/register/verify-otp`
  Verifies the signup OTP and activates the account.
- `POST /api/v1/auth/login`
  Accepts email or phone number plus password for verified local users.
- `POST /api/v1/auth/google`
  Logs in with a Firebase-issued ID token created from a Google provider sign-in.
- `POST /api/v1/auth/refresh`
  Rotates the refresh session and returns a new access token.
- `POST /api/v1/auth/logout`
  Revokes the active refresh session.
- `POST /api/v1/auth/forgot-password/request`
  Generates a password-reset OTP.
- `POST /api/v1/auth/forgot-password/verify-otp`
  Validates the reset OTP and returns a short-lived password reset token.
- `POST /api/v1/auth/forgot-password/reset`
  Changes the password with the verified reset token and revokes all existing sessions.
- `GET /api/v1/cart`
  Returns the signed-in user's server-side cart.
- `PUT /api/v1/cart/sync`
  Replaces or merges cart items from the client after login.
- `GET /api/v1/wishlist`
  Returns the signed-in user's server-side wishlist.
- `PUT /api/v1/wishlist/sync`
  Replaces or merges wishlist items from the client after login.

## Quick Start

1. Copy `.env.example` to `.env`.
2. Set `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `CLIENT_ORIGIN`.
3. Configure Firebase Admin for Google login with either environment variables or a mounted service-account file. Do not commit production credentials to the repository.
4. Make sure Docker Desktop is running on Windows before starting the local databases.
5. Start the local databases:

```bash
npm run db:up
```

6. Start the API:

```bash
npm run dev
```

## Local Service Defaults

- PostgreSQL: `postgres://postgres:postgres@localhost:5432/grass_green_nursery`
- Redis: `redis://localhost:6379`
- MongoDB: `mongodb://localhost:27017/grass_green_nursery`

## Production Checklist

- Use `.env.production.example` as the AWS/App Runner variable checklist, but store real values in AWS Secrets Manager or the hosting platform environment, never in git.
- Set `NODE_ENV=production`, `PORT=8080`, `TRUST_PROXY=true`, `CLIENT_ORIGIN=https://your-frontend-domain.com`, and `SERVER_PUBLIC_BASE_URL=https://your-api-domain.com`.
- Use managed data services: Amazon RDS PostgreSQL, Amazon ElastiCache Redis, and MongoDB Atlas or a tested DocumentDB cluster.
- Provide Firebase Admin credentials through `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Do not deploy service-account JSON files with the source bundle.
- Configure the load balancer/App Runner health check path as `/api/v1/health`.
- App Runner can use `apprunner.yaml`; add real secrets in the App Runner console or AWS Secrets Manager instead of this file.
- See [docs/aws-deployment.md](</D:/ShadyPlant Applications/ShadyPlant_Server/shadyplant-server/docs/aws-deployment.md>) for the full AWS setup order.
- Use `npm run db:migrate` when you want to apply the Postgres migrations manually.
- Rotate any credential that was ever committed or shared in `.env`, `.env.example`, logs, screenshots, or service-account JSON files.

## Notes

- Refresh tokens are stored in an HTTP-only cookie.
- Access tokens are returned in the response body for in-memory frontend storage.
- Development OTPs are logged to the server console and also returned as `devOtp` outside production.
- Email rendering now lives in `src/email-templates`, and the reusable mailer module lives in `src/mailer`.
- Use `MAILER_TRANSPORT=smtp` with `MAILER_HOST`, `MAILER_PORT`, `MAILER_SECURE`, `MAILER_USER`, and `MAILER_PASS` to send real emails through Nodemailer. Switch back to `log` if you only want local previews.
- Production Google sign-in expects the frontend to authenticate with Firebase Auth using the Google provider, then send `user.getIdToken()` to `POST /api/v1/auth/google`. Raw Google OAuth access tokens should not be sent to this API.
- Cart and wishlist are now stored server-side in Redis, so the frontend should stop treating localStorage as the source of truth after login.
- PostgreSQL schema is applied through the boot-time migration ledger in `src/config/postgres-migrations.js`, with the base DDL in [docker/postgres/init/001_schema.sql](/d:/ProductionApplication/GrassPlant/grass_green_nursery_server/docker/postgres/init/001_schema.sql:1) and follow-up indexes in `docker/postgres/migrations`.
