# Tasks — Endpoint de Manifesto (005)

Fonte: `spec.md` (requisitos funcionais FR1-FR9), `plan.md`,
`research.md` (decisões 1-9), `data-model.md` (instância de
`ProviderManifest` e as duas instâncias de `ProviderError`),
`contracts/manifest-endpoint-shape.md`, `quickstart.md`.

**Nota de abordagem de teste**: esta spec não introduz `jest`/`vitest`
(research.md, Decisão 8, seguindo o mesmo adiamento já registrado em
`specs/002-definir-contrato-compartilhado/research.md`, Decisão 7).
"Teste" aqui é um script Node puro
(`scripts/validate-manifest-endpoint.mjs`) que sobe o provider real
via `child_process.spawn` e faz requisições HTTP reais contra ele —
TDD nesse formato: o script é escrito e confirmado em RED antes de
`manifest.service.ts`/`index.ts` existirem (ou, se `dist/` já existir
de um build anterior do placeholder da spec 003, RED por o corpo não
ser um manifesto JSON válido), depois confirmado em GREEN na Fase
Integração.

`[P]` = paralelizável (arquivo diferente, sem dependência lógica de
outra task não concluída na mesma fase). Sem marcador = sequencial.

## Fase: Setup

- [X] **T001** Atualizar `providers/aws/package.json`: adicionar
  `"dependencies": { "@eventpier/contracts": "workspace:*" }`. Rodar
  `pnpm install` na raiz do monorepo para resolver o link de
  workspace (`node_modules/@eventpier/contracts` deve virar um
  symlink para `packages/contracts`).
  _Origem: research.md Decisão 2; contracts/manifest-endpoint-shape.md ("providers/aws/package.json")._

## Fase: Testes

- [X] **T002** Criar `scripts/validate-manifest-endpoint.mjs`
  exatamente como em `contracts/manifest-endpoint-shape.md`. Deve
  validar:
  - **Caso feliz**: `GET /api/v1/manifest` → 200, `contractVersion`
    igual ao `CONTRACT_VERSION` real importado de
    `packages/contracts/dist/index.js` (nunca um literal hardcoded no
    próprio script), `provider` = `{id:"aws",name:"AWS"}`,
    `environment` = `{id:"ministack",managed:true}`, `version` string
    não vazia, `capabilities` = `[]`.
  - **Erro — método não permitido**: `POST /api/v1/manifest` → 405,
    corpo `ProviderError` com `code` string e `retryable: false`.
  - **Erro — path desconhecido**: `GET /rota-inexistente` → 404,
    corpo `ProviderError` com `code` string e `retryable: false`.
  - **Caso de erro de pré-condição**: se `providers/aws/dist/index.js`
    ou `packages/contracts/dist/index.js` não existirem, falhar com
    mensagem clara instruindo rodar os builds primeiro — sem tentar
    subir o processo.
  - Encerra o processo filho (`child.kill()`) num `finally`, mesmo se
    alguma asserção falhar.
  Rodar `node scripts/validate-manifest-endpoint.mjs` agora e
  confirmar que **falha** (RED): `providers/aws/dist/index.js` ainda
  não existe (build nunca rodou nesta spec) **ou**, se um `dist/`
  antigo do placeholder da spec 003 sobrar de uma execução anterior,
  falha porque o corpo retornado não é JSON válido de manifesto.
  _Origem: research.md Decisão 8; contracts/manifest-endpoint-shape.md ("scripts/validate-manifest-endpoint.mjs"); spec.md FR1, FR5, FR6, FR7, FR8._

## Fase: Core

- [X] **T003** `[P]` Criar `providers/aws/src/manifest/manifest.service.ts`
  exatamente como em `contracts/manifest-endpoint-shape.md`:
  `buildManifest(): ProviderManifest` retornando `contractVersion`
  (de `CONTRACT_VERSION`, importado de `@eventpier/contracts`),
  `provider` fixo (`aws`/`AWS`), `environment` fixo
  (`ministack`/`managed: true`, sem `endpoint`), `version` lido de
  `providers/aws/package.json` via `readFileSync` (caminho relativo
  `../../package.json` a partir do próprio arquivo), `capabilities: []`.
  _Origem: spec.md FR1, FR2, FR3, FR4; data-model.md (instância de `ProviderManifest`); research.md Decisões 2-5._

- [X] **T004** Reescrever `providers/aws/src/index.ts` por completo
  (remove o placeholder de texto da spec 003), exatamente como em
  `contracts/manifest-endpoint-shape.md`: servidor `node:http` com
  dispatch manual — `GET /api/v1/manifest` → 200 +
  `buildManifest()`; qualquer outro método no mesmo path → 405 +
  `ProviderError` (`code: "METHOD_NOT_ALLOWED"`, header
  `Allow: GET`); qualquer outro path → 404 + `ProviderError`
  (`code: "NOT_FOUND"`). Mensagens de erro interpolam só `method`/
  `path` do próprio request (nunca stack trace ou variável de
  ambiente — `data-model.md`, invariante de `ProviderError`). Depende
  de T003 (`buildManifest` precisa existir).
  _Origem: spec.md FR1, FR5, FR6, FR7, FR9; data-model.md (instâncias de `ProviderError`); research.md Decisões 1, 7, 9._

