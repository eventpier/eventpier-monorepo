# Research — Setup do Monorepo (001)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípios 1, 3, 4,
  12, 13 e "Estrutura de Repositórios".
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seções 1, 2 (Estado 1)
  e 9.
- `spec.md` desta feature.

Nenhum conflito entre spec e regras/arquitetura foi encontrado — a
spec já foi ajustada durante `/specify` para seguir o Estado 1
(monorepo único), resolvendo a divergência que existia com
`docs/product.md`.

## Decisão 1 — Gerenciador de workspaces: pnpm

**Decisão**: usar **pnpm workspaces** (`pnpm-workspace.yaml` na raiz),
não npm workspaces nem yarn workspaces, e nenhuma ferramenta de build
orchestration (Turborepo, Nx).

**Alternativas consideradas**:
- *npm workspaces* — rejeitado. Não isola dependências por workspace
  (permite "phantom dependencies": um workspace importar algo que só
  está instalado por causa de outro workspace, sem declarar no próprio
  `package.json`). Com 3 workspaces desde o início e mais 2 provider
  reais planejados (Azure/GCP), esse risco cresce, não encolhe.
- *yarn workspaces (Classic ou Berry)* — rejeitado. Sem vantagem clara
  sobre pnpm para este stack (Next.js + Node.js/TypeScript); Berry
  (PnP) tem fricção conhecida com alguns pacotes do ecossistema
  Next.js/Storybook.
- *Turborepo / Nx* — rejeitado **por agora**, princípio 12 da
  constitution ("abstração só após necessidade comprovada"). Com 3
  workspaces e nenhum grafo de build complexo, o ganho de cache
  remoto/orquestração não paga a complexidade extra. Reavaliar quando
  o número de workspaces ou o tempo de CI justificar.

**Justificativa da escolha**: pnpm resolve o problema real (isolamento
de dependências) sem adicionar uma camada de orquestração que a spec
001 não precisa. `pnpm` já está disponível no ambiente de
desenvolvimento local verificado.

**Consequência para `/tasks`**: todas as tasks de "criar workspace"
devem gerar `package.json` compatíveis com pnpm workspaces (sem
`workspaces` field no root `package.json` — isso é do npm; pnpm usa
`pnpm-workspace.yaml`), e o lockfile committed é `pnpm-lock.yaml`.

## Decisão 2 — Convenção de nomes de pacote: escopo `@eventpier`

**Decisão**: todo workspace usa o escopo npm `@eventpier/<nome>`:
- `apps/ui` → `@eventpier/ui`
- `providers/aws` → `@eventpier/provider-aws`
- `packages/contracts` → `@eventpier/contracts`

**Justificativa**: consistente com o namespace já usado nas imagens
Docker (`ghcr.io/eventpier/eventpier-ui`, ver `arquitetura.md` seção
8). `@eventpier/provider-aws` (não `@eventpier/aws`) deixa claro que é
um *provider*, já antecipando que `providers/azure` viria como
`@eventpier/provider-azure` sem ambiguidade com um possível pacote
"aws" genérico no futuro.

## Decisão 3 — Duas noções de versão não devem ser confundidas

Esta spec cria o `package.json` de `packages/contracts` com um
`version` semver (ex.: `0.1.0`) — **isso não é o mesmo campo** que
`contractVersion` dentro de `ProviderManifest` (ver
`arquitetura.md` seção 3), que é conteúdo funcional do contrato e
pertence à spec 002.

**Justificativa**: princípio 13 exige disciplina de versionamento
semântico "desde o primeiro commit" — isso se refere ao pacote
`packages/contracts` em si (seu `package.json`), não exige que o
`contractVersion` runtime já exista, porque essa spec não cria nenhum
conteúdo funcional do contrato (ver seção "Fora do escopo" de
`spec.md`). `/tasks` não deve gerar uma task que crie
`ProviderManifest` ou `contractVersion` — isso é escopo da spec 002.

## Decisão 4 — TypeScript: `tsconfig.base.json` compartilhado, sem project references ainda

**Decisão**: um `tsconfig.base.json` na raiz com as opções comuns
(`strict: true`, `target`, `module`, etc.); cada workspace tem seu
próprio `tsconfig.json` com `"extends": "../../tsconfig.base.json"`
(caminho relativo conforme profundidade). Sem TypeScript **project
references** (`references` + `composite: true`) por enquanto.

**Alternativa considerada**: TS project references desde já — rejeitado
pela mesma lógica do princípio 12: o ganho (build incremental
cross-package) não compensa a complexidade extra com apenas 3
workspaces e nenhum deles ainda com código real para compilar. Cada
workspace compila isoladamente por enquanto.

## Decisão 5 — Placeholder mínimo de cada workspace

Cada workspace criado por esta spec contém apenas o suficiente para
ser reconhecido como pacote pelo pnpm e ter `tsc --noEmit` passando
vazio — **sem** lógica de negócio:
- `package.json` (nome, versão, `private: true` exceto avaliação
  futura de `packages/contracts`, scripts vazios/mínimos)
- `tsconfig.json` (extends do base)
- Um único arquivo `src/index.ts` com um comentário mínimo ou export
  vazio, apenas para o workspace não estar completamente vazio e para
  builds futuros terem um entry point previsível
- `Dockerfile` **não** é criado por esta spec — depende de docker
  compose (spec 003) e de haver algo real para buildar.

## Decisões durante a implementação

- **Versão do TypeScript fixada em `7.0.2`** (não prevista em nenhuma
  decisão anterior — este research.md não fixava versão). O npm
  registry mostra `7.0.2` como a última linha estável (sucedendo uma
  linha `6.x` intermediária), publicada depois do conhecimento
  treinado do modelo que implementou esta spec — não foi possível
  confirmar compatibilidade do ecossistema (Next.js, Storybook,
  plugins ESLint) com esse major. Confirmado explicitamente com o
  usuário, ciente do risco. **Atenção para a spec 009** (skeleton
  Next.js): se o Next.js ainda não suportar TypeScript 7 nesse
  momento, rebaixar para `6.0.3` ali, não silenciosamente.
- **Opções concretas de `tsconfig.base.json`**: `target: "ES2022"`,
  `module: "ESNext"`, `moduleResolution: "Bundler"`,
  `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`,
  `forceConsistentCasingInFileNames: true`, `resolveJsonModule: true`,
  `isolatedModules: true`, `declaration: true`, `sourceMap: true`. A
  Decisão 4 original só previa "opções comuns" sem listar; registrado
  aqui para as specs 002+ herdarem sem redecidir. `moduleResolution:
  "Bundler"` assume que `apps/ui` (Next.js) e o build de
  `packages/contracts` passam por um bundler — reavaliar se
  `providers/aws` (Node.js puro, sem bundler) tiver problema de
  resolução de módulo ao ganhar código real.
