# Railway must run Node.js 22 at runtime (not only during build).
# node:sqlite is a Node 22+ builtin; Node 18 crashes with ERR_UNKNOWN_BUILTIN_MODULE.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# SQLite file is created at runtime under data/orders.db
RUN mkdir -p /app/data

CMD ["npm", "start"]
