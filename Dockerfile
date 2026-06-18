FROM node:22-alpine AS base

WORKDIR /app

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 8080

CMD ["node", "src/server.js"]
