# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable \
  && corepack prepare pnpm@11.19.0 --activate

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .

ENV NODE_ENV=production
ENV NITRO_PRESET=node-server

RUN pnpm build

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DOCUMENT_STORAGE_PATH=/data/documents

WORKDIR /app

RUN groupadd --system --gid 1001 arremataflow \
  && useradd --system --uid 1001 --gid arremataflow --home-dir /app arremataflow \
  && mkdir -p /data/documents \
  && chown -R arremataflow:arremataflow /app /data/documents

COPY --from=build --chown=arremataflow:arremataflow /app/.output ./.output
COPY --from=production-dependencies --chown=arremataflow:arremataflow /app/node_modules ./node_modules
COPY --chown=arremataflow:arremataflow drizzle ./drizzle
COPY --chown=arremataflow:arremataflow scripts/run-production-migrations.mjs ./scripts/run-production-migrations.mjs
COPY --chown=arremataflow:arremataflow scripts/generate-inspection-pdf.mjs ./scripts/generate-inspection-pdf.mjs
COPY --chown=arremataflow:arremataflow scripts/run-notification-jobs.mjs ./scripts/run-notification-jobs.mjs

USER arremataflow

EXPOSE 3000
VOLUME ["/data/documents"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health/ready').then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["sh", "-c", "node scripts/run-production-migrations.mjs && exec node .output/server/index.mjs"]
