# Quality Gates

Comandos que devem ser executados e passar (sem erros) antes de uma
implementação ser considerada concluída pelo `/implement`. Preencha os
comandos reais do seu projeto — o pipeline nunca assume nomes
específicos de scripts ou ferramentas.

| Gate | Comando | Critério de sucesso |
|---|---|---|
| Typecheck | `pnpm -r exec tsc --noEmit` | Zero erros em todos os workspaces |
| Build | `pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build && pnpm --filter @eventpier/ui build` | `dist/index.js`/`dist/index.d.ts` gerados sem erro para os três workspaces |
| Docker | `docker compose build` | Build de `eventpier-ui` e `eventpier-aws` termina com exit code 0 |
| Testes | `node scripts/validate-workspace-manifests.mjs && node scripts/validate-workspace-dependencies.mjs && node scripts/validate-contract-constants.mjs && node scripts/validate-compose-shape.mjs` | Todos os scripts terminam com exit code 0 |

Lint ainda não se aplica — nenhum linter (ESLint/Ruff/etc.) configurado
até este ponto do roadmap. Readicionar a linha quando ESLint for
configurado, provavelmente junto de `apps/ui`.

A linha "Build" existe desde a spec 002 (`packages/contracts`, primeiro
workspace com output real de `tsc`) — ver
`specs/002-definir-contrato-compartilhado/research.md`, Decisão 5.
Estendida pela spec 003 para incluir `apps/ui` e `providers/aws`,
primeira vez que os dois ganham build próprio (ver
`specs/003-configurar-docker-compose/research.md`, Decisões 3-5).

A linha "Docker" existe desde a spec 003 — valida que os Dockerfiles
multi-stage de `apps/ui`/`providers/aws` buildam a partir do
código-fonte local, sem depender de nenhuma imagem publicada em
registry (spec 004, CI, ainda não existe). Ver
`specs/003-configurar-docker-compose/research.md`, Decisão 2.

A linha "Testes" combina os scripts de validação estrutural da spec
001 (`validate-workspace-manifests.mjs`/`validate-workspace-dependencies.mjs`),
o `validate-contract-constants.mjs` da spec 002 e o
`validate-compose-shape.mjs` da spec 003 — nenhum é um test runner
real (jest/vitest/pytest), todos são scripts Node puros (ver
`specs/002-definir-contrato-compartilhado/research.md`, Decisão 7, e
`specs/003-configurar-docker-compose/research.md`, "Nota de abordagem
de teste"). `validate-contract-constants.mjs` depende do gate Build já
ter rodado (lê `packages/contracts/dist/index.js`);
`validate-compose-shape.mjs` depende de `docker-compose.yml` existir
(não do gate Docker ter rodado — só lê a config resolvida, não builda)
— por isso Build e Docker vêm antes de Testes nesta tabela. Trocar por
um runner de verdade quando a primeira spec com lógica de negócio
condicional (006, health-check com cache) precisar de testes
unitários.
