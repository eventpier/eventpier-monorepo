# Tasks — EnvironmentConfig (`endpoint` / `managed`) (007)

Fonte: `spec.md` (requisitos funcionais RF1-RF8), `plan.md`,
`research.md` (decisões 1-8), `data-model.md` (`Environment`,
`resolveEnvironmentConfig`, `InvalidEnvironmentConfigError`),
`contracts/environment-config-shape.md`, `quickstart.md`.

**Nota de abordagem de teste**: mesmo padrão de
`specs/006-cachear-health-check` — Vitest já está configurado em
`providers/aws` desde aquela spec, reaproveitado aqui sem nenhuma
mudança em `package.json`/dependências (por isso não há Fase Setup
nesta spec: nada precisa ser instalado ou configurado antes dos
testes). TDD literal:
`providers/aws/src/config/environment.config.test.ts` (Fase Testes) é
escrito e confirmado em **RED** antes de `environment.config.ts`
existir, depois confirmado em **GREEN** na Fase Integração, contra a
implementação real da Fase Core.

`[P]` = paralelizável (arquivo diferente, sem dependência lógica de
outra task não concluída na mesma fase). Sem marcador = sequencial.

## Fase: Testes

- [X] **T001** Criar `providers/aws/src/config/environment.config.test.ts`
  exatamente como em `contracts/environment-config-shape.md`. Deve
  validar:
  - **Default sem nenhuma variável de ambiente**: retorna
    `{ id: "ministack", endpoint: "http://ministack:4566", managed: true }`.
  - **`MINISTACK_ENDPOINT` customizado, `MINISTACK_MANAGED` ausente**:
    `managed` permanece `true`, `endpoint` reflete o valor customizado.
  - **`MINISTACK_MANAGED` case-insensitive**: `"true"`, `"TRUE"`,
    `"True"` (parametrizado) resultam em `managed: true`.
  - **`managed: false` com endpoint customizado**: reflete
    exatamente `managed: false` e o `endpoint` informado.
  - **Fail-fast — `managed: false` sem endpoint**: lança
    `InvalidEnvironmentConfigError`.
  - **Fail-fast — `MINISTACK_MANAGED` não reconhecível** (ex.:
    `"talvez"`): lança `InvalidEnvironmentConfigError`.
  - Segue o padrão de `health-cache.test.ts` (spec 006): salva o valor
    original de `MINISTACK_ENDPOINT`/`MINISTACK_MANAGED` e restaura em
    `afterEach`, limpa ambas em `beforeEach`.
  Rodar `pnpm --filter @eventpier/provider-aws test` agora e confirmar
  que **falha** (RED): `./environment.config.js` não existe ainda.
  _Origem: spec.md RF1-RF6; research.md Decisões 4-6; data-model.md (tabela de resolução); contracts/environment-config-shape.md ("environment.config.test.ts")._

## Fase: Core

- [X] **T002** Criar `providers/aws/src/config/environment.config.ts`
  exatamente como em `contracts/environment-config-shape.md`: classe
  `InvalidEnvironmentConfigError`; `parseManaged(raw)` aceitando só
  `"true"`/`"false"` case-insensitive (ausente/vazio → default
  `true`; qualquer outro valor lança — `research.md`, Decisão 4);
  `resolveEnvironmentConfig()` lendo `process.env.MINISTACK_ENDPOINT`/
  `process.env.MINISTACK_MANAGED` diretamente (sem parâmetro de
  injeção — `research.md`, Decisão 6), retornando `endpoint` sempre
  preenchido (default `"http://ministack:4566"` — `research.md`,
  Decisão 5) e lançando quando `managed: false` sem endpoint (RF5).
  Depende de T001 existir (TDD).
  _Origem: spec.md RF1, RF3-RF6; data-model.md (todas as entidades); research.md Decisões 1, 4-6; contracts/environment-config-shape.md ("environment.config.ts")._

## Fase: Integração

Ordem sequencial — cada task assume o estado deixado pela anterior,
exceto onde marcado `[P]`.

- [X] **T003** Rodar `pnpm --filter @eventpier/provider-aws test`.
  Confirmar que agora **passa** (GREEN — T001 volta a passar contra o
  código real de T002), e que os testes já existentes de
  `health-cache.test.ts` (spec 006) continuam passando sem regressão.
  _Valida: T001._

- [X] **T004** Alterar `providers/aws/src/manifest/manifest.service.ts`
  exatamente como em `contracts/environment-config-shape.md`:
  `buildManifest()` vira `buildManifest(environment: Environment)`,
  usando o parâmetro recebido em vez do valor fixo no código. Import de
  `Environment` adicionado a partir de `@eventpier/contracts`. Nenhuma
  outra linha muda.
  _Origem: research.md Decisão 7; contracts/environment-config-shape.md ("manifest.service.ts")._

- [X] **T005** Alterar `providers/aws/src/index.ts` exatamente como em
  `contracts/environment-config-shape.md`: importar
  `resolveEnvironmentConfig`/`InvalidEnvironmentConfigError`; chamar
  `resolveEnvironmentConfig()` uma única vez antes da criação do
  `server`, dentro de um try/catch que, ao capturar
  `InvalidEnvironmentConfigError`, loga a mensagem em `stderr` e
  encerra com `process.exit(1)` — sem nunca chamar `server.listen`
  nesse caminho; repassar o `environment` resolvido para
  `buildManifest(environment)` dentro do handler de
  `GET /api/v1/manifest`. Depende de T004 (import de `Environment`
  já usado por `manifest.service.ts`).
  _Origem: spec.md RF5-RF7; research.md Decisões 2-3, 7; contracts/environment-config-shape.md ("index.ts")._

