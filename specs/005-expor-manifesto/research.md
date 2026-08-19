# Research — Endpoint de Manifesto (005)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípios 1, 4, 5, 6,
  8, 10, 11 e 13.
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seções 2 (árvore de
  arquivos do Estado 1), 3 (Contrato Mínimo), 6 (padrões de acesso,
  sem bundler), 7 (autenticação) e 8 (arquitetura de containers).
- `spec.md` desta feature, incluindo as duas Clarificações resolvidas
  na sessão de `/specify` (capabilities vazio, environment fixo).
- `specs/002-definir-contrato-compartilhado/research.md` (Decisões 1,
  3, 5, 7) — esta spec é a primeira a de fato consumir
  `@eventpier/contracts` como dependência real de workspace, algo que
  aquela spec previu e deixou pronto (extensão `.js` em imports
  relativos, `main`/`types`/`exports` apontando para `dist/`) mas
  explicitamente não implementou.
- `specs/002-definir-contrato-compartilhado/plan.md` — sinalizava
  explicitamente para esta spec: "mensagens de erro do provider não
  devem incluir credenciais, endpoints internos sensíveis ou stack
  traces brutos" quando `ProviderError` passasse a ser produzido de
  verdade. Esta é a primeira spec a produzir `ProviderError` de
  verdade — ver Decisão 7 e a seção de Segurança em `plan.md`.
- `providers/aws/src/index.ts`, `providers/aws/package.json`,
  `providers/aws/Dockerfile`, `docker-compose.yml` (estado atual,
  spec 003) — o placeholder HTTP mínimo que esta spec substitui.

Nenhum conflito entre spec e regras/arquitetura foi encontrado. Um
ponto que a spec resolve, mas que `arquitetura.md` não detalhava:
como `providers/aws` (sem bundler, sem framework HTTP ainda) importa
`@eventpier/contracts` em runtime dentro da imagem Docker — resolvido
na Decisão 6 abaixo.

## Decisão 1 — Sem framework HTTP novo; `node:http` puro com dispatch manual

**Decisão**: manter `node:http` (já usado no placeholder da spec 003),
sem introduzir Express/Fastify/etc. O dispatch por método+path é um
`if`/`else` direto dentro do handler do servidor — não um router
genérico.

**Alternativas consideradas**:
- *Introduzir Fastify/Express agora* — rejeitado. Hoje existe uma
  única rota (`GET /api/v1/manifest`); um router genérico ganharia
  valor real só a partir da spec 008 (Storage, múltiplas rotas com
  parâmetros de path). Adicionar a dependência agora seria
  complexidade sem caso de uso que a justifique ainda — mesmo
  raciocínio de minimalismo já aplicado pela spec 002 (Decisão 1,
  rejeição de `zod`) e pela nota de `quality-gates.md` sobre adiar um
  test runner real.
- *Um router manual próprio (`src/http/router.ts`) já nesta spec* —
  rejeitado por não ter mais que uma rota para justificar a
  abstração; reavaliar quando a spec 008 adicionar rotas de Storage.

**Consequência para `/tasks`**: nenhuma dependência nova em
`providers/aws/package.json` além de `@eventpier/contracts` (Decisão
2). Reabrir esta decisão explicitamente na spec 008 se o número de
rotas tornar o dispatch manual difícil de ler.

## Decisão 2 — `providers/aws` ganha dependência real de `@eventpier/contracts`

**Decisão**: `providers/aws/package.json` ganha
`"dependencies": { "@eventpier/contracts": "workspace:*" }`. O
provider importa `CONTRACT_VERSION` e os tipos (`ProviderManifest`,
`ProviderError`) do pacote — nunca duplica o valor de
`contractVersion` como literal dentro de `providers/aws`.

