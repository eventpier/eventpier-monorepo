# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/ui/package.json apps/ui/package.json
COPY providers/aws/package.json providers/aws/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/ui apps/ui
RUN pnpm --filter @eventpier/ui build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/apps/ui/dist ./dist
COPY --from=build /app/apps/ui/package.json ./package.json
EXPOSE 3000
CMD ["node", "dist/index.js"]
