# Tasks — Docker Compose do MVP (003)

Fonte: `spec.md` (requisitos funcionais FR1-FR9), `plan.md`,
`research.md` (decisões 1-9), `data-model.md` (entidades `Service`,
`EnvVar`, `PlaceholderServer`), `contracts/compose-shape.md`,
`quickstart.md`.

**Nota de abordagem de teste**: esta spec não introduz `jest`/`vitest`
(mesmo padrão das specs 001/002). "Teste" aqui tem dois formatos: (a)
um script Node puro (`scripts/validate-compose-shape.mjs`, sem
dependência externa) que resolve `docker compose config --format json`
e confere a topologia de serviços contra as invariantes de
`data-model.md` (em especial: `eventpier-aws` nunca publica porta —
constitution §11); (b) os passos manuais de `quickstart.md`, tratados
como testes de integração de ponta a ponta (build, subida dos
containers, alcançabilidade). Ambos seguem TDD onde aplicável: T004
escrito e confirmado em RED antes de `docker-compose.yml` existir,
confirmado em GREEN na Fase Integração (T015).

`[P]` = paralelizável (arquivo diferente, sem dependência lógica de
outra task não concluída). Sem marcador = sequencial.

## Fase: Setup

- [X] **T001** Atualizar `package.json` da raiz: adicionar
  `"packageManager": "pnpm@11.10.0"`. Não alterar `devDependencies`
  (`typescript` continua `7.0.2`).
  _Origem: research.md Decisão 6; contracts/compose-shape.md ("package.json (raiz)")._

- [X] **T002** `[P]` Atualizar `apps/ui/tsconfig.json`: adicionar
  `"rootDir": "src"` em `compilerOptions`, mantendo `outDir: "dist"` e
  `include: ["src"]`.
  _Origem: research.md Decisão 4; contracts/compose-shape.md ("apps/ui/tsconfig.json")._

- [X] **T003** `[P]` Atualizar `providers/aws/tsconfig.json`: mesma
  mudança de T002, para `providers/aws`.
  _Origem: research.md Decisão 4; contracts/compose-shape.md ("providers/aws/tsconfig.json")._

## Fase: Testes

- [X] **T004** Criar `scripts/validate-compose-shape.mjs` (raiz do
  monorepo, sem dependência externa — mesmo padrão de
  `scripts/validate-contract-constants.mjs` da spec 002). Deve rodar
  `docker compose config --format json` (via `node:child_process`),
  parsear a saída e validar:
  - **Caso feliz**: `services["eventpier-ui"].ports` inclui o
    mapeamento `3000:3000`; `services["ministack"].ports` inclui
    `4566:4566`; a rede `eventpier-net` está declarada com
    `driver: bridge`.
  - **Invariante de segurança (constitution §11)**: `services["eventpier-aws"].ports`
    é `undefined`/vazio — se houver qualquer porta publicada aqui, a
    validação deve falhar com mensagem explícita citando a violação do
    princípio 11.
  - **Edge case**: `services["ministack"].profiles` inclui exatamente
    `"managed-env"` — confirma que o serviço não sobe por padrão.
  - **Caso de erro**: se `docker compose config` falhar (ex.:
    `docker-compose.yml` ainda não existe, ou nenhum `Dockerfile`
    referenciado existe), falhar com mensagem clara, sem stack trace
    bruto do subprocess.
  Rodar `node scripts/validate-compose-shape.mjs` agora e confirmar que
  **falha** (RED) pelo caso de erro acima — `docker-compose.yml` ainda
  não existe.
  _Origem: spec.md FR3, FR4, FR5, FR6; data-model.md (entidade `Service`, invariante); plan.md (conformidade constitution §7/§11)._

## Fase: Core

- [X] **T005** `[P]` Substituir `apps/ui/src/index.ts` (hoje
  `export {}` da spec 001) pelo servidor HTTP mínimo descrito em
  `contracts/compose-shape.md` — só `node:http`, escuta na porta 3000,
  responde texto identificando-se como placeholder da spec 003.
  _Origem: research.md Decisão 3; spec.md FR9 (Critério de Sucesso "UI acessível pelo host")._

- [X] **T006** `[P]` Substituir `providers/aws/src/index.ts` pelo
  equivalente para `providers/aws` — porta 4000.
  _Origem: research.md Decisão 3; data-model.md (entidade `PlaceholderServer`)._