**Justificativa**: `specs/002.../research.md` (Decisão 5, "Consequência
para `/tasks`") já previa exatamente este momento: "a dependência de
workspace só é adicionada quando essas specs (005, 009) de fato
importarem algo do pacote". Constitution princípio 13 exige que o
contrato seja a fonte única — duplicar `contractVersion` como string
literal em `providers/aws` criaria duas fontes de verdade que podem
divergir silenciosamente.

**Consequência para `/tasks`**: build do provider passa a depender do
build de `@eventpier/contracts` já ter rodado antes (mesma ordem que
`quality-gates.md` já usa na linha **Build**:
`pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build`).
Nenhuma mudança nessa linha é necessária — a ordem já está correta.

## Decisão 3 — `version` do manifesto lido de `package.json` em runtime, nunca hardcoded

**Decisão**: `manifest.service.ts` lê o campo `version` do próprio
`providers/aws/package.json` via `node:fs` (`readFileSync` +
`JSON.parse`), resolvendo o caminho a partir de `import.meta.url`
(mesmo padrão já usado em `scripts/validate-contract-constants.mjs`).

**Alternativas consideradas**:
- *Hardcode de um literal (ex.: `"0.2.0"`) dentro do código* —
  rejeitado: cria uma segunda fonte de verdade que diverge do
  `package.json` na primeira vez que alguém dar um bump de versão sem
  lembrar de atualizar os dois lugares.
- *Import de JSON com atributo (`import pkg from "../../package.json" with { type: "json" }`)*
  — rejeitado. Embora `resolveJsonModule` já esteja habilitado em
  `tsconfig.base.json`, isso resolve apenas checagem de tipo; em
  runtime real do Node ESM (sem bundler — `arquitetura.md` §6) essa
  sintaxe exige o atributo de import estável apenas em versões
  recentes do Node, é mais uma fonte de fricção TS/Node do que uma
  simplificação real para ler um único campo. `readFileSync` +
  `JSON.parse` é simples, previsível e usa exatamente o padrão que o
  projeto já validou nos scripts de `scripts/`.

**Consequência para `/tasks`**: o caminho relativo do
`package.json` a partir de `providers/aws/src/manifest/manifest.service.ts`
é `../../package.json` — e esse mesmo caminho relativo deve
permanecer válido no `dist/` compilado (`dist/manifest/manifest.service.js`
→ `../../package.json`) e na imagem Docker final (Decisão 6 garante
que `package.json` continua na raiz de `/app`, no mesmo nível
relativo).

## Decisão 4 — `capabilities: []` fixo nesta spec

**Decisão**: já resolvida como Clarificação em `spec.md` durante
`/specify` — `buildManifest()` sempre retorna `capabilities: []`
nesta spec. Nenhuma lógica condicional, nenhum array com item
`storage` e status placeholder.

**Justificativa**: registrada em `spec.md` (requisito funcional 4);
reafirmada aqui porque é a decisão que evita `manifest.service.ts`
importar/depender de qualquer coisa relacionada a health-check (spec
006) ou Storage (spec 008) — nenhum acoplamento prematuro a specs
futuras.

## Decisão 5 — `environment` fixo nesta spec (`{ id: "ministack", managed: true }`, sem `endpoint`)

**Decisão**: já resolvida como Clarificação em `spec.md` — valores
fixos, sem ler `MINISTACK_ENDPOINT`/`MINISTACK_MANAGED` do ambiente,
mesmo essas variáveis já existindo em `docker-compose.yml` desde a
spec 003. `manifest.service.ts` não lê `process.env` nesta spec.

**Justificativa**: as variáveis de ambiente já presentes no Compose
foram introduzidas antecipando a spec 007 (`EnvironmentConfig`), mas
lê-las agora sem o desenho completo de `EnvironmentConfig` anteciparia
escopo de outra spec de forma parcial (ex.: o que fazer se
`MINISTACK_MANAGED` vier como string `"false"` vs. boolean —
questão de parsing que pertence à spec 007). Manter fixo nesta spec
evita meio-caminho.

**Consequência para `/tasks`**: nenhuma task desta spec deve ler
`process.env.MINISTACK_ENDPOINT` ou `process.env.MINISTACK_MANAGED`
dentro de `providers/aws/src`.

## Decisão 6 — Docker runtime: copiar `packages/contracts/dist` manualmente para dentro de `node_modules/@eventpier/contracts`, sem `pnpm deploy`

**Decisão**: o estágio `build` do `Dockerfile` passa a copiar e
buildar também `packages/contracts` (hoje só copiava seu
`package.json`, na etapa `deps`, para resolução de workspace — nunca
seu código-fonte nem buildava). O estágio `runtime` copia
`providers/aws/dist` + `providers/aws/package.json` (já existia) e
adiciona `packages/contracts/dist` + `packages/contracts/package.json`
para dentro de `./node_modules/@eventpier/contracts/`, recriando
manualmente a resolução que o Node ESM precisa para o especificador
`"@eventpier/contracts"` (via `exports` do `package.json` do pacote).

**Alternativas consideradas**:
- *`pnpm deploy`* (comando dedicado do pnpm para isolar um workspace
  com suas dependências reais, sem symlinks, próprio para Docker
  multi-stage) — considerado, mas rejeitado por ora: `@eventpier/contracts`
  não tem nenhuma dependência própria de terceiros hoje (só tipos e
  constantes TypeScript puras), então o problema que `pnpm deploy`
  resolve (materializar uma árvore de `node_modules` transitiva
  complexa) não existe ainda neste projeto — copiar manualmente os
  dois arquivos necessários é mais simples e 100% determinístico, sem
  depender do comportamento de seleção de arquivos do `pnpm deploy`
  (que segue heurísticas de empacotamento tipo `npm pack`/campo
  `files`, não testadas ainda neste repositório).
- *Copiar todo o `node_modules` do estágio de build para o runtime* —
  rejeitado: infla a imagem com `devDependencies` do monorepo inteiro
  (`typescript`, `@types/node` na raiz) que não são necessárias em
  runtime.

**Sinal para specs futuras**: a spec 008 (Storage) introduz uma
dependência real de terceiro (AWS SDK) em `providers/aws`. Nesse
ponto, reavaliar `pnpm deploy` (ou `pnpm install --prod` num estágio
dedicado) — copiar manualmente deixa de escalar quando o número de
pacotes de terceiros no runtime crescer além de zero.

**Consequência para `/tasks`**: `Dockerfile` completo em
`contracts/manifest-endpoint-shape.md`. Gate **Docker**
(`docker compose build`) continua sendo a validação real — nenhum
script de shape estático novo para o Dockerfile, mesmo padrão já
usado desde a spec 003 (build real > checagem estática de Dockerfile).

## Decisão 7 — Erros HTTP como `ProviderError` já definido; sem schema de validação de entrada

**Decisão**: método não permitido → HTTP 405 com corpo
`ProviderError` (`code: "METHOD_NOT_ALLOWED"`); path desconhecido →
HTTP 404 com corpo `ProviderError` (`code: "NOT_FOUND"`). Ambos com
`retryable: false` e `message` estática, nunca interpolando dados do
próprio request além do `method`/`path` recebidos (nunca stack trace,
nunca variável de ambiente, nunca detalhe interno — ver nota de
segurança deixada por `specs/002.../plan.md`). Sem `zod` ou qualquer
validador de schema.

**Justificativa**: o endpoint não aceita nenhuma entrada (sem query
params, sem corpo, sem parâmetros de path) — não há o que validar
além de método e path, que um `if`/`else` simples já resolve. Mesmo
princípio da Decisão 1 de `specs/002.../research.md`: sem boundary que
justifique uma biblioteca de validação ainda. Reavaliar quando a spec
008 (Storage) introduzir entrada real (nome de bucket, cursor de
paginação) vinda de fora.

**Consequência para `/tasks`**: `code`s `"METHOD_NOT_ALLOWED"` e
`"NOT_FOUND"` ficam registrados aqui e em `data-model.md` como os
dois únicos códigos de erro produzidos por esta spec — qualquer novo
código de erro em specs futuras deve ser documentado do mesmo jeito,
nunca inventado ad-hoc sem registro.

## Decisão 8 — Testes: novo script Node puro, sobe o servidor real e faz requisições HTTP reais

**Decisão**: `scripts/validate-manifest-endpoint.mjs`, mesmo padrão
dos scripts existentes (sem test runner novo — `jest`/`vitest` continua
adiado para a spec 006, conforme `specs/002.../research.md`, Decisão
7). O script: (1) confirma que `providers/aws/dist/index.js` e
`packages/contracts/dist/index.js` existem (senão falha com instrução
de rodar o build antes — não builda implicitamente); (2) importa o
`dist` de `@eventpier/contracts` para comparar `CONTRACT_VERSION` por
valor real, não hardcoded no próprio script de teste; (3) sobe o
provider com `node:child_process.spawn`, espera a linha de log de
"ouvindo na porta"; (4) faz `GET /api/v1/manifest` (espera 200 +
forma exata do manifesto), `POST /api/v1/manifest` (espera 405 +
`ProviderError`) e `GET` a um path desconhecido (espera 404 +
`ProviderError`); (5) encerra o processo filho no `finally`,
independente de sucesso ou falha das asserções.

**Justificativa**: os requisitos funcionais 5-7 e os critérios de
sucesso de `spec.md` são sobre comportamento HTTP observável (código
de status, corpo, roteamento) — só verificável fazendo requisições
reais a um servidor real, não checando a forma de um objeto em
memória isoladamente (isso cobre parte, mas não o roteamento).

**Consequência para `/tasks`**: `quality-gates.md`, linha **Testes**,
ganha mais um script encadeado ao final da linha existente:
`... && node scripts/validate-manifest-endpoint.mjs`. Depende dos
gates **Build** (ambos os `dist/` precisam existir) já terem rodado
antes — mesma ordem já documentada na linha **Testes** de
`quality-gates.md`.

## Decisão 9 — Sem CORS

**Decisão**: nenhum header CORS é adicionado nesta spec.

**Justificativa**: `eventpier-aws` não publica porta ao host
(constitution princípio 11, `arquitetura.md` §8) — só é alcançável
dentro da rede interna do Compose, nunca diretamente por um browser.
Quando a spec 009 (UI) consumir este endpoint, será a partir do lado
servidor do Next.js (mesma rede Docker), não de código rodando no
browser do usuário final — não há requisição cross-origin de browser
para adicionar CORS.

## Decisões durante a implementação

- **`wget` do BusyBox não suporta `--method=POST`** (usado em
  `quickstart.md` passo 8 para testar o cenário 405 pela rede
  interna). A imagem `eventpier-ui` (`node:24-alpine`) traz o `wget`
  do BusyBox, não o GNU wget — a flag correta para forçar `POST` é
  `--post-data=""` (corpo vazio). Corrigido diretamente em
  `quickstart.md`; nenhum impacto no código de `providers/aws` (o
  endpoint em si nunca dependeu de `wget`, só o passo de validação
  manual via container). Todo o restante do plano (código de
  `manifest.service.ts`, `index.ts`, `Dockerfile`, script de
  validação) funcionou exatamente como especificado em
  `contracts/manifest-endpoint-shape.md`, sem outros desvios.
- **Gate Typecheck precisou passar a rodar depois do Build** (achado
  do `/review-pr` da PR #12, não previsto em `plan.md`/`research.md`
  originais): `providers/aws` agora importa `@eventpier/contracts` de
  verdade (Decisão 2), e `pnpm -r exec tsc --noEmit` (gate Typecheck)
  passou a exigir que `packages/contracts/dist/index.d.ts` já
  existisse para resolver o módulo. A ordem antiga (Typecheck → Build
  → Docker → Testes) nunca tinha esse problema porque nenhum workspace
  importava outro por tipos publicados antes desta spec. Localmente
  isso passou despercebido (eu já tinha buildado `packages/contracts`
  em passos anteriores da mesma sessão) — só o CI real (checkout
  limpo, PR #12, run 32249870616) expôs o erro
  (`TS2307: Cannot find module '@eventpier/contracts'`). Corrigido
  invertendo a ordem para **Build → Typecheck → Docker → Testes** em
  `.pipeline/quality-gates.md` e `.github/workflows/ci.yml`.
  Aproveitado para também adicionar `validate-manifest-endpoint.mjs`
  ao step "Testes" de `ci.yml` — T012 só previa atualizar
  `quality-gates.md`, deixando `ci.yml` (que é hardcoded, não lê
  `quality-gates.md` dinamicamente) sem o novo script. Confirmado
  localmente com `dist/` apagado de propósito (simulando checkout
  limpo) antes de reexecutar Build → Typecheck → Docker → Testes na
  nova ordem — todos verdes.
