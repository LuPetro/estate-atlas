# syntax=docker/dockerfile:1
FROM node:22.23.3-bookworm-slim AS dependencies
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 EXPO_NO_TELEMETRY=1
WORKDIR /app
RUN npm install --global pnpm@10.34.6
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
# Bound both the installer and its tarball worker on the shared 1.8 GB VPS.
# The later source stage retains its separate heap limit for application builds.
RUN --mount=type=cache,target=/app/.local/pnpm-store \
    NODE_OPTIONS=--max-old-space-size=192 PNPM_MAX_WORKERS=1 pnpm install --frozen-lockfile

FROM dependencies AS source
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=384

FROM source AS api-build
RUN pnpm --filter @estate-atlas/api build \
    && pnpm --filter @estate-atlas/api deploy --legacy --prod /out/api

FROM node:22.23.3-bookworm-slim AS api
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=4000
WORKDIR /app
COPY --from=api-build --chown=node:node /out/api/ ./
COPY --chown=node:node LICENSE THIRD_PARTY_NOTICES.md ./
USER node
EXPOSE 4000
CMD ["sh", "-c", "node dist/migrate.mjs && exec node dist/server.mjs"]

FROM source AS web-build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_CARTO_MAPS_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_CARTO_MAPS_KEY=$NEXT_PUBLIC_CARTO_MAPS_KEY
RUN pnpm --filter @estate-atlas/web exec next build --webpack

FROM node:22.23.3-bookworm-slim AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=web-build --chown=node:node /app/apps/web/.next/standalone/ ./
COPY --from=web-build --chown=node:node /app/apps/web/.next/static/ ./apps/web/.next/static/
COPY --from=web-build --chown=node:node /app/apps/web/public/ ./apps/web/public/
COPY --chown=node:node LICENSE THIRD_PARTY_NOTICES.md ./
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# Optional Metro preview, isolated from the normal production stack.
FROM source AS mobile-preview
RUN mkdir -p apps/mobile/.expo && chown -R node:node apps/mobile
ENV CI=1 REACT_NATIVE_PACKAGER_HOSTNAME=localhost EXPO_PUBLIC_API_URL=http://localhost:4000
USER node
EXPOSE 8081
CMD ["pnpm", "--filter", "@estate-atlas/mobile", "exec", "expo", "start", "--host", "lan", "--port", "8081", "--max-workers", "1"]
