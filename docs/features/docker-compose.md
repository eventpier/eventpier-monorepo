# Docker Compose — Orquestração do MVP

## O que o módulo faz

Orquestra os três serviços do MVP (`eventpier-ui`, `eventpier-aws`,
`ministack`) via `docker-compose.yml` na raiz do monorepo, seguindo o
Estado 1 de `docs/arquitetura.md` §8. `eventpier-ui` e `eventpier-aws`
são construídos localmente (build, não imagem publicada — este
Compose continua buildando 100% a partir do código-fonte mesmo depois
da spec 004 introduzir CI de publicação; ver
[ci.md](ci.md)); `ministack` usa a imagem
publicada `ministackorg/ministack:latest`.

## Comportamentos-chave e regras de negócio

- Rede interna nomeada `eventpier-net` (driver `bridge`) compartilhada
  pelos três serviços.
- Apenas `eventpier-ui` (porta 3000) publica porta ao host entre os
  serviços do próprio Eventpier — `eventpier-aws` nunca publica porta
  (constitution, princípio 11), alcançável só pela rede interna.
- `ministack` (porta 4566) é opcional via profile do Compose
  (`managed-env`) — `docker compose --profile managed-env up` sobe os
  três serviços; `docker compose up` (sem profile) sobe só
  `eventpier-ui`/`eventpier-aws`, permitindo apontar para um MiniStack
  já em execução externamente.
- `MINISTACK_ENDPOINT`, `MINISTACK_MANAGED` e `HEALTH_CHECK_TTL_MS` são
  configuráveis via variável de ambiente (`.env`, ver `.env.example`),
  com defaults embutidos no `docker-compose.yml` — nenhum rebuild de
  imagem necessário para trocar endpoint/TTL.
- `apps/ui` e `providers/aws` cada um tem um `Dockerfile` multi-stage
  (`base` → `deps` → `build` → `runtime`) que instala dependências do
  workspace inteiro via pnpm, builda só o próprio workspace, e copia
  para a imagem final apenas `dist/` + `package.json` — sem
  `node_modules` (nenhuma dependência de runtime real ainda).
- `apps/ui/src/index.ts` e `providers/aws/src/index.ts` contêm um
  servidor HTTP mínimo (`node:http`, sem framework) só para o Compose
  ter algo escutando a porta — placeholder explícito, substituído
  inteiramente pelas specs 005 (`providers/aws`) e 009 (`apps/ui`).
- `scripts/validate-compose-shape.mjs` valida a topologia resolvida
  (`docker compose config`) contra as invariantes acima — em especial,
  que `eventpier-aws` nunca publica porta.

## Contrato de API

N/A — nenhum endpoint HTTP funcional ainda (os placeholders só
respondem texto fixo). O "contrato" é a topologia do
`docker-compose.yml`; ver
`specs/003-configurar-docker-compose/contracts/compose-shape.md`.

## Limitações conhecidas

- `host.docker.internal` (usado para apontar `eventpier-aws` a um
  MiniStack externo rodando no host) pode não ser alcançável via TCP
  em hosts Linux cujo Docker daemon roda com `userland-proxy=false` —
  característica da configuração do Docker do host, não do
  `docker-compose.yml`. Ver
  `specs/003-configurar-docker-compose/research.md`, "Decisões
  durante a implementação".
- `eventpier-ui` e `providers/aws` ainda não têm nenhuma dependência de
  runtime real — o estágio `runtime` dos Dockerfiles não copia
  `node_modules`. Isso precisa mudar assim que a spec 005 ou 009
  introduzir a primeira dependência de runtime.

## Specs Relacionadas

| # | Spec | Tipo | Resumo | Data |
|---|------|------|--------|------|
| 003 | [003-configurar-docker-compose](../../specs/003-configurar-docker-compose/) | ✨ Feature | Orquestra `eventpier-ui`/`eventpier-aws`/`ministack` via Docker Compose, build local, rede interna restrita | 2026-08-13 |
