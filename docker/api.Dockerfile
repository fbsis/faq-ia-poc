# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace

FROM base AS development
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --no-frozen-lockfile
COPY . .

FROM development AS build
RUN pnpm --filter @faq/contracts build && pnpm --filter @faq/api build
RUN pnpm deploy --legacy --filter @faq/api --prod /runtime

FROM node:24-alpine AS production
ENV NODE_ENV=production
USER node
WORKDIR /app
COPY --from=build --chown=node:node /runtime ./
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/apps/api/src/infrastructure/database/migrations ./dist/infrastructure/database/migrations
CMD ["node", "dist/commands/start-api.js"]
