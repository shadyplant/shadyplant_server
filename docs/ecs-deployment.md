# AWS Deployment Guide

For a fresh AWS account in 2026, use:

`ECS Fargate` + `ECR` + `RDS PostgreSQL` + `MongoDB Atlas`

Redis is optional for now. The app falls back to in-memory storage for carts, wishlists, OTPs, and sync locks when Redis is not configured. That is fine for a single ECS task, but it should not be the long-term scaling plan.

AWS App Runner is only a fit if your account already had access before the 2026 cutoff.

## 1. Prepare the app

1. Set `NODE_ENV=production`.
2. Set `PORT=8080`.
3. Set `TRUST_PROXY=true`.
4. Set `CLIENT_ORIGIN` to your frontend domain.
5. Set `SERVER_PUBLIC_BASE_URL` to your API domain.
6. Put all secrets in AWS Secrets Manager or task definition environment variables.
7. Use `FIREBASE_SERVICE_ACCOUNT` for Firebase Admin. In AWS, set it from a secret payload; in local development, you can point it at a mounted file.

## 2. Build and push the container

1. Create a private ECR repository.
2. Build the image from the repo root using the included [Dockerfile](</D:/ShadyPlant Applications/ShadyPlant_Server/shadyplant-server/Dockerfile>).
3. Push the image to ECR.
4. Use image tags that correspond to a git commit or release version.

AWS ECR supports pushing Docker images to private repositories, and the repository must exist before push. See the AWS ECR image push docs and repository creation docs. 

## 3. Create managed data services

### PostgreSQL

1. Create an Amazon RDS PostgreSQL instance.
2. Put it in private subnets.
3. Require TLS.
4. Open port `5432` only from the ECS service security group.
5. Use the connection string in `POSTGRES_URL`.
6. Set `POSTGRES_SSL=true`.

### Redis

Optional for launch.

1. Create an Amazon ElastiCache Redis cluster.
2. Put it in private subnets.
3. Open port `6379` only from the ECS service security group.
4. If you add Redis later, use `rediss://...` in `REDIS_URL` if TLS is enabled.

### MongoDB

1. Use MongoDB Atlas on AWS unless you have already validated DocumentDB behavior with your Mongoose queries.
2. Allowlist the ECS task egress path used by your service.
3. Put the cluster URL in `MONGO_URI`.

## 4. Configure secrets

Store these values in AWS Secrets Manager or ECS task secrets:

- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `PASSWORD_RESET_TOKEN_SECRET`
- `STAFF_ACCESS_TOKEN_SECRET`
- `SYNC_PRODUCTS_BEARER_TOKEN`
- `MAILER_USER`
- `MAILER_PASS`
- `FIREBASE_SERVICE_ACCOUNT`
- `PHONEPE_CLIENT_ID` and `PHONEPE_CLIENT_SECRET`, or `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET`

## 5. Deploy ECS Fargate

1. Create an ECS cluster.
2. Register a Fargate task definition with `awsvpc` networking, container port `8080`, and the image from ECR.
3. Attach task execution and task roles with the minimum permissions needed.
4. Create an ECS service with desired count `1` for the no-Redis setup. Increase to `2` or more only after you add shared state storage like Redis or move the affected features to a durable database.
5. Place the service behind an Application Load Balancer.
6. Set the ALB health check path to `/api/v1/health`.
7. Attach the service to private subnets if it needs to reach RDS privately.
8. Use a security group that only allows inbound traffic from the ALB.

## 6. Verify after deploy

1. Open `GET /`.
2. Open `GET /api/v1/health`.
3. Confirm logins work with the real `CLIENT_ORIGIN`.
4. Confirm the app can connect to PostgreSQL and MongoDB. If Redis is configured later, confirm that too.
5. Confirm Firebase login and email delivery are working.

## 7. Rotate credentials

Rotate any secret that appeared in:

- `.env`
- `.env.local`
- `.env.production`
- screenshots
- shell history
- Firebase JSON files
