# Tasks — Cache de Health-check por Capability (006)

Fonte: `spec.md` (requisitos funcionais RF1-RF9), `plan.md`,
`research.md` (decisões 1-8), `data-model.md` (`CachedHealth`,
`HealthCheckResult`, `HealthCheckFn`, `HealthCache`),
`contracts/health-cache-shape.md`, `quickstart.md`.

**Nota de abordagem de teste**: esta é a primeira spec do projeto a
introduzir um test runner real (Vitest — `research.md`, Decisão 6),
adiado desde `specs/002-.../research.md` (Decisão 7) e
`specs/005-.../research.md` (Decisão 8) até haver lógica condicional
real para justificá-lo. TDD aqui é literal: `health-cache.test.ts`
(Fase Testes) é escrito e confirmado em **RED** antes de
`health-cache.ts` existir (módulo não encontrado), depois confirmado
em **GREEN** na Fase Integração, contra a implementação real da Fase
Core.

`[P]` = paralelizável (arquivo diferente, sem dependência lógica de
outra task não concluída na mesma fase). Sem marcador = sequencial.

## Fase: Setup

- [X] **T001** Atualizar `providers/aws/package.json`: adicionar
  `"devDependencies": { "vitest": "4.1.11" }` e
  `"scripts": { "test": "vitest run" }`. Rodar `pnpm install` na raiz
  do monorepo para resolver a nova dependência (`pnpm-lock.yaml`
  atualizado).
  _Origem: research.md Decisão 6; contracts/health-cache-shape.md ("providers/aws/package.json")._

## Fase: Testes

- [X] **T002** Criar `providers/aws/src/manifest/health-cache.test.ts`
  exatamente como em `contracts/health-cache-shape.md`. Deve validar:
  - **Caso feliz — cache hit**: duas leituras de `getStatus()` dentro
    do TTL chamam `check()` apenas uma vez.
  - **Expiração de TTL**: uma leitura após o TTL expirar dispara nova
    chamada a `check()`.
  - **Invalidação ativa**: `invalidate()` força nova chamada a
    `check()` na leitura seguinte, mesmo antes do TTL expirar.
  - **Isolamento entre capabilities**: duas instâncias independentes
    de `createHealthCache` nunca compartilham estado — invalidar uma
    não afeta a outra.
  - **TTL default**: sem `HEALTH_CHECK_TTL_MS` definida, o cache
    expira exatamente aos 4000ms (não antes, não depois).
  - **TTL customizado via env var**: `HEALTH_CHECK_TTL_MS` válida
    (ex.: `"2000"`) é respeitada.
  - **TTL inválido cai no default**: `HEALTH_CHECK_TTL_MS` como
    `"abc"`, `"0"` e `"-100"` (parametrizado) cai no default de
    4000ms, sem lançar erro.
  - **Falha inesperada (exceção)**: `check()` rejeitando resulta em
    `CachedHealth` com `status:"unavailable"`, `reason:"UNKNOWN"` —
    sem propagar a exceção para quem chamou `getStatus()`.
  - **Falha esperada preserva `reason`**: `check()` resolvendo com
    `{status:"unavailable", reason:"CONNECTION_TIMEOUT"}` é refletido
    literalmente no `CachedHealth` retornado.
  - Usa `vi.useFakeTimers()`/`vi.setSystemTime()` para controlar o
    tempo (nunca `setTimeout` real) — `research.md`, Decisão 7.
  Rodar `pnpm --filter @eventpier/provider-aws test` agora e confirmar
  que **falha** (RED): `./health-cache.js` não existe ainda.
  _Origem: spec.md RF1-RF8; research.md Decisões 1-5, 7; data-model.md (todas as entidades); contracts/health-cache-shape.md ("health-cache.test.ts")._

## Fase: Core

- [X] **T003** Criar `providers/aws/src/manifest/health-cache.ts`
  exatamente como em `contracts/health-cache-shape.md`: tipos
  `CachedHealth`, `HealthCheckResult`, `HealthCheckFn`, interface
  `HealthCache`; `resolveTtlMs(explicit?)` com prioridade
  parâmetro explícito → `HEALTH_CHECK_TTL_MS` válida → default 4000ms
  (`research.md`, Decisão 3); `createHealthCache(check, options?)`
  retornando `{ getStatus, invalidate }` isolado por instância
  (`research.md`, Decisão 1), sem deduplicação de chamadas
  concorrentes (`research.md`, Decisão 4), `invalidate()` limpando o
  cache em vez de marcar `unavailable` sintético (`research.md`,
  Decisão 5), qualquer exceção de `check()` capturada e mapeada para
  `{status:"unavailable", reason:"UNKNOWN"}` (RF7). Depende de T002
  existir (TDD).
  _Origem: spec.md RF1-RF8; data-model.md (todas as entidades); research.md Decisões 1-5; contracts/health-cache-shape.md ("health-cache.ts")._

