# @eventpier/ui

UI desacoplada de cloud do Eventpier (`docs/arquitetura.md`, Estado 1
do monorepo). Consome o manifesto exposto por um provider (hoje:
`providers/aws`) via o contrato comum de `packages/contracts` —
nunca importa SDK de cloud nem conhece regras específicas de emulador
(constitution, princípio 1).

## Estado atual

Placeholder HTTP mínimo (`node:http`, porta 3000), sem framework —
introduzido pela spec 003 só para o Docker Compose ter algo escutando
a porta. Será substituído integralmente pela spec 009 (skeleton
Next.js + consumo do manifesto).

## Build

```bash
pnpm --filter @eventpier/ui build
```
