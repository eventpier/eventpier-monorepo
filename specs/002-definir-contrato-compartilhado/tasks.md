# Tasks — Contrato Compartilhado (002)

Fonte: `spec.md` (requisitos funcionais FR1-FR8), `plan.md`,
`research.md` (decisões 1-7), `data-model.md` (entidades `Provider`,
`Environment`, `CapabilityDescriptor`, `ProviderManifest`, `Page<T>`,
`ProviderError`), `contracts/contract-shape.md`, `quickstart.md`.

**Nota de abordagem de teste**: esta spec não introduz `jest`/`vitest`
(research.md, Decisão 7). "Teste" aqui tem dois formatos: (a) um
arquivo TypeScript (`contract-shape.check.ts`) que só *compila* se a
forma do contrato estiver correta — o gate é `tsc --noEmit`, não uma
assertion library; (b) um script Node puro (mesmo padrão da spec 001)
que confere constantes em runtime. Ambos seguem TDD: escritos antes da
implementação, confirmados em RED, depois confirmados em GREEN na Fase
Integração.

`[P]` = paralelizável (arquivo diferente, sem dependência lógica de
outra task não concluída). Sem marcador = sequencial.

## Fase: Setup

- [X] **T001** Atualizar `packages/contracts/package.json`: `version`
  `0.1.0` → `0.2.0`, adicionar `main: "./dist/index.js"`,
  `types: "./dist/index.d.ts"`, `exports` (campo `"."` com
  `types`/`default`), e `scripts.build: "tsc -p tsconfig.json"`. Não
  alterar `tsconfig.json` (já correto desde a spec 001).
  _Origem: research.md Decisão 5; contracts/contract-shape.md ("packages/contracts/package.json")._

## Fase: Testes

- [X] **T002** `[P]` Criar `packages/contracts/src/contract-shape.check.ts`
  (não reexportado pelo `index.ts` — só entra no gate Typecheck via
  `include: ["src"]`). Deve validar, construindo valores de exemplo:
  - **Caso feliz**: um `ProviderManifest` completo, com uma
    `CapabilityDescriptor` `status: "available"` (sem `reason`).
  - **Caso obrigatório/erro**: uma segunda `CapabilityDescriptor` no
    mesmo manifesto com `status: "unavailable"` e `reason` de
    `HealthFailureCode` preenchido.
  - **Edge case**: um `Page<T>` com `items: []` e `nextCursor`
    ausente (página vazia = fim da paginação, `data-model.md`).
  - Um `ProviderError` com `capability` preenchido e `retryable: false`.
  - Comentários (não código executável) documentando os estados
    inválidos que a interface permite estruturalmente mas que violam
    a invariante de `data-model.md` (ex.: `available` com `reason`).
  Rodar `pnpm --filter @eventpier/contracts exec tsc --noEmit` agora e
  confirmar que **falha** (RED) — `manifest.ts`/`pagination.ts`/
  `errors.ts`/`index.ts` ainda não existem.
  _Origem: contracts/contract-shape.md (contract test); data-model.md (invariantes); spec.md FR1-FR4._

- [X] **T003** `[P]` Criar `scripts/validate-contract-constants.mjs`
  (raiz do monorepo, sem dependência externa — mesmo padrão de
  `scripts/validate-workspace-manifests.mjs` da spec 001). Deve
  validar:
  - **Caso feliz**: `CONTRACT_VERSION` casa com `/^\d+\.\d+\.\d+$/`;
    `CAPABILITIES` é exatamente `["storage", "queue", "topic",
    "secret", "logs"]`; `CAPABILITY_STATUSES` é exatamente
    `["available", "unavailable", "degraded"]`; `HEALTH_FAILURE_CODES`
    é exatamente `["CONNECTION_TIMEOUT", "CONNECTION_REFUSED",
    "AUTH_FAILED", "UNKNOWN"]`.
  - **Edge case**: comparação sensível a ordem (não usar `Set`/
    `sort()` antes de comparar) — ordem errada deve falhar.
  - **Caso de erro**: se `packages/contracts/dist/index.js` não
    existir, falhar com mensagem clara instruindo rodar
    `pnpm --filter @eventpier/contracts build` primeiro, sem lançar
    stack trace bruto.
  Rodar `node scripts/validate-contract-constants.mjs` agora e
  confirmar que **falha** (RED) pelo caso de erro acima — `dist/`
  ainda não existe.
  _Origem: research.md Decisão 7; contracts/contract-shape.md; spec.md FR5, FR8._

## Fase: Core

