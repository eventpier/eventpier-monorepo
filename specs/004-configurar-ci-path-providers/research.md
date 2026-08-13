# Research — CI com Gatilho por Path para `providers/*` (004)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípios 3 (isolamento
  de release por path), 4 (contrato aditivo), 10 (sem autenticação em
  ambientes locais — não se aplica ao registry, que é externo, mas
  informa o requisito de "sem segredo externo" da spec) e 12
  (abstração só após necessidade comprovada).
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seção 2 (Estado 3 —
  `eventpier-providers` como monorepo permanente) e seção 9 ("CI com
  gatilho por path já deve existir desde o MVP").
- `spec.md` desta feature, incluindo as duas clarificações já
  resolvidas durante `/specify`: (a) o gatilho por path cobre
  `providers/**` **e** `packages/contracts/**`; (b) a publicação de
  imagem ocorre a cada merge em `main`, sem exigir tag/release manual.
- `.pipeline/quality-gates.md` — gates existentes (Typecheck, Build,
  Docker, Testes) que a validação de PR desta spec deve executar.
- `specs/003-configurar-docker-compose/research.md`, Decisão 6 (Node
  24 + `pnpm@11.10.0` via Corepack, pinados) e Decisão 2 (Dockerfiles
  multi-stage de `apps/ui`/`providers/aws`, contexto de build = raiz do
  monorepo) — este CI reaproveita ambos exatamente como já validados,
  em vez de redecidir versões/estrutura.
- Estado atual do repositório: nenhum diretório `.github/workflows/`
  existe — esta spec cria a primeira automação de CI do projeto.

Nenhum conflito entre spec e regras/arquitetura foi encontrado.

## Decisão 1 — Motor de CI: GitHub Actions

**Decisão**: usar GitHub Actions, nativo do host do repositório
(GitHub), sem contratar/configurar nenhum serviço de CI de terceiro.

**Justificativa**: o repositório já vive no GitHub (PRs, branch
protection, `gh` CLI usados em todo o pipeline deste projeto);
GitHub Actions roda sem custo adicional em repositório público e
integra nativamente com Pull Requests (status checks) e com o GitHub
Container Registry via `GITHUB_TOKEN` — satisfaz o requisito funcional
8 da spec ("sem segredo externo não documentado") sem esforço extra.
Nenhuma alternativa (CircleCI, GitLab CI, etc.) foi seriamente
considerada: exigiria uma conta/serviço externo adicional sem nenhum
ganho para o escopo desta spec.

## Decisão 2 — Dois workflows separados: validação (todo PR) e publish (path-scoped, só em `main`)

**Decisão**: `.github/workflows/ci.yml` roda em todo `pull_request`
contra `main`, **sem** filtro de path, executando os quality gates de
`.pipeline/quality-gates.md` sobre o monorepo inteiro (requisito
funcional 1). `.github/workflows/publish-provider-aws.yml` roda em
`push` para `main` (não em `pull_request`), **com** filtro de path
(Decisão 3) — só esse evento builda e publica a imagem do provider.

**Justificativa de workflows separados**: misturar validação e publish
no mesmo workflow acoplaria acidentalmente o filtro de path do publish
à validação do PR — um PR que só mexe em `apps/ui/**` deixaria de
rodar a validação, violando o requisito funcional 1 (validação cobre
todos os workspaces, sempre).

**Justificativa de `push` em vez de `pull_request` para o publish**: se
o job de publish tivesse filtro de path e rodasse em `pull_request`,
ele se tornaria um status check que **não roda** em PRs fora do path
filtrado — e o GitHub trata um required status check que nunca dispara
como "pendente para sempre", podendo travar o merge de PRs que
legitimamente não tocam `providers/`. Rodar em `push` (pós-merge)
elimina esse problema por completo: o publish nunca é um status check
de PR, só uma ação que acontece depois que o merge já foi decidido
pelos gates do requisito 1/2.

**Consequência para `/tasks`**: dois arquivos de workflow distintos,
conteúdo exato em `contracts/ci-workflow-shape.md`.

## Decisão 3 — Path filter do publish: `providers/aws/**` + `packages/contracts/**`, um workflow por provider

**Decisão**: `publish-provider-aws.yml` dispara em:
```yaml
on:
  push:
    branches: [main]
    paths:
      - "providers/aws/**"
      - "packages/contracts/**"
```
Cada provider futuro (Azure, GCP) ganha seu **próprio** arquivo de
workflow (`publish-provider-azure.yml`, etc.), cada um com seu próprio
filtro (`providers/azure/**` + `packages/contracts/**`) — não uma
matriz dinâmica calculada em runtime.

**Justificativa do path incluir `packages/contracts/**`**: clarificação
já resolvida explicitamente com o usuário em `/specify` (ver
`spec.md`, seção Clarificações) — um provider publicado com um
contrato desatualizado quebraria compatibilidade com a UI de forma
silenciosa.

**Alternativa considerada — matriz dinâmica com `dorny/paths-filter`**:
rejeitada por agora (constitution, princípio 12). Com um único provider
real, um workflow por provider já resolve o requisito de isolamento de
release (requisito funcional 4) de forma totalmente nativa do GitHub
Actions (`paths:` no gatilho), sem introduzir uma Action de terceiro
nem lógica de detecção de mudanças em runtime. Quando o Azure existir
(Estado 2 da migração, `arquitetura.md` §2), adicionar um novo arquivo
de workflow é uma operação mecânica — copiar e trocar o nome/path —,
não um redesenho; se nesse ponto o número de providers tornar a
duplicação de workflows realmente incômoda, uma matriz dinâmica pode
ser reavaliada com a necessidade já comprovada.

**Consequência para `/tasks`**: hoje, apenas
`publish-provider-aws.yml` é criado (único provider real). O padrão
para providers futuros fica documentado aqui, não implementado
antecipadamente.

## Decisão 4 — Publish via Actions oficiais do Docker, GHCR, tags `sha-<7>` + `latest`

**Decisão**: `publish-provider-aws.yml` usa `docker/login-action`
(login em `ghcr.io` com `${{ secrets.GITHUB_TOKEN }}`) e
`docker/build-push-action` (build do `providers/aws/Dockerfile` com
contexto `.` — mesmo Dockerfile e contexto já validados por
`specs/003-configurar-docker-compose/research.md`, Decisão 2) para
construir e publicar `ghcr.io/eventpier/eventpier-aws` com duas tags:
`sha-<7 primeiros chars do commit>` (rastreabilidade — requisito
funcional 6) e `latest` (conveniência, sem exigir processo de release
formal — requisito funcional 7). Plataforma única `linux/amd64` (sem
multi-arch por ora — nenhum requisito da spec pede `arm64`, e builds
multi-plataforma aumentam tempo de CI sem necessidade comprovada;
princípio 12).

**Por que usar Actions de terceiro aqui, diferente dos scripts
`validate-*.mjs` (que evitam dependência externa)**: build+push para
GHCR via GitHub Actions é um caminho extremamente padronizado, com
Actions mantidas oficialmente pela Docker/GitHub — reimplementar login
e push com `docker` CLI puro em steps manuais não reduz risco nem
dependência real (o runner já depende do próprio GitHub Actions e do
Docker Engine do runner), só reintroduz manualmente o que a Action
oficial já resolve (retry, cache de camadas, geração de tags). Os
scripts `validate-*.mjs` evitam dependência porque fazem uma checagem
específica deste projeto que nenhuma ferramenta de mercado resolve
pronta — situação diferente.

**Permissões**: o job de publish declara
`permissions: { contents: read, packages: write }` — mínimo necessário
(princípio de menor privilégio), sem usar um Personal Access Token.

**Consequência para `/tasks`**: conteúdo exato do job de publish em
`contracts/ci-workflow-shape.md`.

## Decisão 5 — Visibilidade do pacote no GHCR: ação manual única, fora do pipeline automatizado

**Decisão**: documentar em `quickstart.md` que, após a primeira
publicação, o pacote `eventpier-aws` no GHCR nasce **privado** por
padrão — independente da visibilidade do repositório — e precisa ser
marcado como público manualmente uma única vez (Settings do pacote no
GitHub), fora do pipeline de CI.

**Justificativa**: confirmado na documentação oficial do GitHub
(Packages/Container Registry, 2026): a visibilidade de um pacote é
configurada em suas próprias settings, não no momento do push, e o
default na primeira publicação é privado mesmo para repositórios
públicos. Automatizar essa mudança de visibilidade exigiria uma
credencial com escopo de administração de pacotes além do
`GITHUB_TOKEN` padrão do workflow — o que violaria diretamente o
requisito funcional 8 desta spec ("sem segredo externo não
documentado"). Por isso este passo fica deliberadamente manual e
documentado, não automatizado.

**Consequência para `/tasks`**: passo explícito em `quickstart.md`
("Fase 4"), não faz parte de nenhum arquivo de workflow.

## Decisão 6 — Node/pnpm no CI: reaproveitar exatamente as versões pinadas dos Dockerfiles

**Decisão**: `ci.yml` usa `actions/setup-node@v4` com `node-version:
"24"` (sem cache de dependências por ora — ver "Decisões descartadas
por ora"), seguido de `corepack enable && corepack prepare
pnpm@11.10.0 --activate` — mesmas versões já pinadas em
`specs/003-configurar-docker-compose/research.md`, Decisão 6
(`node:24-alpine`, `pnpm@11.10.0`). `publish-provider-aws.yml` não
precisa deste setup — o build acontece inteiramente dentro do
Dockerfile via `docker/build-push-action`, que já resolve
Node/pnpm/deps dentro da imagem multi-stage existente.

**Justificativa**: evita divergência de versão entre "o que valida no
PR" e "o que já roda dentro dos containers publicados" — mesmo
raciocínio já registrado pela spec 003 para o Dockerfile.

## Decisão 7 — `docker-compose.yml` permanece inalterado

**Decisão**: nenhuma mudança em `docker-compose.yml`. Os serviços
`eventpier-ui`/`eventpier-aws` continuam usando `build:` (contexto
local), exatamente como decidido em
`specs/003-configurar-docker-compose/spec.md` (Clarificações) — este
CI publica uma imagem para consumo *externo* ao fluxo de
desenvolvimento local, não substitui o build local do Compose.

**Justificativa**: reabrir essa decisão sem necessidade violaria o
próprio raciocínio já registrado pela spec 003 (build local existe
justamente para não depender de uma imagem publicada) e quebraria o
fluxo de desenvolvimento já validado.

## Decisão 8 — Tornar `ci.yml` obrigatório na branch protection é uma ação manual, fora do escopo desta spec

**Decisão**: o requisito funcional 2 ("merge bloqueado enquanto os
gates não passarem") depende do job `validate` de `ci.yml` estar
marcado como *required status check* nas configurações de proteção de
`main` — uma configuração do repositório no GitHub, não um arquivo
versionado. Esta spec cria o workflow; marcá-lo como obrigatório na
branch protection já existente (ver memória do projeto: `main`
protegida) é uma ação manual única, feita pelo mantenedor após o
primeiro merge desta spec (só é possível selecionar um status check
como obrigatório depois que ele rodou pelo menos uma vez).

**Justificativa**: assim como a Decisão 5 (visibilidade do pacote),
automatizar isso exigiria uma credencial com permissão de
administração do repositório além do `GITHUB_TOKEN` padrão do
workflow — violaria o requisito funcional 8. Diferente da Decisão 5,
isso não é algo que o CI "faz" em algum momento; é uma configuração
prévia de repositório, mais próxima de setup único do que de
pipeline.

**Consequência para `/tasks`**: passo manual documentado em
`quickstart.md` (Fase 3), não um arquivo produzido por nenhuma task.

## Decisões descartadas por ora

- **Cache de dependências pnpm em `ci.yml`** (`actions/cache` ou o
  parâmetro `cache: "pnpm"` de `actions/setup-node`) — considerado e
  adiado. Esta spec usa Corepack para fixar a versão do pnpm (Decisão
  6), e o parâmetro `cache` do `actions/setup-node` exige que o `pnpm`
  já esteja disponível no `PATH` **antes** da própria chamada do
  action para resolver a chave de cache — o que inverteria a ordem
  natural (setup-node primeiro, Corepack depois). Resolver isso
  corretamente exigiria um passo adicional de cache manual
  (`actions/cache` apontando para a saída de `pnpm store path`), que
  não é necessário para nenhum requisito funcional da spec — só
  acelera builds. Adiado por não ser necessidade comprovada
  (princípio 12); reavaliar se o tempo de execução de `ci.yml` se
  tornar um problema real.
- **`concurrency` guard no workflow de publish** (evitar publishes
  sobrepostos se dois merges ocorrerem em rápida sucessão) —
  considerado e adiado. Sem evidência de que dois merges simultâneos
  em `main` sejam um cenário realista neste estágio do projeto
  (mantenedor único); reavaliar se/quando o time de contribuidores
  crescer (princípio 12).
- **Build multi-arch (`linux/amd64` + `linux/arm64`)** — considerado e
  adiado; nenhum requisito da spec pede suporte a ARM, e adicionar a
  plataforma extra aproximadamente dobra o tempo de build sem
  necessidade comprovada.

## Segurança e Observabilidade (obrigações do Dev)

- **Sem segredo externo**: nenhum workflow desta spec referencia
  `secrets.*` além de `secrets.GITHUB_TOKEN` (implícito no runner,
  nunca precisa ser criado manualmente). Se qualquer task futura
  parecer exigir um PAT ou credencial de registry externa, isso viola
  o requisito funcional 8 de `spec.md` — pare e sinalize, não adicione
  um secret novo silenciosamente.
- **Least privilege**: `ci.yml` declara `permissions: { contents:
  read }` (não precisa publicar nada). `publish-provider-aws.yml`
  declara `permissions: { contents: read, packages: write }` — nunca
  `write-all` nem permissões não usadas pelo job.
- **Sem segredo em log**: `GITHUB_TOKEN` é mascarado automaticamente
  pelo Actions em qualquer log de step; nenhum step desta spec faz
  `echo`/`print` do token nem de qualquer valor de `secrets.*`.
- **Visibilidade do pacote publicado**: ver Decisão 5 — o pacote nasce
  privado; até a ação manual de `quickstart.md` (Fase 4) ser feita,
  `docker pull` da imagem publicada falha para qualquer consumidor não
  autenticado. Isso não é uma falha do pipeline, é o comportamento
  documentado do GHCR — o Dev não deve tentar "corrigir" isso
  automatizando a mudança de visibilidade (exigiria escopo de
  credencial além do permitido pelo requisito 8).

## Decisões durante a implementação

- **Nenhum desvio do contrato**: `scripts/validate-ci-workflow-shape.mjs`
  (T002) ficou RED como esperado antes dos workflows existirem (T003)
  e GREEN na primeira tentativa após criar `ci.yml`/`publish-provider-aws.yml`
  (T004-T006) exatamente como descrito em `contracts/ci-workflow-shape.md`
  — nenhuma correção de forma foi necessária.
- **`docker compose build` (T001 e T007) reaproveitou cache do BuildKit
  de sessões anteriores (specs 002/003)**, terminando em segundos —
  isso não representa o tempo real de `docker compose build` dentro de
  `ci.yml` em um runner do GitHub Actions, que sempre parte de cache
  frio (nenhum registry de cache remoto foi configurado nesta spec;
  ver "Decisões descartadas por ora" — cache não foi tratado como
  necessidade comprovada). Sinal para quem for monitorar a duração de
  `ci.yml`: o primeiro run real será mais lento que qualquer medição
  local feita durante esta implementação.
- **Execução real no GitHub (Fases 3-4 de `quickstart.md`) e a
  configuração manual de branch protection/visibilidade do pacote
  (Decisões 5 e 8) não foram e não podiam ser executadas nesta
  sessão** — dependem do merge desta spec em `main` e de acesso às
  configurações do repositório no GitHub. Ver T008 em `tasks.md` para
  o registro formal desse follow-up.
- **Correções aplicadas após o review da PR #6** (não previstas no
  plano original, incorporadas na mesma PR antes do merge):
  `docker/login-action` e `docker/build-push-action` passaram de tag
  major (`@v3`/`@v6`) para SHA de commit completo — `c94ce9fb...`
  (v3.7.0) e `10e90e36...` (v6.19.2), resolvidos via
  `gh api repos/docker/<action>/git/refs/tags/<v>` no momento da
  correção; `ci.yml` ganhou `concurrency` para cancelar runs
  supersedidos; `scripts/validate-ci-workflow-shape.mjs` passou a
  exigir ambos (`checkPinnedBySha`, checagem de `concurrency:`) para
  não regredir. A terceira ressalva do review (política de "Package
  creation" da organização não verificável via API pública) virou um
  passo novo em `quickstart.md`, Fase 3 (passo "0.5") — não é
  corrigível em código, só verificável manualmente antes do primeiro
  publish real.
