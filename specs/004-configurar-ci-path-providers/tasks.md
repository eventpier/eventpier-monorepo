# Tasks — CI com Gatilho por Path para `providers/*` (004)

Fonte: `spec.md` (requisitos funcionais FR1-FR8), `plan.md`,
`research.md` (decisões 1-7), `data-model.md` (entidades `Workflow`,
`ProviderPublishTarget`), `contracts/ci-workflow-shape.md`,
`quickstart.md`.

**Nota de abordagem de teste**: assim como as specs 001-003, esta spec
não introduz `jest`/`vitest`. "Teste" aqui tem dois formatos: (a) um
script Node puro (`scripts/validate-ci-workflow-shape.mjs`, sem
dependência externa) que lê os dois arquivos de workflow como texto e
confere a forma esperada contra `contracts/ci-workflow-shape.md`; (b)
os passos manuais de `quickstart.md` — mas, diferente das specs
anteriores, as Fases 3-4 do `quickstart.md` só são executáveis **depois**
desta spec estar mergeada em `main` (comportamento real do GitHub
Actions/GHCR não é reproduzível localmente nem durante `/implement` —
ver T008). TDD onde aplicável: T002 escrito e confirmado em RED antes
dos workflows existirem (T003), confirmado em GREEN na Fase Integração
(T006).

`[P]` = paralelizável (arquivo diferente, sem dependência lógica de
outra task não concluída). Sem marcador = sequencial.

## Fase: Setup

- [ ] **T001** Rodar localmente os quality gates já existentes (antes
  de qualquer mudança desta spec) como checkpoint baseline:
  ```bash
  pnpm install --frozen-lockfile
  pnpm -r exec tsc --noEmit
  pnpm --filter @eventpier/contracts build
  pnpm --filter @eventpier/provider-aws build
  pnpm --filter @eventpier/ui build
  docker compose build
  node scripts/validate-workspace-manifests.mjs
  node scripts/validate-workspace-dependencies.mjs
  node scripts/validate-contract-constants.mjs
  node scripts/validate-compose-shape.mjs
  ```
  Confirmar que todos terminam com exit code 0 **antes** de tocar em
  CI — isola qualquer falha futura como proveniente desta spec, não de
  um estado pré-existente já quebrado.
  _Origem: quickstart.md Fase 1 (parcial — sem o script novo, que ainda não existe); research.md Decisão 6._

## Fase: Testes

- [ ] **T002** Criar `scripts/validate-ci-workflow-shape.mjs` (raiz do
  monorepo, sem dependência externa — mesmo padrão de
  `scripts/validate-compose-shape.mjs`: leitura de texto/regex sobre
  os arquivos YAML, sem parser). Deve validar:
  - **Caso feliz**: `.github/workflows/ci.yml` e
    `.github/workflows/publish-provider-aws.yml` existem e cada
    asserção de `contracts/ci-workflow-shape.md` → "Validação
    esperada" passa.
  - **`ci.yml`**: gatilho é `pull_request` com `branches: [main]`;
    **não** contém a chave `paths:` em nenhum nível do bloco `on:`
    (requisito funcional 1 — validação cobre todo PR, sem filtro).
    Contém, na lista de steps, `tsc --noEmit`, os três `pnpm --filter
    ... build`, `docker compose build` e as cinco chamadas
    `node scripts/validate-*.mjs` (as quatro já existentes + esta
    própria).
  - **`publish-provider-aws.yml`**: gatilho é `push` (nunca
    `pull_request`) com `branches: [main]`; `paths:` contém
    exatamente `providers/aws/**` **e** `packages/contracts/**`.
    `permissions.packages` é `write`. A lista `tags:` do
    `docker/build-push-action` inclui uma tag derivada de
    `GITHUB_SHA` (ex.: `sha-`) e a tag `latest`. `file:` é
    `providers/aws/Dockerfile`.
  - **Edge case (requisito funcional 3-4)**: falha explicitamente,
    com mensagem citando qual dos dois paths falta, se `paths:`
    contiver apenas um dos dois patterns exigidos (ex.: só
    `providers/aws/**`, sem `packages/contracts/**`).
  - **Segurança (requisito funcional 8)**: falha explicitamente se
    qualquer um dos dois arquivos referenciar `secrets.` com um nome
    diferente de `secrets.GITHUB_TOKEN` — sinal de um segredo externo
    não previsto pela spec.
  - **Caso de erro**: se um dos dois arquivos não existir, mensagem
    clara indicando qual falta (não stack trace bruto), `exit code 1`.
  _Origem: research.md (seção final, sobre o shape validator); contracts/ci-workflow-shape.md "Validação esperada"; spec.md requisitos funcionais 1, 3, 4, 5, 6, 8._

- [ ] **T003** Rodar `node scripts/validate-ci-workflow-shape.mjs`
  agora e confirmar que **falha** (RED) — nenhum workflow existe
  ainda em `.github/workflows/`.
  _Origem: TDD; espelha T004/T015 de `specs/003-configurar-docker-compose/tasks.md`._

## Fase: Core