- [X] **T007** `[P]` Atualizar `apps/ui/package.json`: `version`
  `0.1.0` → `0.2.0`, `scripts.build: "tsc -p tsconfig.json"`,
  `scripts.start: "node dist/index.js"`.
  _Origem: research.md Decisão 5; contracts/compose-shape.md ("apps/ui/package.json")._

- [X] **T008** `[P]` Atualizar `providers/aws/package.json`: mesma
  mudança de T007, para `providers/aws`.
  _Origem: research.md Decisão 5; contracts/compose-shape.md ("providers/aws/package.json")._

- [X] **T009** Checkpoint nativo (sem Docker ainda), sequencial —
  depende de T001-T008: rodar `pnpm -r exec tsc --noEmit`,
  `pnpm --filter @eventpier/ui build`,
  `pnpm --filter @eventpier/provider-aws build`. Confirmar que os três
  comandos terminam sem erro e que `apps/ui/dist/index.js` e
  `providers/aws/dist/index.js` são gerados, **antes** de criar
  qualquer artefato Docker — isola se um problema é de TypeScript/pnpm
  ou de Docker.
  _Origem: plan.md, "Observação para /tasks", passo 5; quickstart.md passo 1._

- [X] **T010** `[P]` Criar `.dockerignore` na raiz do monorepo
  (`node_modules`, `**/node_modules`, `dist`, `**/dist`, `.git`,
  `.env`, `.env.local`, `*.log`, `.DS_Store`).
  _Origem: research.md Decisão 2; contracts/compose-shape.md (".dockerignore")._

- [X] **T011** `[P]` Criar `apps/ui/Dockerfile` (multi-stage: `base` →
  `deps` → `build` → `runtime`), exatamente como
  `contracts/compose-shape.md` ("apps/ui/Dockerfile") — sem copiar
  `node_modules` para a imagem final (research.md, Decisão 2).
  _Origem: spec.md FR2; research.md Decisão 2, 6._

- [X] **T012** `[P]` Criar `providers/aws/Dockerfile` — equivalente a
  T011 para `providers/aws`, porta 4000.
  _Origem: spec.md FR2; research.md Decisão 2, 6._

- [X] **T013** Criar `docker-compose.yml` na raiz — depende de T011 e
  T012 (referencia os dois Dockerfiles). Três serviços
  (`eventpier-ui`, `eventpier-aws`, `ministack`), rede `eventpier-net`,
  exatamente como `contracts/compose-shape.md` ("docker-compose.yml"):
  `eventpier-aws` sem `ports:`; `ministack` com
  `profiles: ["managed-env"]` e `image: ministackorg/ministack:latest`;
  `eventpier-aws` com `extra_hosts: ["host.docker.internal:host-gateway"]`
  e as três variáveis de ambiente com default `${VAR:-default}`.
  _Origem: spec.md FR1, FR3, FR4, FR5, FR6, FR7, FR8; data-model.md (entidades `Service`, `EnvVar`); research.md Decisões 1, 7, 8, 9._

- [X] **T014** `[P]` Criar `.env.example` na raiz, documentando
  `MINISTACK_ENDPOINT`, `MINISTACK_MANAGED`, `HEALTH_CHECK_TTL_MS` sem
  valores reais.
  _Origem: research.md Decisão 9; contracts/compose-shape.md (".env.example")._

## Fase: Integração

Ordem sequencial — cada task assume o estado deixado pela anterior.

- [X] **T015** Rodar `node scripts/validate-compose-shape.mjs`.
  Confirmar que agora passa (GREEN — T004 encontra o
  `docker-compose.yml` criado em T013 com a forma esperada).
  _Valida: T004; spec.md FR4 (constitution §11)._

- [X] **T016** Rodar `docker compose build`. Confirmar que
  `eventpier-ui` e `eventpier-aws` buildam sem erro, sem depender de
  nenhuma imagem publicada em registry.
  _Valida: quickstart.md passo 2; spec.md FR2, Critério de Sucesso "sem imagem publicada externamente"._