## Fase: Integração

Ordem sequencial — cada task assume o estado deixado pela anterior.

- [X] **T004** Rodar `pnpm --filter @eventpier/provider-aws test`.
  Confirmar que agora **passa** (GREEN — T002 volta a passar contra o
  código real de T003), todos os casos listados em T002 verdes.
  _Valida: T002._

- [X] **T005** Rodar
  `pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build && pnpm -r exec tsc --noEmit`.
  Confirmar sem erros — `dist/manifest/health-cache.js` e
  `dist/manifest/health-cache.test.js` gerados (Decisão 8 de
  `research.md`, intencional).
  _Valida: quickstart.md passo 2._

- [X] **T006** Com o build do passo anterior pronto, rodar a
  demonstração manual do passo 3 de `quickstart.md` (script `node -e`
  com `createHealthCache`, TTL de 200ms). Confirmar que `calls`
  incrementa exatamente nas leituras 1ª, 3ª e 4ª (nunca na 2ª, cache
  hit), terminando em `calls = 3`.
  _Valida: quickstart.md passo 3; spec.md Critérios de Sucesso (mecanismo testável isoladamente)._

- [X] **T007** Rodar `node scripts/validate-manifest-endpoint.mjs`.
  Confirmar `OK` — `GET /api/v1/manifest` continua retornando
  `capabilities: []`, sem nenhuma regressão (RF9: esta spec não
  integra o cache ao manifesto).
  _Valida: quickstart.md passo 4; spec.md RF9._

- [ ] **T008** `[P]` Atualizar `.pipeline/quality-gates.md`: inserir
  nova linha **Testes unitários**
  (`pnpm --filter @eventpier/provider-aws test`) **antes** da linha
  **Build**; renomear a linha **Testes** existente para **Testes de
  integração** (mesmo comando, só o rótulo muda).
  _Origem: research.md Decisão 6 ("Consequência para /tasks"); contracts/health-cache-shape.md ("quality-gates.md")._

- [ ] **T009** `[P]` Atualizar `.github/workflows/ci.yml`: inserir
  novo step **Testes unitários**
  (`run: pnpm --filter @eventpier/provider-aws test`) logo após
  "Install dependencies", antes de "Build"; renomear o step "Testes
  (scripts de validação estrutural)" existente para "Testes de
  integração (scripts de validação estrutural)" (mesmo conteúdo, só o
  rótulo muda).
  _Origem: research.md Decisão 6 ("Consequência para /tasks"); contracts/health-cache-shape.md ("ci.yml")._

- [ ] **T010** Rodar `git status --short`. Confirmar que as mudanças
  ficam restritas a
  `providers/aws/src/manifest/health-cache.ts` (novo),
  `providers/aws/src/manifest/health-cache.test.ts` (novo),
  `providers/aws/package.json`, `pnpm-lock.yaml`,
  `.pipeline/quality-gates.md`, `.github/workflows/ci.yml` — nenhuma
  mudança em `manifest.service.ts`, `index.ts`, `packages/contracts/src/`,
  `docker-compose.yml` ou `apps/ui/`.
  _Valida: quickstart.md passo 5._

## Fase: Polish

- [ ] **T011** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: ajuste fino
  de algum caso de borda do `resolveTtlMs` não coberto originalmente).

- [ ] **T012** `[P]` Rodar `find providers/aws/src -type f`. Confirmar
  que lista exatamente `index.ts`, `manifest/manifest.service.ts`,
  `manifest/health-cache.ts` e `manifest/health-cache.test.ts` —
  nenhum arquivo de `capabilities/` ou `adapters/` (spec 008) ou
  `config/environment.config.ts` (spec 007) vazado de specs futuras.
  _Origem: spec.md "Fora do escopo"._

- [ ] **T013** Revisão final contra `spec.md` → "Critérios de
  Sucesso": confirmar, lendo o código produzido (não só rodando
  gates), que `createHealthCache` não tem nenhum acoplamento a uma
  capability específica (RF8) e está pronto para ser importado pela
  spec 008 sem exigir mudança de assinatura; que a falha simulada em
  T002 produz `CachedHealth` com `status:"unavailable"` e
  `HealthFailureCode` válido sem lançar exceção (T004 já validou via
  teste automatizado); que `GET /api/v1/manifest` não regrediu (T007).
