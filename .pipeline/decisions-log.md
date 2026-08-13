# Log de Decisões — Eventpier

Registro cronológico e agregado de decisões técnicas e de produto que
emergiram durante a implementação de specs — principalmente as que
**não** estavam previstas no `/plan` original (edge case descoberto na
hora, biblioteca que não se comportou como esperado, desvio consciente
do plano).

Diferente de `roadmap.md` (status, escaneável, uma linha por spec —
lido toda vez que `/specify` ou `/pipeline-status` roda), este arquivo
é de **leitura ocasional**: consulte quando precisar de contexto
histórico, ou periodicamente para revisar se algum padrão recorrente
merece virar princípio formal em `ARQUIVO_REGRAS`. Não é lido
automaticamente por nenhum comando do pipeline durante a execução
normal — só quando explicitamente pedido.

Cada spec concluída ganha uma entrada, adicionada pelo `/review-pr`
(Etapa 8, pós-merge). Decisões antecipadas no planejamento (o caso
comum) já ficam documentadas no `research.md` da própria spec — só
repita aqui o que for relevante além do que já está lá, ou um resumo
de 1 linha com link/referência se quiser evitar duplicação.

---

## 001-setup-monorepo-workspaces — Setup do monorepo (2026-08-12)

- TypeScript fixado em `7.0.2` (última versão estável no npm registry,
  mas lançada depois do conhecimento treinado do modelo que
  implementou a spec — compatibilidade com Next.js/Storybook não
  verificada). Confirmado explicitamente com o usuário, ciente do
  risco. Reavaliar na spec 009 (skeleton Next.js) se o ecossistema
  ainda não acompanhou esse major.
- pnpm escolhido como gerenciador de workspaces (não npm/yarn), sem
  Turborepo/Nx — resolve o problema real (isolamento de dependências,
  "phantom dependencies") sem a complexidade de orquestração que 3
  workspaces sem grafo de build ainda não justificam (princípio 12).
- `"type": "module"` adicionado aos 3 `package.json` — achado do
  `/review-pr` da PR #1: `module: "ESNext"` em `tsconfig.base.json`
  sem esse campo faria Node interpretar o `.js` gerado como CommonJS,
  quebrando em runtime assim que `providers/aws` (sem bundler)
  ganhasse código real. `tsc --noEmit` não detectava isso.
