# syntax=docker/dockerfile:1.7
# Build context: repository root (pnpm workspace). See docker-compose.yml.
#
#   deps    -> installs the workspace (frontend + packages/shared) with pnpm
#   build   -> type-checks and bundles the React app with Vite
#   runtime -> nginx serving the static bundle and proxying /api to the backend

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginx:1.29-alpine
ARG PNPM_VERSION=11.2.2

# ---------------------------------------------------------------- deps
FROM ${NODE_IMAGE} AS deps
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --filter frontend...

# ---------------------------------------------------------------- build
FROM deps AS build
# Same-origin API path; nginx proxies it to the backend (see nginx.conf).
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
COPY frontend/index.html frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/
COPY frontend/public frontend/public
COPY frontend/src frontend/src
RUN pnpm --filter @techdocs/shared build && pnpm --filter frontend build

# ---------------------------------------------------------------- runtime
FROM ${NGINX_IMAGE} AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
