# syntax=docker/dockerfile:1.7
# Build context: repository root (pnpm workspace). See docker-compose.yml.
#
#   deps    -> installs the workspace (backend + packages/shared) with pnpm
#   build   -> compiles @techdocs/shared and the NestJS app
#   prod    -> installs production dependencies only
#   runtime -> small image with dist/, drizzle/ migrations and prod node_modules

ARG NODE_IMAGE=node:24-alpine
ARG PNPM_VERSION=11.2.2

# ---------------------------------------------------------------- deps
FROM ${NODE_IMAGE} AS deps
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY backend/package.json backend/
# The root `prepare` hook builds @techdocs/shared, which is why its sources are
# copied before installing.
RUN pnpm install --frozen-lockfile --filter backend...

# ---------------------------------------------------------------- build
FROM deps AS build
COPY backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json backend/drizzle.config.ts backend/
COPY backend/src backend/src
COPY backend/scripts backend/scripts
COPY backend/drizzle backend/drizzle
RUN pnpm --filter @techdocs/shared build && pnpm --filter backend build

# ---------------------------------------------------------------- prod deps
FROM deps AS prod
# `--ignore-scripts`: @techdocs/shared is built in the `build` stage; nothing
# here needs install hooks.
RUN rm -rf node_modules backend/node_modules packages/shared/node_modules \
  && pnpm install --prod --frozen-lockfile --filter backend... --ignore-scripts

# ---------------------------------------------------------------- runtime
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_DIR=/data/storage
WORKDIR /app/backend

# Production node_modules (pnpm keeps a workspace-level store with relative
# symlinks, so the tree is copied with the same layout).
COPY --from=prod --chown=node:node /app/node_modules /app/node_modules
COPY --from=prod --chown=node:node /app/backend/node_modules /app/backend/node_modules
COPY --from=prod --chown=node:node /app/package.json /app/package.json
COPY --from=build --chown=node:node /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist /app/packages/shared/dist
COPY --from=build --chown=node:node /app/backend/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/dist ./dist
# Migrations are resolved relative to dist/shared/database (../../../drizzle).
COPY --from=build --chown=node:node /app/backend/drizzle ./drizzle

RUN mkdir -p /data/storage && chown -R node:node /data
VOLUME ["/data/storage"]
USER node
EXPOSE 3000

# /health answers 503 when the database is unreachable -> container unhealthy.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main"]