- [ ] **T004** `[P]` Criar `.github/workflows/ci.yml` exatamente como
  descrito em `contracts/ci-workflow-shape.md` — gatilho
  `pull_request` contra `main`, sem filtro de path, `permissions:
  { contents: read }`, os quatro quality gates de
  `.pipeline/quality-gates.md` como steps (incluindo
  `node scripts/validate-ci-workflow-shape.mjs` na etapa de Testes).
  _Origem: spec.md requisitos funcionais 1, 2; research.md Decisões 2, 6; data-model.md (instância `Workflow` — `ci.yml`)._

- [ ] **T005** `[P]` Criar
  `.github/workflows/publish-provider-aws.yml` exatamente como
  descrito em `contracts/ci-workflow-shape.md` — gatilho `push` para
  `main` com `paths: [providers/aws/**, packages/contracts/**]`,
  `permissions: { contents: read, packages: write }`, login em
  `ghcr.io` via `docker/login-action` com `secrets.GITHUB_TOKEN`,
  build+push via `docker/build-push-action` do
  `providers/aws/Dockerfile` (contexto `.`), tags `sha-<7 chars>` e
  `latest`, plataforma `linux/amd64`.
  _Origem: spec.md requisitos funcionais 3, 4, 5, 6, 7, 8; research.md Decisões 2, 3, 4; data-model.md (instâncias `Workflow` e `ProviderPublishTarget` — `aws`)._

## Fase: Integração

Ordem sequencial — cada task assume o estado deixado pela anterior.

- [ ] **T006** Rodar `node scripts/validate-ci-workflow-shape.mjs`
  novamente. Confirmar que agora passa (GREEN — T002 encontra os dois
  workflows criados em T004/T005 com a forma esperada).
  _Valida: T002; contracts/ci-workflow-shape.md "Validação esperada"._

- [ ] **T007** Repetir a Fase 1 completa de `quickstart.md` (todos os
  dez comandos, agora incluindo
  `node scripts/validate-ci-workflow-shape.mjs`, que não existia em
  T001). Confirmar exit code 0 em todos — este é exatamente o
  conjunto de comandos que `ci.yml` executará no GitHub.
  _Valida: quickstart.md Fase 1._

- [ ] **T008** Registrar explicitamente (sem executar — não é possível
  nesta sessão) três follow-ups manuais pós-merge que não podem ser
  confirmados durante `/implement` nem localmente:
  1. Comportamento real no GitHub Actions (`quickstart.md` Fases 3-4):
     PR sem tocar `providers/` não publica; merge em
     `providers/aws/**` publica; merge só em
     `packages/contracts/**` também publica.
  2. Adicionar `validate` (job de `ci.yml`) como *required status
     check* na branch protection de `main`, possível só depois do
     primeiro merge (research.md, Decisão 8; `quickstart.md` Fase 3,
     passo 0).
  3. Marcar o pacote `eventpier-aws` do GHCR como público após a
     primeira publicação (research.md, Decisão 5; `quickstart.md`
     Fase 4).
  Anotar os três como follow-up manual pós-merge (não como pendência
  desta spec), a ser verificado por quem revisar/mergear a PR —
  criação de PR e push para o remoto são escopo de `/review-pr`, não
  de `/implement`.
  _Origem: `CLAUDE.md` (tabela do pipeline — `/implement` comita por task, `/review-pr` interage com o GitHub); quickstart.md Fases 3-4._

## Fase: Polish

- [ ] **T009** Atualizar `.pipeline/quality-gates.md`: encadear
  `node scripts/validate-ci-workflow-shape.mjs` na linha **Testes**
  existente; adicionar uma nota de contexto (mesmo padrão das notas já
  presentes no arquivo, ver texto sobre a linha **Docker** da spec
  003) registrando que, a partir desta spec, os quatro gates também
  rodam automaticamente em todo Pull Request via
  `.github/workflows/ci.yml` — deixam de ser apenas locais/manuais.
  _Origem: espelha T024 de `specs/003-configurar-docker-compose/tasks.md`; spec.md requisito funcional 1._

- [ ] **T010** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer decisão não prevista (ex.: ajuste na
  sintaxe exata do regex do shape validator, se necessário).

- [ ] **T011** `[P]` Rodar `git status --short`. Confirmar que as
  mudanças desta fase ficam restritas a `.github/workflows/ci.yml`,
  `.github/workflows/publish-provider-aws.yml`,
  `scripts/validate-ci-workflow-shape.mjs` e
  `.pipeline/quality-gates.md`. Nenhuma mudança em
  `docker-compose.yml` (research.md Decisão 7), nenhuma mudança em
  `packages/contracts/src/`.
  _Valida: quickstart.md Fase 5; spec.md "Fora do escopo desta spec"._

- [ ] **T012** Revisão final contra `spec.md` → "Critérios de
  Sucesso": para cada critério, confirmar explicitamente se já é
  verificável nesta sessão (ex.: `ci.yml` sem `paths:`, `paths:` de
  publish contendo os dois patterns exigidos, tags incluindo sha,
  permissões mínimas, nenhum segredo além de `GITHUB_TOKEN`) ou se
  depende de execução real no GitHub após o merge (os critérios que
  descrevem comportamento de PR/merge reais, e o critério
  explicitamente marcado como "projeção" sobre um segundo provider).
  Deixar essa distinção registrada no relatório de conclusão da
  feature, para `/review-pr` saber o que ainda precisa confirmação
  manual (ver T008).
