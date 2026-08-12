# Tasks — Setup do Monorepo (001)

Fonte: `spec.md` (requisitos funcionais), `plan.md`, `research.md`
(decisões 1-5), `data-model.md` (entidade Workspace), `contracts/workspace-manifest.md`,
`quickstart.md`.

**Nota de abordagem de teste**: esta spec não tem lógica de negócio
nem framework de testes decidido ainda (isso é dos quality gates reais,
`<preencher>` até haver código funcional a partir da spec 002). As
tasks de "teste" abaixo são scripts Node sem dependências externas
(`fs`/`path`/`assert` do core) que validam a estrutura exigida por
`contracts/workspace-manifest.md` e pelas invariantes de
`data-model.md` — escolha consistente com o princípio 12 da
constitution (não introduzir tooling de teste antes de haver o que
testar de verdade).

`[P]` = paralelizável (arquivo diferente, sem dependência lógica de
outra task não concluída). Sem marcador = sequencial.

## Fase: Setup

- [X] **T001** `[P]` Criar `/package.json` (raiz): `name: "eventpier-monorepo"`,
  `private: true`, `version: "0.0.0"`, `devDependencies.typescript`
  fixado em uma versão estável específica (não `latest`) — registrar
  a versão escolhida em `research.md` → "Decisões durante a
  implementação".
  _Origem: spec.md FR1; contracts/workspace-manifest.md "Root package.json"._

- [X] **T002** `[P]` Criar `/pnpm-workspace.yaml` (raiz) listando
  exatamente `apps/*`, `providers/*`, `packages/*`.
  _Origem: spec.md FR1, FR4; research.md Decisão 1; contracts/workspace-manifest.md._

- [X] **T003** `[P]` Criar `/tsconfig.base.json` (raiz) com `strict: true`
  e demais opções comuns de compilação para Node.js + TypeScript (sem
  `composite`/`references`).
  _Origem: research.md Decisão 4._

## Fase: Testes

- [X] **T004** `[P]` Criar `/scripts/validate-workspace-manifests.mjs`:
  script Node que lê `pnpm-workspace.yaml` e o `package.json` de cada
  um dos 3 workspaces esperados (`data-model.md` → "Instâncias criadas
  por esta spec") e falha (`process.exitCode = 1` + mensagem) se: (a)
  `pnpm-workspace.yaml` não existir ou não listar os 3 patterns; (b)
  algum `package.json` de workspace não existir; (c) quando existir,
  não seguir `contracts/workspace-manifest.md` (`name` exato,
  `version` semver `≠ "0.0.0"`, `private: true`, `scripts` presente).
  Rodar (`node scripts/validate-workspace-manifests.mjs`) e confirmar
  que **falha agora** — os workspaces ainda não existem (RED).
  _Origem: contracts/workspace-manifest.md (contract test)._

- [X] **T005** `[P]` Criar `/scripts/validate-workspace-dependencies.mjs`:
  script Node que, para cada `package.json` de workspace que existir,
  falha se `packages/contracts` tiver `dependencies`/`devDependencies`
  apontando para `@eventpier/ui` ou `@eventpier/provider-aws` (relação
  proibida em `data-model.md`). Rodar agora: como nenhum workspace
  existe ainda, o script deve terminar sem erro por não ter nada para
  violar — isso é esperado (a proteção real começa a valer na Fase
  Integração, depois que os workspaces existirem); documentar essa
  observação como comentário no próprio script.
  _Origem: data-model.md (entidade Workspace, invariantes de dependência)._

## Fase: Core

- [X] **T006** `[P]` Criar workspace `apps/ui/`: `package.json`
  (`name: "@eventpier/ui"`, `version: "0.1.0"`, `private: true`,
  `scripts: {}`), `tsconfig.json` (`extends: "../../tsconfig.base.json"`,
  `outDir: "dist"`, `include: ["src"]`), `src/index.ts` com export
  vazio/placeholder. Sem dependências declaradas.
  _Origem: spec.md FR2, FR5; data-model.md; contracts/workspace-manifest.md._

- [X] **T007** `[P]` Criar workspace `providers/aws/`: mesma estrutura de
  T006, com `name: "@eventpier/provider-aws"`.
  _Origem: spec.md FR2, FR5; data-model.md; contracts/workspace-manifest.md._

- [X] **T008** `[P]` Criar workspace `packages/contracts/`: mesma
  estrutura de T006, com `name: "@eventpier/contracts"`. Nenhum
  conteúdo funcional de contrato (`ProviderManifest`,
  `CapabilityDescriptor`, `Page<T>`, `ProviderError`) — apenas o
  placeholder mínimo (ver spec.md "Fora do escopo").
  _Origem: spec.md FR2, FR5; research.md Decisão 3; contracts/workspace-manifest.md._

- [X] **T009** Adicionar ao `README.md` da raiz (criar se não existir) uma
  seção curta explicando o propósito de `apps/`, `providers/` e
  `packages/`. Depende de T006-T008 concluídas (precisa descrevê-las
  corretamente).
  _Origem: spec.md FR7._

## Fase: Integração

Ordem sequencial — cada task assume o estado deixado pela anterior.

- **T010** Rodar `pnpm install` na raiz. Confirmar que termina sem
  erro e sem warning de workspace não resolvido; confirmar que
  `pnpm-lock.yaml` foi gerado/atualizado; commitar o lockfile.
  _Valida: quickstart.md passo 1._

- **T011** Rodar `pnpm ls -r --depth -1`. Confirmar que lista
  exatamente `@eventpier/ui`, `@eventpier/provider-aws`,
  `@eventpier/contracts` — nenhum a mais, nenhum a menos.
  _Valida: quickstart.md passo 2; spec.md FR2._

- **T012** Rodar `pnpm --filter @eventpier/contracts install`.
  Confirmar que só afeta esse workspace, sem reinstalar os demais.
  _Valida: quickstart.md passo 3; spec.md FR3 (isolamento)._

- **T013** Rodar `node scripts/validate-workspace-manifests.mjs`
  (criado em T004). Confirmar que **agora passa** (GREEN — os
  workspaces das tasks T006-T008 satisfazem o contrato).
  _Valida: contracts/workspace-manifest.md._

- **T014** Rodar `node scripts/validate-workspace-dependencies.mjs`
  (criado em T005). Confirmar que passa.
  _Valida: data-model.md (invariantes de dependência); spec.md FR6._

- **T015** Rodar `pnpm -r exec tsc --noEmit`. Confirmar que passa sem
  erros em todos os workspaces.
  _Valida: quickstart.md passo 4._

- **T016** Rodar
  `find apps providers packages -name "*.ts" -not -name "index.ts"`.
  Confirmar que não retorna nenhum resultado (nenhuma lógica de
  negócio vazou de specs futuras para esta).
  _Valida: quickstart.md passo 5; spec.md FR5._

- **T017** Rodar
  `cat apps/ui/package.json providers/aws/package.json | grep -A3 dependencies`.
  Confirmar que, se houver `dependencies`, a única entrada possível é
  `@eventpier/contracts`; confirmar que `packages/contracts/package.json`
  não depende de nenhum dos outros dois workspaces.
  _Valida: quickstart.md passo 6; spec.md FR6; data-model.md._

## Fase: Polish

- **T018** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: versão exata
  do TypeScript escolhida em T001).

- **T019** `[P]` Conferir que `.gitignore` já cobre `node_modules/`,
  `dist/`, `build/` para os novos workspaces (já cobre, conforme
  `.gitignore` atual na raiz) — apenas confirmar; editar somente se
  algo estiver de fato faltando.
