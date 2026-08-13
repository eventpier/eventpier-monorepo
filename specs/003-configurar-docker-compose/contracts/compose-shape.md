# Contrato — Forma do Docker Compose e Dockerfiles (003)

Esta spec não expõe API HTTP funcional (os endpoints reais só chegam
nas specs 005+/009+). O "contrato" aqui é a forma exata que
`/tasks`/`/implement` devem produzir para orquestração — referência
normativa: `docs/arquitetura.md` §8, refinada pelas decisões de
`research.md`.

## `docker-compose.yml` (raiz)

```yaml
services:
  eventpier-ui:
    build:
      context: .
      dockerfile: apps/ui/Dockerfile
    ports:
      - "3000:3000"
    networks: [eventpier-net]
    environment:
      - EVENTPIER_AWS_URL=http://eventpier-aws:4000

  eventpier-aws:
    build:
      context: .
      dockerfile: providers/aws/Dockerfile
    networks: [eventpier-net]
    environment:
      - HEALTH_CHECK_TTL_MS=${HEALTH_CHECK_TTL_MS:-4000}
      - MINISTACK_ENDPOINT=${MINISTACK_ENDPOINT:-http://ministack:4566}
      - MINISTACK_MANAGED=${MINISTACK_MANAGED:-true}
    extra_hosts:
      - "host.docker.internal:host-gateway"

  ministack:
    image: ministackorg/ministack:latest
    ports:
      - "4566:4566"
    networks: [eventpier-net]
    profiles: ["managed-env"]

networks:
  eventpier-net:
    driver: bridge
```

## `.dockerignore` (raiz)

```
node_modules
**/node_modules
dist
**/dist
.git
.env
.env.local
*.log
.DS_Store
```

## `.env.example` (raiz — commitado; `.env` real já é ignorado pelo `.gitignore` existente)

```
# Overrides opcionais para o Docker Compose do MVP (spec 003).
# Copie para .env e ajuste se quiser apontar para um MiniStack externo
# (managed: false) em vez do serviço `ministack` gerenciado pelo Compose.
# Deixe em branco (ou não crie .env) para usar os defaults do serviço
# `ministack` gerenciado pelo próprio Compose.

# Endpoint do MiniStack que o eventpier-aws deve usar.
# Default: http://ministack:4566 (serviço gerenciado pelo Compose).
# Para uma instância externa rodando no host: http://host.docker.internal:4566
MINISTACK_ENDPOINT=

# Se o MiniStack referenciado acima é gerenciado pelo Eventpier (true) ou externo (false).
MINISTACK_MANAGED=

# TTL do cache de health-check do provider, em milissegundos (default: 4000).
HEALTH_CHECK_TTL_MS=
```

## `apps/ui/Dockerfile`

```dockerfile
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
```

## `providers/aws/Dockerfile`

```dockerfile
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
COPY providers/aws providers/aws
RUN pnpm --filter @eventpier/provider-aws build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/providers/aws/dist ./dist
COPY --from=build /app/providers/aws/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

Nota: os dois Dockerfiles copiam o `package.json` dos três workspaces
no estágio `deps` porque `pnpm install --frozen-lockfile` sem `--filter`
resolve o workspace inteiro (necessário para o lockfile bater) — mesmo
que a imagem final só contenha o `dist/` de um workspace. Ver
`research.md`, Decisão 2.

## `apps/ui/src/index.ts` (substitui o `export {}` da spec 001)

```ts
import { createServer } from "node:http";

const PORT = 3000;

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(
    "eventpier-ui placeholder (spec 003) — sem UI real ainda (ver spec 009)\n",
  );
});

server.listen(PORT, () => {
  console.log(`eventpier-ui placeholder ouvindo na porta ${PORT}`);
});
```

## `providers/aws/src/index.ts` (substitui o `export {}` da spec 001)

```ts
import { createServer } from "node:http";

const PORT = 4000;

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(
    "eventpier-aws placeholder (spec 003) — sem endpoint real ainda (ver spec 005)\n",
  );
});

server.listen(PORT, () => {
  console.log(`eventpier-aws placeholder ouvindo na porta ${PORT}`);
});
```

## `apps/ui/tsconfig.json` (diff sobre o existente)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## `providers/aws/tsconfig.json` (diff sobre o existente)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

## `apps/ui/package.json` (diff sobre o existente)

```json
{
  "name": "@eventpier/ui",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  }
}
```

## `providers/aws/package.json` (diff sobre o existente)

```json
{
  "name": "@eventpier/provider-aws",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  }
}
```

## `package.json` (raiz — diff sobre o existente)

```json
{
  "name": "eventpier-monorepo",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@11.10.0",
  "devDependencies": {
    "typescript": "7.0.2"
  }
}
```

## Validação esperada (para `/tasks` gerar tasks testáveis)

- `pnpm -r exec tsc --noEmit` continua passando (gate Typecheck
  existente, agora com `rootDir` explícito nos dois workspaces).
- `pnpm --filter @eventpier/provider-aws build` e
  `pnpm --filter @eventpier/ui build` geram `dist/index.js` sem erro.
- `docker compose build` termina com exit code 0 para `eventpier-ui` e
  `eventpier-aws`.
- `docker compose --profile managed-env up -d` sobe os três serviços;
  `curl http://localhost:3000` e `curl http://localhost:4566/_ministack/health`
  respondem do host.
- `docker compose up -d` (sem profile) sobe só `eventpier-ui` e
  `eventpier-aws`; `docker compose ps` confirma `ministack` ausente.
- `curl http://eventpier-aws:4000` **de dentro** da rede
  `eventpier-net` (ex.: `docker compose exec eventpier-ui wget -qO- http://eventpier-aws:4000`)
  responde; do host, a mesma porta não é alcançável.