- Corrigido um gap real do próprio pipeline, descoberto durante esta
  feature: `/specify` passou a criar a branch já no início (antes só
  `/implement` criava, então os commits de specify/plan/tasks caíam
  direto na `main`). Uma segunda rodada de correção alinhou o nome da
  branch a `feature/<NNN>-<slug>` (Git Flow, `memory/constitution.md`)
  depois que a primeira tentativa (`<NNN>-<slug>` sem prefixo) violou
  essa regra — achado no próprio `/review-pr` da PR #1. A branch e a PR
  desta feature precisaram ser renomeadas/recriadas (PR #1 → #2) por
  causa disso.

## 002-definir-contrato-compartilhado — Contrato Compartilhado (2026-08-12)

- `packages/contracts/tsconfig.json` ganhou `rootDir: "src"` explícito,
  não previsto no plano original. TypeScript 7 falha (`TS5011`) ao
  emitir declarations de múltiplos arquivos fonte sem `rootDir`
  explícito, e sem ele o build caía em `dist/src/index.js` em vez de
  `dist/index.js`, quebrando `main`/`types` do `package.json`. A spec
  001 nunca builda de verdade (só `tsc --noEmit`), por isso o gap só
  apareceu aqui. Sinal para `providers/aws`/`apps/ui`: esperar o mesmo
  erro na primeira vez que rodarem um build real com
  `declaration: true`.
- `packages/contracts/tsconfig.build.json` criado (achado do
  `/review-pr` desta PR): `contract-shape.check.ts` — fixture interna
  de teste de forma, nunca reexportada — vazava para `dist/` junto com
  a API pública. Corrigido com um tsconfig de build separado que a
  exclui da emissão, mantendo-a coberta pelo gate Typecheck.

## 003-configurar-docker-compose — Docker Compose do MVP (2026-08-13)

- Imagens de `eventpier-ui`/`eventpier-aws` via build local
  (Dockerfile multi-stage), não `image:` publicada — decisão tomada
  ainda no `/specify`, já que a CI de publicação (spec 004) não existe
  neste ponto do roadmap; inverter essa dependência teria sido pior
  que buildar local.
- `@types/node` adicionado como devDependency da raiz, e `"types":
  ["node"]` nos tsconfigs de `apps/ui`/`providers/aws` (não em
  `tsconfig.base.json`) — necessário assim que os dois workspaces
  ganharam código real usando `node:http`/`console` pela primeira vez;
  `packages/contracts` nunca precisou disso.
- `scripts/validate-compose-shape.mjs` precisou de
  `docker compose --profile managed-env config` (não só
  `docker compose config`) — sem o profile explícito, o Compose omite
  serviços com profile (`ministack`) da configuração resolvida, o
  mesmo filtro aplicado a `up`/`ps`.
- Dois achados específicos do ambiente de dev, sem impacto no
  `docker-compose.yml`: uma porta 4566 já ocupada por um MiniStack
  pré-existente no host (não relacionado a este projeto) impediu
  validar o `ministack` gerenciado na primeira tentativa — repetido
  com sucesso depois, com a porta livre; e `host.docker.internal`
  resolve corretamente mas a conexão TCP é recusada neste host
  específico por rodar o Docker daemon com `userland-proxy=false` —
  documentado como limitação conhecida em
  `docs/features/docker-compose.md`, não como bug do Compose.

## 004-configurar-ci-path-providers — CI com Gatilho por Path (2026-08-13)

- Nenhum desvio do plano durante a implementação: `ci.yml`,
  `publish-provider-aws.yml` e `scripts/validate-ci-workflow-shape.mjs`
  saíram exatamente como desenhados em `research.md`/
  `contracts/ci-workflow-shape.md` — RED antes dos workflows existirem,
  GREEN na primeira tentativa depois de criá-los, sem nenhuma correção
  de forma.
- `docker compose build` reaproveitou cache do BuildKit de sessões
  anteriores (specs 002/003) durante a validação local, terminando em
  segundos — não representa o tempo real de um runner do GitHub
  Actions partindo de cache frio; sinal para quem for monitorar a
  duração de `ci.yml` pela primeira vez em produção.
- Três follow-ups manuais pós-merge ficaram fora do que
  `secrets.GITHUB_TOKEN` consegue automatizar (violaria o requisito de
  "sem segredo externo" da spec se forçado): marcar `validate` como
  required status check na branch protection de `main` (só possível
  depois do primeiro run real), marcar o pacote `eventpier-aws` do
  GHCR como público (nasce privado por padrão, comportamento do
  GitHub, não bug), e confirmar o comportamento real do gatilho por
  path (PR sem tocar `providers/` não publica; merge em
  `providers/aws/**` ou só em `packages/contracts/**` publica). Ver
  `research.md`, Decisões 5 e 8.

## 013-ativar-ci-path-providers — Ativação Operacional do CI (2026-08-13)

- Este repositório usa **Rulesets**, não Branch Protection clássica —
  `gh api .../branches/main/protection` retorna 404. O required status
  check foi adicionado ao Ruleset já existente ("Protect main - PR
  only", `id: 20759671`) via `PUT`, não descoberto em nenhum plano
  anterior; achado só nesta spec ao investigar por que o job `validate`
  não bloqueava merge.
- Payload da regra `required_status_checks` com `"integration_id":
  null"` explícito é rejeitado pela API (`422`) — o campo precisa ficar
  **ausente**, não nulo, quando não usado. Corrigido no research.md
  desta spec após a tentativa real falhar.
- A restrição real da spec 004 (Decisão 2: "criação de pacote da org")
  não era sobre criação — a primeira publicação teve sucesso de
  primeira. A restrição real apareceu na **visibilidade**: a
  organização tinha "Public"/"Internal" desabilitados para pacotes,
  exigindo um segundo ajuste manual do usuário em
  `settings/packages`, não previsto no plano original.
- Todos os 4 requisitos funcionais foram confirmados com evidência real
  (PRs #7-#10, runs de Actions, `docker pull`), não apenas configuração
  — ver `data-model.md` desta spec para os links.

<!-- Exemplo (apagar ao usar):
## 017-user-auth — Autenticação de usuário (2026-08-08)

- Optamos por refresh token rotativo em vez de token de vida longa,
  após o Critic (software-dev-panel) apontar risco de replay em
  ambiente sem HTTPS obrigatório em dev. Ver research.md da spec para
  as alternativas consideradas e rejeitadas.
- A biblioteca X não suportava o fluxo Y nativamente durante o
  /implement; workaround aplicado em infrastructure/auth/. Se esse
  mesmo problema aparecer em outra spec, considerar abstrair como
  serviço compartilhado em vez de repetir o workaround.
-->

---

## Como revisar

Periodicamente (sugestão: a cada 5-10 specs concluídas, ou quando o
arquivo passar de uma tela de altura), releia as entradas e pergunte:
algum padrão aparece mais de uma vez? Se sim, é candidato a virar
princípio formal em `ARQUIVO_REGRAS`, em vez de continuar sendo
"lembrado" spec a spec neste log.

Depois de promover um padrão para `ARQUIVO_REGRAS`, as entradas antigas
que o originaram podem ficar como estão (histórico) — não é necessário
apagar ou reescrever o log.
