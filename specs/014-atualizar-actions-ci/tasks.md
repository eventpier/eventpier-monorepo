# Tasks — Atualizar actions/checkout e actions/setup-node (014)

Fonte: `spec.md` (Critérios de Aceite 1-5), `research.md` (Decisões
1-4), `data-model.md` (entidade `PinnedAction`, estado atual vs.
alvo), `contracts/ci-workflow-shape-addendum.md`, `quickstart.md`
(passos 1-5).

**Nota de natureza das tasks**: como em `specs/013-ativar-ci-path-providers`,
esta spec não tem test runner de aplicação (nenhum código de produto
muda) — a "task de teste" é estender o script de validação estrutural
já existente (`validate-ci-workflow-shape.mjs`) e confirmar RED antes
da correção (T002) e GREEN depois (T005), preservando o espírito TDD.

`[P]` = paralelizável (arquivos diferentes). Sem marcador = sequencial.

**⚠ Ação visível no GitHub**: T007 abre um Pull Request real contra
`main` para capturar a evidência da Annotation. Confirmar com o
usuário antes de executar, mesmo em `MODO_EXECUCAO: encadeado` — não é
dispensado automaticamente (mesmo critério de `specs/013-ativar-ci-path-providers/tasks.md`).

## Fase: Setup

- [X] **T001** Confirmar estado atual antes de qualquer mudança:
  `grep -n "actions/checkout@v4\|actions/setup-node@v4" .github/workflows/*.yml`
  retorna exatamente 3 ocorrências (`ci.yml` × 2 — checkout e
  setup-node —, `publish-provider-aws.yml` × 1 — checkout). Confirmar
  branch local `fix/014-atualizar-actions-ci` contém os commits de
  `/specify-tech` e `/plan` desta spec.
  _Origem: data-model.md, "Instâncias — estado atual"._

## Fase: Testes

- [X] **T002** Estender `scripts/validate-ci-workflow-shape.mjs` com as
  chamadas novas de `checkPinnedBySha` (sem alterar a função em si):
  `actions/checkout` e `actions/setup-node` no bloco de `ci.yml`;
  `actions/checkout` no bloco de `publish-provider-aws.yml` — código
  exato em `contracts/ci-workflow-shape-addendum.md`. Rodar
  `node scripts/validate-ci-workflow-shape.mjs` **antes** de tocar nos
  workflows: deve **FALHAR**, reportando as 3 violações novas (tag
  mutável em vez de SHA para as duas actions) — estado RED confirmado
  antes da correção.
  _Origem: research.md, Decisão 3; spec.md, Critério de Aceite 3._

## Fase: Core

- [ ] **T003** `[P]` Atualizar `.github/workflows/ci.yml`: bump
  `actions/checkout` para
  `@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1` e
  `actions/setup-node` para
  `@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0` — manter
  `with: { node-version: "24" }` inalterado no step de setup-node.
  _Origem: data-model.md, "Instâncias — estado-alvo"; spec.md, Critérios de Aceite 1-2._

- [ ] **T004** `[P]` Atualizar `.github/workflows/publish-provider-aws.yml`:
  bump `actions/checkout` para
  `@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`. Nenhum outro
  step do arquivo muda (`docker/login-action`, `docker/build-push-action`
  permanecem exatamente como estão).
  _Origem: data-model.md, "Instâncias — estado-alvo"; spec.md, Critérios de Aceite 1-2._

- [ ] **T005** Re-rodar `node scripts/validate-ci-workflow-shape.mjs`
  agora com T003/T004 aplicados — deve terminar `OK` (exit code 0),
  confirmando GREEN.
  _Valida: T002, T003, T004; spec.md, Critério de Aceite 3._

## Fase: Integração

- [ ] **T006** Regressão do gate (prova de que a checagem nova
  realmente pega o problema, não só está presente): reverter
  temporariamente o pin de `actions/checkout` em `ci.yml` de volta
  para uma tag (`@v7.0.1`, sem SHA); rodar o script do passo anterior
  e confirmar que falha de novo, com mensagem no mesmo formato já
  usada para `docker/login-action`/`docker/build-push-action` (achado
  da PR #6), só trocando o nome da action. Desfazer a reversão antes
  de prosseguir (voltar ao estado GREEN de T005).
  _Valida: spec.md, Critério de Aceite 3 ("regressão futura... deve falhar o gate")._

- [ ] **T007** ⚠ Abrir um Pull Request de teste contra `main` (mudança
  trivial, ex.: espaço em branco num comentário, revertida depois) só
  para disparar `ci.yml` de verdade. Abrir a run do job `validate` no
  GitHub Actions e inspecionar as Annotations: confirmar a **ausência**
  de "Node.js 20 is deprecated...". Confirmar que o job `validate`
  continua concluindo com sucesso. Registrar o link da run em
  `research.md` → "Decisões durante a implementação". Fechar o PR de
  teste sem merge ao final (a menos que o usuário prefira reaproveitá-lo
  como o PR real desta spec — decisão de `/review-pr`, não desta task).
  _Valida: spec.md, Critério de Aceite 4; quickstart.md, passo 4._

- [ ] **T008** Validar sintaticamente `publish-provider-aws.yml`
  (`python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/publish-provider-aws.yml'))"`
  ou equivalente) — sua execução real fica adiada para o próximo push
  legítimo que toque `providers/aws/**`/`packages/contracts/**`
  (quickstart.md, passo 5; mesmo padrão de verificação adiada de
  `specs/013-ativar-ci-path-providers/data-model.md`, FR2).
  _Valida: spec.md, Critério de Aceite 1 (parcial — sintaxe, não execução)._

## Fase: Polish

- [ ] **T009** `[P]` Preencher `research.md` → "Decisões durante a
  implementação" com qualquer achado não previsto (ex.: se as versões
  v7.0.1/v7.0.0 resolvidas no `/plan` ainda eram as mais recentes no
  momento do `/implement`, ou se mudaram).

- [ ] **T010** `[P]` Atualizar `quickstart.md` (ou `research.md`) com o
  link real do PR/run de T007 como evidência — mesmo espírito da
  tabela `RequirementEvidence` de `specs/013-ativar-ci-path-providers/data-model.md`,
  sem precisar replicar a estrutura de tabela (esta spec não tem
  múltiplos requisitos com evidências paralelas, um parágrafo basta).

- [ ] **T011** Revisão final contra `spec.md` → "Critérios de Aceite"
  (1-5): confirmar cada um com a evidência registrada em T009/T010, e
  preparar o resumo para `/review-pr`.