- [X] **T004** `[P]` Criar `packages/contracts/src/manifest.ts`:
  `CONTRACT_VERSION`, `CAPABILITIES`/`Capability`,
  `CAPABILITY_STATUSES`/`CapabilityStatus`,
  `HEALTH_FAILURE_CODES`/`HealthFailureCode`, `Provider`,
  `Environment`, `CapabilityDescriptor`, `ProviderManifest` —
  exatamente como em `contracts/contract-shape.md`. Union types
  sempre derivados via `(typeof ARRAY)[number]` (research.md,
  Decisão 1).
  _Origem: spec.md FR1, FR2, FR5, FR8; data-model.md (`Provider`, `Environment`, `CapabilityDescriptor`, `ProviderManifest`)._

- [X] **T005** `[P]` Criar `packages/contracts/src/pagination.ts`:
  `Page<T>` (`items: T[]`, `nextCursor?: string`).
  _Origem: spec.md FR3; data-model.md (`Page<T>`)._

- [X] **T006** Criar `packages/contracts/src/errors.ts`: `ProviderError`
  (`code`, `message`, `capability?: Capability`, `retryable`),
  importando `Capability` de `./manifest.js` (extensão `.js`
  explícita — research.md, Decisão 3). Depende de T004 (precisa do
  tipo `Capability` já existir).
  _Origem: spec.md FR4; data-model.md (`ProviderError`); research.md Decisão 3._

- [X] **T007** Criar `packages/contracts/src/index.ts`: barrel público
  (`export * from "./manifest.js"`, `"./pagination.js"`,
  `"./errors.js"`). Depende de T004, T005 e T006.
  _Origem: spec.md FR6; research.md Decisão 2._

## Fase: Integração

Ordem sequencial — cada task assume o estado deixado pela anterior.

- [X] **T008** Rodar `pnpm -r exec tsc --noEmit`. Confirmar que passa
  sem erros em todos os workspaces — em particular, que T002
  (`contract-shape.check.ts`) agora **compila** (GREEN).
  _Valida: quickstart.md passo 1; T002._

- [X] **T009** Rodar `pnpm --filter @eventpier/contracts build`.
  Confirmar que gera `packages/contracts/dist/index.js` e
  `packages/contracts/dist/index.d.ts` sem erro, e que `dist/` não
  aparece em `git status` (coberto por `.gitignore`).
  _Valida: quickstart.md passo 2; T001._

- [X] **T010** Rodar `node scripts/validate-contract-constants.mjs`.
  Confirmar que agora passa (GREEN — T003 encontra `dist/index.js`
  construído em T009 e as constantes batem).
  _Valida: quickstart.md passo 3; T003._

- [X] **T011** Rodar o `node -e` de importação dinâmica descrito em
  `quickstart.md` passo 4. Confirmar que `Object.keys(...)` inclui
  `CAPABILITIES`, `CAPABILITY_STATUSES`, `CONTRACT_VERSION`,
  `HEALTH_FAILURE_CODES` — sem tocar `apps/ui/package.json` nem
  `providers/aws/package.json`.
  _Valida: quickstart.md passo 4; spec.md FR6, Critério de Sucesso "pacote consumível via dependência de workspace"._

- [X] **T012** Atualizar `.pipeline/quality-gates.md`: adicionar linha
  **Build** (`pnpm --filter @eventpier/contracts build`, critério:
  `dist/index.js` e `dist/index.d.ts` gerados sem erro) antes da linha
  **Testes** existente; atualizar a linha **Testes** para encadear
  também `node scripts/validate-contract-constants.mjs`.
  _Origem: research.md Decisão 7 ("Consequência para /tasks")._

- [X] **T013** Rodar `git status --short`. Confirmar que as mudanças
  ficam restritas a `packages/contracts/`,
  `scripts/validate-contract-constants.mjs` e
  `.pipeline/quality-gates.md` — nenhuma mudança em `apps/ui/`,
  `providers/aws/` ou Docker Compose.
  _Valida: quickstart.md passo 5._

## Fase: Polish

- [ ] **T014** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: ajuste fino
  de mensagem de erro do script T003, se necessário).

- [ ] **T015** `[P]` Rodar
  `find packages/contracts/src -type f`. Confirmar que lista
  exatamente `manifest.ts`, `pagination.ts`, `errors.ts`, `index.ts`,
  `contract-shape.check.ts` — nenhum arquivo extra, nenhuma lógica de
  negócio, chamada de rede ou adapter vazados de specs futuras.
  _Origem: spec.md FR7 ("Fora do escopo")._

- [ ] **T016** Revisão final contra `spec.md` → "Critérios de Sucesso":
  confirmar, lendo o código produzido (não só rodando gates), que uma
  pessoa desenvolvendo `providers/aws` (spec 005+) ou `apps/ui` (spec
  009+) conseguiria preencher/consumir os tipos sem redefinir nenhuma
  forma de dado, e que nenhum campo do contrato foi adicionado,
  removido ou renomeado em relação a `docs/arquitetura.md` §3 sem
  registro explícito em `research.md`.
