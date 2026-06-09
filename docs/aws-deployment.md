# AWS Deployment Guide

This backend is best deployed as:

`App Runner` + `RDS PostgreSQL` + `ElastiCache Redis` + `MongoDB Atlas`

## 1. Prepare the app

1. Set `NODE_ENV=production`.
2. Set `PORT=8080`.
3. Set `TRUST_PROXY=true`.
4. Set `CLIENT_ORIGIN` to your frontend domain.
5. Set `SERVER_PUBLIC_BASE_URL` to your API domain.
6. Put all secrets in AWS Secrets Manager or App Runner environment variables.
7. Do not deploy `*.json` Firebase service-account files.

## 2. Create managed data services

### PostgreSQL

1. Create an Amazon RDS PostgreSQL instance.
2. Put it in private subnets.
3. Require TLS.
4. Open port `5432` only from the App Runner VPC connector security group.
5. Use the connection string in `POSTGRES_URL`.
6. Set `POSTGRES_SSL=true`.

### Redis

1. Create an Amazon ElastiCache Redis cluster.
2. Put it in private subnets.
3. Open port `6379` only from the App Runner VPC connector security group.
4. Use `rediss://...` in `REDIS_URL` if TLS is enabled.

### MongoDB

1. Use MongoDB Atlas on AWS unless you have already validated DocumentDB behavior with your Mongoose queries.
2. Allowlist the App Runner egress or VPC/NAT path used by your service.
3. Put the cluster URL in `MONGO_URI`.

## 3. Configure secrets

Store these values in AWS Secrets Manager or App Runner environment variables:

- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `PASSWORD_RESET_TOKEN_SECRET`
- `STAFF_ACCESS_TOKEN_SECRET`
- `SYNC_PRODUCTS_BEARER_TOKEN`
- `MAILER_USER`
- `MAILER_PASS`
- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `PHONEPE_CLIENT_ID` and `PHONEPE_CLIENT_SECRET`, or `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET`

## 4. Deploy App Runner

1. Connect the GitHub repo or container image.
2. Use the app root `shadyplant-server`.
3. Use `apprunner.yaml`.
4. Build command: `npm ci`.
5. Start command: `npm start`.
6. Port: `8080`.
7. Set the health check path to `/api/v1/health`.
8. Attach the VPC connector if the service must reach RDS and ElastiCache privately.

## 5. Verify after deploy

1. Open `GET /`.
2. Open `GET /api/v1/health`.
3. Confirm logins work with the real `CLIENT_ORIGIN`.
4. Confirm the app can connect to PostgreSQL, Redis, and MongoDB.
5. Confirm Firebase login and email delivery are working.

## 6. Rotate credentials

Rotate any secret that appeared in:

- `.env`
- `.env.example`
- screenshots
- shell history
- Firebase JSON files
