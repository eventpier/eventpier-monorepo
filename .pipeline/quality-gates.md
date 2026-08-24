# Quality Gates

Comandos que devem ser executados e passar (sem erros) antes de uma
implementação ser considerada concluída pelo `/implement`. Preencha os
comandos reais do seu projeto — o pipeline nunca assume nomes
específicos de scripts ou ferramentas.

| Gate | Comando | Critério de sucesso |
|---|---|---|
| Testes unitários | `pnpm --filter @eventpier/provider-aws test` | Vitest reporta todos os testes passando (exit code 0) |
| Build | `pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build && pnpm --filter @eventpier/ui build` | `dist/index.js`/`dist/index.d.ts` gerados sem erro para os três workspaces |
| Typecheck | `pnpm -r exec tsc --noEmit` | Zero erros em todos os workspaces |
| Docker | `docker compose build` | Build de `eventpier-ui` e `eventpier-aws` termina com exit code 0 |
| Testes de integração | `node scripts/validate-workspace-manifests.mjs && node scripts/validate-workspace-dependencies.mjs && node scripts/validate-contract-constants.mjs && node scripts/validate-compose-shape.mjs && node scripts/validate-ci-workflow-shape.mjs && node scripts/validate-manifest-endpoint.mjs` | Todos os scripts terminam com exit code 0 |

A partir da spec 004, os gates desta tabela também rodam
automaticamente em todo Pull Request contra `main`, via
`.github/workflows/ci.yml` — deixam de ser apenas locais/manuais. O
merge só é permitido quando o job `validate` desse workflow passa (ver
`specs/004-configurar-ci-path-providers/research.md`, Decisão 8, para
o passo manual de branch protection que completa esse bloqueio).

Lint ainda não se aplica — nenhum linter (ESLint/Ruff/etc.) configurado
até este ponto do roadmap. Readicionar a linha quando ESLint for
configurado, provavelmente junto de `apps/ui`.

A linha "Build" existe desde a spec 002 (`packages/contracts`, primeiro
workspace com output real de `tsc`) — ver
`specs/002-definir-contrato-compartilhado/research.md`, Decisão 5.
Estendida pela spec 003 para incluir `apps/ui` e `providers/aws`,
primeira vez que os dois ganham build próprio (ver
`specs/003-configurar-docker-compose/research.md`, Decisões 3-5).

**Build vem antes de Typecheck** (invertido a partir da spec 005): a
partir do momento em que `providers/aws` importa `@eventpier/contracts`
de verdade (spec 005), `pnpm -r exec tsc --noEmit` (gate Typecheck)
passa a exigir que `packages/contracts/dist/index.d.ts` já exista para
resolver o módulo — e só o gate Build gera esse `dist/`. Num checkout
limpo (como o CI sempre faz), rodar Typecheck antes de Build falha com
`TS2307: Cannot find module '@eventpier/contracts'`. Ver
`specs/005-expor-manifesto/research.md`, Decisões durante a
implementação.

A linha "Docker" existe desde a spec 003 — valida que os Dockerfiles
multi-stage de `apps/ui`/`providers/aws` buildam a partir do
código-fonte local, sem depender de nenhuma imagem publicada em
registry. A partir da spec 004, uma imagem de `providers/aws` também
passa a ser publicada em `ghcr.io/eventpier/eventpier-aws` — mas só
como consequência de um merge em `main` (`publish-provider-aws.yml`),
nunca como pré-requisito deste gate local, que continua buildando
100% a partir do código-fonte. Ver
`specs/003-configurar-docker-compose/research.md`, Decisão 2, e
`specs/004-configurar-ci-path-providers/research.md`, Decisão 7.

A linha "Testes de integração" (chamada apenas "Testes" até a spec 006)
combina os scripts de validação estrutural da spec 001
(`validate-workspace-manifests.mjs`/`validate-workspace-dependencies.mjs`),
o `validate-contract-constants.mjs` da spec 002, o
`validate-compose-shape.mjs` da spec 003 e o
`validate-ci-workflow-shape.mjs` da spec 004 — nenhum é um test runner
real (jest/vitest/pytest), todos são scripts Node puros (ver
`specs/002-definir-contrato-compartilhado/research.md`, Decisão 7, e
`specs/003-configurar-docker-compose/research.md`, "Nota de abordagem
de teste"). `validate-contract-constants.mjs` depende do gate Build já
ter rodado (lê `packages/contracts/dist/index.js`);
`validate-compose-shape.mjs` depende de `docker-compose.yml` existir
(não do gate Docker ter rodado — só lê a config resolvida, não builda);
`validate-ci-workflow-shape.mjs` depende apenas dos arquivos em
`.github/workflows/` existirem, lidos como texto, sem depender de
nenhum gate anterior — por isso Build e Docker vêm antes de Testes de
integração nesta tabela.

`validate-manifest-endpoint.mjs` (spec 005) é o primeiro script desta
linha que sobe um processo real (`providers/aws/dist/index.js`) e faz
requisições HTTP de verdade contra ele, em vez de só ler arquivos —
depende dos gates Build de `@eventpier/contracts` **e**
`@eventpier/provider-aws` já terem rodado, e da porta `4000` estar
livre no momento da execução (encerra o processo filho ao final,
mesmo em caso de falha). Ver
`specs/005-expor-manifesto/research.md`, Decisão 8.

A linha "Testes unitários" (spec 006) é o runner de verdade que a nota
acima antecipava — Vitest, escopado a `@eventpier/provider-aws`
(`specs/006-cachear-health-check/research.md`, Decisão 6), introduzido
assim que a primeira lógica de negócio condicional (cache de
health-check com TTL) justificou o custo de configurá-lo. Vem antes de
Build nesta tabela por não depender de nenhum `dist/` — Vitest
transpila TypeScript nativamente via esbuild, sem precisar de output
do `tsc`.
