# Quality Gates

Comandos que devem ser executados e passar (sem erros) antes de uma
implementação ser considerada concluída pelo `/implement`. Preencha os
comandos reais do seu projeto — o pipeline nunca assume nomes
específicos de scripts ou ferramentas.

| Gate | Comando | Critério de sucesso |
|---|---|---|
| Typecheck | `pnpm -r exec tsc --noEmit` | Zero erros em todos os workspaces |
| Build | `pnpm --filter @eventpier/contracts build` | `packages/contracts/dist/index.js` e `dist/index.d.ts` gerados sem erro |
| Testes | `node scripts/validate-workspace-manifests.mjs && node scripts/validate-workspace-dependencies.mjs && node scripts/validate-contract-constants.mjs` | Todos os scripts terminam com exit code 0 |

Lint ainda não se aplica — nenhum linter (ESLint/Ruff/etc.) configurado
até este ponto do roadmap. Readicionar a linha quando ESLint for
configurado, provavelmente junto de `apps/ui`.

A linha "Build" existe desde a spec 002 (`packages/contracts`, primeiro
workspace com output real de `tsc`) — ver
`specs/002-definir-contrato-compartilhado/research.md`, Decisão 5.
Reavaliar/estender quando `apps/ui` (Next.js) ou `providers/aws`
ganharem seu próprio build.

A linha "Testes" combina os scripts de validação estrutural da spec
001 (`validate-workspace-manifests.mjs`/`validate-workspace-dependencies.mjs`)
com o novo `validate-contract-constants.mjs` da spec 002 — nenhum é um
test runner real (jest/vitest/pytest), todos são scripts Node puros
(ver `specs/002-definir-contrato-compartilhado/research.md`,
Decisão 7). `validate-contract-constants.mjs` depende do gate Build já
ter rodado (lê `packages/contracts/dist/index.js`) — por isso Build
vem antes de Testes nesta tabela. Trocar por um runner de verdade
quando a primeira spec com lógica de negócio condicional (006,
health-check com cache) precisar de testes unitários.