- [X] **T006** Rodar
  `pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build && pnpm -r exec tsc --noEmit`.
  Confirmar sem erros — `dist/config/environment.config.js` gerado.
  _Valida: quickstart.md passo 2._

- [X] **T007** `[P]` Alterar `scripts/validate-manifest-endpoint.mjs`
  exatamente como em `contracts/environment-config-shape.md`: a
  asserção de `environment` passa a exigir também
  `endpoint === "http://ministack:4566"`, além de `id`/`managed` já
  verificados. Nenhuma outra linha do script muda.
  _Origem: research.md Decisão 8; contracts/environment-config-shape.md ("validate-manifest-endpoint.mjs")._

- [X] **T008** `[P]` Criar `scripts/validate-environment-config.mjs`
  exatamente como em `contracts/environment-config-shape.md`: spawna
  `providers/aws/dist/index.js` real em três cenários — (1)
  `managed:false` + endpoint customizado válido, confirma que o
  processo sobe e o manifesto reflete exatamente o configurado; (2)
  `managed:false` sem endpoint, confirma que o processo encerra com
  código de saída diferente de zero, sem nunca logar "ouvindo na
  porta"; (3) `MINISTACK_MANAGED` com valor não reconhecível, mesmo
  comportamento do cenário 2.
  _Origem: spec.md RF5-RF7, Critérios de Sucesso; research.md Decisão 8; contracts/environment-config-shape.md ("validate-environment-config.mjs")._

- [X] **T009** Rodar
  `node scripts/validate-manifest-endpoint.mjs && node scripts/validate-environment-config.mjs`.
  Confirmar `OK` nos dois — cobre em conjunto o cenário default (RF2-3),
  o cenário externo customizado (RF1, RF4), e os dois cenários de
  fail-fast (RF5-RF6). Depende de T006, T007 e T008.
  _Valida: quickstart.md passos 3-6; spec.md Critérios de Sucesso (todos)._

- [ ] **T010** Rodar
  `docker compose --profile managed-env up --build -d` seguido de
  `docker compose logs eventpier-aws`. Confirmar que a mensagem
  "eventpier-aws ouvindo na porta 4000" aparece, sem nenhum erro —
  usando exatamente os defaults de `docker-compose.yml`
  (`MINISTACK_ENDPOINT`/`MINISTACK_MANAGED` já existentes desde a
  spec 003). Encerrar com `docker compose down` ao final.
  _Valida: quickstart.md passo 7; spec.md RF2 (comportamento default via Compose)._

- [ ] **T011** `[P]` Atualizar `.pipeline/quality-gates.md`: inserir
  `node scripts/validate-environment-config.mjs` ao final da cadeia de
  comandos da linha **Testes de integração** (após
  `validate-manifest-endpoint.mjs`); adicionar uma frase ao parágrafo
  explicativo abaixo da tabela descrevendo o novo script, no mesmo
  padrão das entradas anteriores.
  _Origem: research.md Decisão 8 ("Consequência para /tasks"); contracts/environment-config-shape.md ("quality-gates.md")._

- [ ] **T012** `[P]` Atualizar `.github/workflows/ci.yml`: inserir
  `node scripts/validate-environment-config.mjs` como última linha do
  bloco `run:` do step "Testes de integração (scripts de validação
  estrutural)", após `validate-manifest-endpoint.mjs`.
  _Origem: research.md Decisão 8 ("Consequência para /tasks"); contracts/environment-config-shape.md ("ci.yml")._

- [ ] **T013** Rodar `git status --short`. Confirmar que as mudanças
  ficam restritas a
  `providers/aws/src/config/environment.config.ts` (novo),
  `providers/aws/src/config/environment.config.test.ts` (novo),
  `providers/aws/src/manifest/manifest.service.ts`,
  `providers/aws/src/index.ts`, `scripts/validate-manifest-endpoint.mjs`,
  `scripts/validate-environment-config.mjs` (novo),
  `.pipeline/quality-gates.md`, `.github/workflows/ci.yml` — nenhuma
  mudança em `packages/contracts/src/`, `docker-compose.yml`,
  `.env.example`, `providers/aws/src/manifest/health-cache.ts` ou
  `apps/ui/`.
  _Valida: quickstart.md passo 8._

## Fase: Polish

- [ ] **T014** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: ajuste fino
  de algum caso de borda de `parseManaged` ou do timeout usado em
  `validate-environment-config.mjs` não coberto originalmente).

- [ ] **T015** `[P]` Rodar `find providers/aws/src -type f`. Confirmar
  que lista exatamente `index.ts`, `config/environment.config.ts`,
  `config/environment.config.test.ts`, `manifest/manifest.service.ts`,
  `manifest/health-cache.ts` e `manifest/health-cache.test.ts` —
  nenhum arquivo de `capabilities/` ou `adapters/` (spec 008) vazado
  de spec futura.
  _Origem: spec.md "Fora do escopo"._

- [ ] **T016** Revisão final contra `spec.md` → "Critérios de
  Sucesso" e "Requisitos Funcionais", lendo o código produzido (não só
  rodando gates): confirmar que nenhuma chamada de rede real ao
  MiniStack existe em `environment.config.ts`/`index.ts` (garante RF7
  "by construção" — o endpoint é só declarado, nunca verificado); que
  nenhuma ação de restart/start/stop foi introduzida em nenhum arquivo
  tocado (RF8); que as mensagens de erro de
  `InvalidEnvironmentConfigError` (T002) realmente identificam a causa
  (não são genéricas).