## Fase: Integração

Ordem sequencial — cada task assume o estado deixado pela anterior.

- [X] **T005** Rodar
  `pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build`.
  Confirmar que ambos geram `dist/` sem erro (typecheck limpo,
  incluído no build).
  _Valida: quickstart.md passo 1; T001, T003, T004._

- [X] **T006** Rodar `pnpm --filter @eventpier/provider-aws start`
  e, em outro terminal,
  `curl -s http://localhost:4000/api/v1/manifest | jq`. Confirmar
  HTTP 200 e corpo exatamente conforme `data-model.md` (`version`
  batendo com o `version` atual de `providers/aws/package.json`).
  _Valida: quickstart.md passos 2-3; spec.md FR1, FR2, FR3, FR4, FR5, FR8._

- [X] **T007** Com o provider ainda rodando: `curl -si -X POST
  http://localhost:4000/api/v1/manifest` (confirmar 405, header
  `Allow: GET`, corpo `ProviderError` com `code:"METHOD_NOT_ALLOWED"`)
  e `curl -si http://localhost:4000/rota-que-nao-existe` (confirmar
  404, corpo `ProviderError` com `code:"NOT_FOUND"`). Encerrar o
  provider (`Ctrl+C`) ao final.
  _Valida: quickstart.md passos 4-6; spec.md FR6, FR7._

- [X] **T008** Rodar `node scripts/validate-manifest-endpoint.mjs`
  (com a porta 4000 livre — nenhuma outra instância do provider
  rodando). Confirmar que agora **passa** (GREEN — T002 volta a
  passar contra o código real de T003/T004).
  _Valida: T002._

- [X] **T009** Atualizar `providers/aws/Dockerfile` (arquivo completo)
  exatamente como em `contracts/manifest-endpoint-shape.md`: estágio
  `build` passa a copiar e buildar também `packages/contracts`;
  estágio `runtime` ganha as duas linhas `COPY` que recriam
  `node_modules/@eventpier/contracts/` a partir do `dist`/
  `package.json` buildados no estágio `build`.
  _Origem: research.md Decisão 6; contracts/manifest-endpoint-shape.md ("providers/aws/Dockerfile")._

- [X] **T010** Rodar `docker compose build`. Confirmar que
  `eventpier-ui` e `eventpier-aws` buildam sem erro — em particular,
  que o build de `eventpier-aws` resolve `@eventpier/contracts` a
  partir do `packages/contracts` agora copiado/buildado dentro do
  Dockerfile (T009), sem depender de nenhum estado fora da imagem.
  _Valida: quickstart.md passo 7._

- [X] **T011** Rodar `docker compose up -d --build` e repetir os três
  cenários (GET 200, POST 405, `GET` a path desconhecido 404) pela
  rede interna via
  `docker compose exec eventpier-ui wget ...`. Confirmar também que
  `curl http://localhost:4000/api/v1/manifest` a partir do host
  continua falhando (constitution, princípio 11 — inalterado por esta
  spec). Rodar `docker compose down` ao final.
  _Valida: quickstart.md passos 8-10._

- [ ] **T012** Atualizar `.pipeline/quality-gates.md`: linha
  **Testes** ganha `&& node scripts/validate-manifest-endpoint.mjs`
  encadeado ao final do comando existente. Linha **Build** não muda
  (a ordem `@eventpier/contracts` antes de `@eventpier/provider-aws`
  já está correta desde a spec 003).
  _Origem: research.md Decisão 8 ("Consequência para /tasks")._

- [ ] **T013** Rodar `git status --short`. Confirmar que as mudanças
  ficam restritas a `providers/aws/src/index.ts`,
  `providers/aws/src/manifest/manifest.service.ts` (novo),
  `providers/aws/package.json`, `providers/aws/Dockerfile`,
  `scripts/validate-manifest-endpoint.mjs` (novo),
  `.pipeline/quality-gates.md`, `pnpm-lock.yaml` (atualizado por
  T001) — nenhuma mudança em `apps/ui/`, `docker-compose.yml`,
  `.github/workflows/` ou `packages/contracts/src/`.
  _Valida: quickstart.md passo 11._

## Fase: Polish

- [ ] **T014** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: ajuste fino
  do timeout/heurística de "provider subiu" em T002, se o log de
  startup não for suficiente na prática).

- [ ] **T015** `[P]` Rodar `find providers/aws/src -type f`. Confirmar
  que lista exatamente `index.ts` e `manifest/manifest.service.ts` —
  nenhum arquivo de `health-cache.ts` (spec 006), `capabilities/`
  (spec 008), `adapters/` (spec 008) ou `config/environment.config.ts`
  (spec 007) vazado de specs futuras.
  _Origem: spec.md "Fora do escopo"._

- [ ] **T016** Revisão final contra `spec.md` → "Critérios de
  Sucesso": confirmar, lendo o código produzido (não só rodando
  gates), que o corpo de `GET /api/v1/manifest` é validável
  programaticamente contra `ProviderManifest` sem campo extra nem
  faltando; que o placeholder da spec 003 não é mais alcançável em
  nenhum path (T011 já validou via Docker); e que
  `docker compose up` sobe `eventpier-aws` respondendo corretamente
  sem exigir nenhuma configuração além da já existente desde a spec
  003.
