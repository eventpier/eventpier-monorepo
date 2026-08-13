# @eventpier/provider-aws

Provider AWS do Eventpier (`docs/arquitetura.md`, Estado 1 do
monorepo). Expõe capabilities do MiniStack (hoje: Storage) via um
manifesto consumido pela UI, usando o AWS SDK apontando o `endpoint`
do environment — nunca uma API proprietária do emulador.

## Estado atual

Placeholder HTTP mínimo (`node:http`, porta 4000), sem framework —
introduzido pela spec 003 só para o Docker Compose ter algo escutando
a porta. Será substituído integralmente pela spec 005 (endpoint de
manifesto).

## CI

Imagem publicada em `ghcr.io/eventpier/eventpier-aws` a cada merge em
`main` que toque `providers/aws/**` ou `packages/contracts/**` — ver
`specs/004-configurar-ci-path-providers/`.

## Build

```bash
pnpm --filter @eventpier/provider-aws build
```