- [X] **T017** Rodar `docker compose --profile managed-env up -d --build`
  e `docker compose ps`. Confirmar os três serviços `Up`. Rodar
  `curl -s http://localhost:3000` e
  `curl -s http://localhost:4566/_ministack/health`. Confirmar
  respostas do placeholder de `eventpier-ui` e de saúde do MiniStack.
  _Valida: quickstart.md passo 3; spec.md FR1, FR5, Critério de Sucesso 1._
  **Nota**: porta 4566 já ocupada por um MiniStack pré-existente neste
  host (ver research.md, "Decisões durante a implementação") — o
  `ministack` gerenciado pelo Compose não pôde subir neste ambiente
  específico. `eventpier-ui`/`eventpier-aws` confirmados via
  `curl localhost:3000`; `_ministack/health` confirmado contra o
  MiniStack pré-existente (mesma URL/porta, serviço equivalente).
  Estrutura do `ministack` gerenciado já validada por T004/T015.

- [X] **T018** Confirmar que `eventpier-aws` **não** é alcançável do
  host (`curl -sf http://localhost:4000` deve falhar).
  _Valida: quickstart.md passo 4; spec.md FR4, Critério de Sucesso 3; T004._

- [X] **T019** Confirmar que `eventpier-aws` **é** alcançável pela rede
  interna (`docker compose exec eventpier-ui wget -qO- http://eventpier-aws:4000`
  retorna o texto do placeholder).
  _Valida: quickstart.md passo 5; spec.md FR3._

- [X] **T020** Rodar `docker compose down`, depois
  `docker compose up -d --build` (sem `--profile`). Confirmar via
  `docker compose ps` que `ministack` não sobe — só `eventpier-ui` e
  `eventpier-aws`.
  _Valida: quickstart.md passo 6; spec.md FR6, Critério de Sucesso 2._

- [X] **T021** Apontar `eventpier-aws` para um MiniStack externo via
  `MINISTACK_ENDPOINT`/`MINISTACK_MANAGED` (sem subir o `ministack`
  gerenciado). Confirmar que as variáveis chegam corretas ao container
  (`printenv`).
  _Valida: quickstart.md passo 7; spec.md FR7, Critério de Sucesso 2; research.md Decisão 8 (Linux)._
  **Nota**: usado o MiniStack pré-existente do host em vez de subir um
  descartável (mesmo cenário, ver nota de T017). A conectividade TCP
  via `host.docker.internal`/gateway da rede foi recusada neste host
  especificamente por `userland-proxy=false` no Docker daemon — L3
  (ping) e as variáveis de ambiente confirmados corretos; TCP
  cross-bridge é limitação deste host, não do `docker-compose.yml`
  (detalhe completo em research.md, "Decisões durante a
  implementação").

- [X] **T022** Rodar `HEALTH_CHECK_TTL_MS=8000 docker compose up -d` e
  `docker compose exec eventpier-aws printenv HEALTH_CHECK_TTL_MS`.
  Confirmar `8000`, sem rebuild de imagem.
  _Valida: quickstart.md passo 8; spec.md FR8, Critério de Sucesso 4._

- [X] **T023** Rodar `docker compose --profile managed-env down` para
  limpar o ambiente de teste.
  _Valida: quickstart.md passo 9._

## Fase: Polish

- [ ] **T024** Atualizar `.pipeline/quality-gates.md`: estender a
  linha **Build** existente para incluir
  `pnpm --filter @eventpier/provider-aws build` e
  `pnpm --filter @eventpier/ui build`; adicionar uma linha nova
  **Docker** (`docker compose build`, critério: exit code 0) logo após
  Build e antes de Testes; encadear
  `node scripts/validate-compose-shape.mjs` na linha **Testes**
  existente.
  _Origem: plan.md, "Observação para /tasks", passo 10._

- [ ] **T025** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: ajuste na
  filtragem de profile do `docker compose config` em T004, se
  necessário).

- [ ] **T026** `[P]` Rodar `git status --short`. Confirmar que as
  mudanças ficam restritas aos arquivos listados em `quickstart.md`
  passo 10 — nenhuma mudança em `packages/contracts/`, nenhum endpoint
  HTTP real, nenhuma tela de UI.
  _Valida: quickstart.md passo 10; spec.md "Fora do escopo desta spec"._

- [ ] **T027** Revisão final contra `spec.md` → "Critérios de
  Sucesso": confirmar, lendo o código produzido (não só rodando
  gates), que os quatro critérios estão satisfeitos e que nenhuma
  task desta spec criou lógica de negócio, rota real ou dependência de
  runtime nova em `apps/ui`/`providers/aws` além do placeholder
  descrito em `research.md` Decisão 3.
