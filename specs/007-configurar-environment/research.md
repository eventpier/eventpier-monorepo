# Research — EnvironmentConfig (`endpoint` / `managed`) (007)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípios 2, 8, 9, 12 e
  13.
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seções 2 (árvore de
  arquivos — `providers/aws/src/config/environment.config.ts` já
  previsto ali), 3 (Contrato Mínimo — `Environment`), 5 (Configuração
  de Environment — `EnvironmentConfig`, regras de `managed`) e 8
  (Docker Compose — `MINISTACK_ENDPOINT`/`MINISTACK_MANAGED` já
  existem como variáveis de ambiente do serviço `eventpier-aws`).
- `spec.md` desta feature, incluindo as duas Clarificações resolvidas
  na sessão de `/specify` (fail-fast em configuração inválida/
  incompleta; `environment.endpoint` sempre exposto, mesmo no
  default).
- `packages/contracts/src/manifest.ts` — `Environment` (`id`,
  `endpoint?`, `managed`) já existe como tipo exportado; esta spec
  reutiliza, nunca redefine nem altera o contrato.
- `providers/aws/src/manifest/manifest.service.ts` (spec 005) —
  `buildManifest()` hoje constrói `environment` fixo no código
  (`{ id: "ministack", managed: true }`, sem `endpoint`); é exatamente
  isso que esta spec substitui.
- `providers/aws/src/manifest/health-cache.ts` e
  `health-cache.test.ts` (spec 006) — precedente direto de estilo:
  função pura de resolução de configuração (`resolveTtlMs`), lida
  diretamente de `process.env`, testada mutando `process.env` com
  cleanup em `afterEach`.
- `docker-compose.yml` e `.env.example` (spec 003) — `MINISTACK_ENDPOINT`
  (default `http://ministack:4566`) e `MINISTACK_MANAGED` (default
  `true`) já existem como variáveis passadas ao container
  `eventpier-aws`, mas ainda não são lidas por nenhum código do
  provider.
- `scripts/validate-manifest-endpoint.mjs` (spec 005) — spawna o
  processo real do provider sem variáveis de ambiente customizadas e
  valida o shape do manifesto; hoje não verifica `environment.endpoint`
  (o campo nem existia no manifesto retornado).
- `.pipeline/quality-gates.md` e `.github/workflows/ci.yml` — lista de
  scripts de "Testes de integração"; `validate-ci-workflow-shape.mjs`
  verifica apenas um subconjunto de steps obrigatórios por substring
  (não é uma lista exaustiva), então adicionar um novo script ao
  `ci.yml` não quebra esse validador.

Nenhum conflito entre spec e regras/arquitetura encontrado. `Environment`
já é o contrato externo correto para o retorno desta feature — nenhuma
mudança em `packages/contracts` é necessária.

## Decisão 1 — Módulo dedicado `providers/aws/src/config/environment.config.ts`

**Decisão**: nova função pura `resolveEnvironmentConfig(): Environment`,
em arquivo próprio no caminho já previsto pela árvore de arquivos do
Estado 1 (`docs/arquitetura.md` §2).

**Alternativas consideradas**:
- *Inline em `index.ts`* — rejeitado: misturaria leitura de variável de
  ambiente, validação com fail-fast e bootstrap HTTP no mesmo arquivo,
  dificultando testar a resolução de configuração isoladamente sem
  subir um servidor.
- *Dentro de `manifest.service.ts`* — rejeitado: `manifest.service.ts`
  tem responsabilidade própria (montar o payload do contrato a partir
  de dados já resolvidos); acoplar ali a leitura de `process.env`
  tornaria o service dependente de uma fonte de configuração
  específica, dificultando reuso por outro ponto de entrada futuro
  (ex.: um CLI de diagnóstico que só precisa saber o `EnvironmentConfig`
  ativo, sem montar o manifesto inteiro).

**Consequência para `/tasks`**: mesmo padrão estrutural de
`health-cache.ts` (spec 006) — módulo de configuração isolado,
testável sem servidor HTTP, sem estado de módulo compartilhado.

## Decisão 2 — Validação em fail-fast na inicialização do processo, não por requisição

**Decisão**: `resolveEnvironmentConfig()` é chamada uma única vez em
`index.ts`, antes de `server.listen(...)`. Se lançar, o processo loga
uma mensagem de erro clara em `stderr` e encerra com
`process.exit(1)` — o servidor HTTP nunca chega a escutar a porta.
`buildManifest()` deixa de ler `process.env` e passa a receber o
`Environment` já resolvido como parâmetro.

**Alternativas consideradas**:
- *Validar a cada requisição, dentro do handler de
  `GET /api/v1/manifest`* — rejeitado: contradiz o Requisito Funcional
  7 de `spec.md` (o endpoint deve sempre responder 200 uma vez que o
  processo está de pé) e criaria a possibilidade de o processo subir
  "quebrado", só revelando o problema na primeira requisição — pior
  experiência de debug do que falhar imediatamente no boot, com a
  causa nos logs do container antes mesmo de alguém tentar acessá-lo.

**Consequência para `/tasks`**: `buildManifest(environment: Environment)`
muda de assinatura (antes `buildManifest()`); `index.ts` é o único
chamador de ambas as funções, e é onde a captura de erro de
inicialização vive.

## Decisão 3 — Erro de configuração como classe dedicada

**Decisão**: `export class InvalidEnvironmentConfigError extends Error {}`,
lançada por `resolveEnvironmentConfig()` e capturada explicitamente em
`index.ts` (`instanceof InvalidEnvironmentConfigError`) antes de
`process.exit(1)`.

**Alternativas consideradas**:
- *Lançar `Error` genérico e deixar a exceção não tratada derrubar o
  processo* — rejeitado: Node imprime uma stack trace técnica
  completa em vez de uma mensagem de causa direta; os Requisitos
  Funcionais 5 e 6 de `spec.md` pedem explicitamente uma mensagem de
  erro que "deixe claro" o motivo — capturar a exceção permite
  controlar exatamente o texto impresso, sem ruído de stack trace para
  quem só precisa saber o que configurou errado.

**Consequência para `/tasks`**: `index.ts` ganha um bloco
try/catch estreito em torno da chamada de
`resolveEnvironmentConfig()`, distinto de qualquer outro tratamento de
erro do servidor HTTP (que continua tratando erros de requisição via
`ProviderError`, sem relação com este).

## Decisão 4 — `MINISTACK_MANAGED`: só `"true"`/`"false"` são valores válidos; qualquer outro lança erro

**Decisão**: `parseManaged(raw)` aceita `"true"`/`"false"`
(case-insensitive, com trim); ausente ou string vazia cai no default
`true`; qualquer outro valor lança `InvalidEnvironmentConfigError`.

**Contraste deliberado com o precedente de `HEALTH_CHECK_TTL_MS`**
(`specs/006-cachear-health-check/research.md`, Decisão 3): lá, um
valor inválido cai silenciosamente no default, justificado por ser
"tuning" de baixo risco (TTL de cache). Aqui a Clarificação resolvida
com o usuário nesta sessão de `/specify` optou deliberadamente por
fail-fast, porque `managed`/`endpoint` determinam a identidade do
ambiente que toda capability futura (spec 008+) vai de fato acessar
via AWS SDK — um valor malformado assumido silenciosamente como
default poderia mascarar uma intenção real do desenvolvedor (ex.:
`managed=false` digitado errado como `"flase"`, o provider volta a
apontar silenciosamente para o MiniStack gerenciado, que pode nem
estar em execução) e a spec 008 acabaria conectando no ambiente errado
sem nenhum aviso. O risco de um TTL de cache errado é "checagem um
pouco mais lenta/rápida"; o risco de um `managed`/`endpoint` errado é
"o provider opera contra o ambiente errado" — proporcionalidade
diferente justifica tratamento diferente do mesmo padrão sintático
(variável de ambiente booleana).

**Alternativas consideradas**:
- *Aceitar qualquer valor truthy/falsy (ex.: `"1"`/`"0"`,
  `"yes"`/`"no"`)* — rejeitado: aumenta a superfície de valores
  "quase certos" que poderiam mascarar um erro de digitação sem
  nenhum ganho de ergonomia real (o valor é sempre escrito por quem
  configura o `.env`/Compose deste projeto, nunca por um sistema
  externo com convenção própria).

**Consequência para `/tasks`**: `environment.config.test.ts` cobre
`"true"`/`"TRUE"`/`"True"`, ausente, `"false"`, e um valor inválido
(ex.: `"flase"`) lançando a exceção.

## Decisão 5 — Endpoint default explícito no código, igual ao default do Compose

**Decisão**: `DEFAULT_ENDPOINT = "http://ministack:4566"`, usado
quando `MINISTACK_ENDPOINT` está ausente ou vazio. Reflete a
Clarificação de `spec.md` (Requisito Funcional 3): o manifesto sempre
expõe `environment.endpoint`, mesmo quando é o default.

**Justificativa do valor**: `docker-compose.yml` (spec 003) já usa
`MINISTACK_ENDPOINT=${MINISTACK_ENDPOINT:-http://ministack:4566}` como
fallback no serviço `eventpier-aws` — reaproveitar o mesmo literal
evita um segundo valor "mágico" divergente entre o Compose e o código
do provider (mesmo raciocínio do TTL default em
`specs/006-cachear-health-check/research.md`, Decisão 3).

**Alternativas consideradas**:
- *Deixar `environment.endpoint` `undefined` quando não customizado,
  seguindo literalmente o comentário do tipo `EnvironmentConfig` em
  `docs/arquitetura.md` §5 ("se ausente, usa o endpoint do serviço
  gerenciado pelo compose")* — rejeitado explicitamente pela
  Clarificação de `spec.md`: esconderia do consumidor do manifesto
  justamente a informação mais útil para uma ferramenta de inspeção
  (contra qual endpoint o provider está de fato operando).

**Consequência para `/tasks`**: quando rodando fora do Compose (ex.:
`validate-manifest-endpoint.mjs`, que spawna
`providers/aws/dist/index.js` diretamente, sem variáveis de ambiente
customizadas), o manifesto retorna
`environment: { id: "ministack", endpoint: "http://ministack:4566",
managed: true }` — script atualizado para verificar isso (Decisão 8).

## Decisão 6 — Leitura direta de `process.env`, sem parâmetro de injeção

**Decisão**: `resolveEnvironmentConfig()` lê
`process.env.MINISTACK_ENDPOINT`/`process.env.MINISTACK_MANAGED`
diretamente a cada chamada, sem aceitar um objeto `env` injetável por
parâmetro.

**Alternativas consideradas**:
- *Aceitar `env: NodeJS.ProcessEnv` como parâmetro opcional (default
  `process.env`), para facilitar teste sem mutar estado global* —
  rejeitado por consistência com o precedente já estabelecido
  (`resolveTtlMs` em `health-cache.ts`, spec 006, lê `process.env`
  diretamente; `health-cache.test.ts` muta `process.env.
  HEALTH_CHECK_TTL_MS` com cleanup em `afterEach`) e pelo princípio 12
  da constitution (abstração só após necessidade comprovada) — não há
  hoje nenhum consumidor além dos próprios testes que se beneficiaria
  de injeção, e introduzir os dois padrões (um módulo com parâmetro
  injetável, outro sem) no mesmo workspace criaria inconsistência sem
  ganho.

**Consequência para `/tasks`**: `environment.config.test.ts` segue
exatamente o padrão de `health-cache.test.ts` — salva o valor original
de cada variável antes dos testes, restaura em `afterEach`.

## Decisão 7 — `manifest.service.ts`: `buildManifest` recebe `environment` como parâmetro

**Decisão**: assinatura muda de `buildManifest()` para
`buildManifest(environment: Environment): ProviderManifest` — função
pura, sem leitura própria de `process.env` ou de qualquer módulo de
configuração.

**Justificativa**: mantém `manifest.service.ts` como montagem pura do
payload do contrato a partir de dados já resolvidos por quem chama —
mesma responsabilidade que já tinha antes desta spec, agora explícita
via parâmetro em vez de valor fixo no código. Não é um contrato
externo (não está em `packages/contracts`), então mudar a assinatura é
uma alteração interna segura, sem ciclo de depreciação — o único
chamador (`index.ts`) é atualizado na mesma spec.

**Consequência para `/tasks`**: `index.ts` chama
`resolveEnvironmentConfig()` uma única vez no bootstrap (Decisão 2) e
repassa o resultado a cada chamada de `buildManifest(environment)`
dentro do handler HTTP — o valor resolvido não muda durante o tempo de
vida do processo (reflete o próprio significado de `EnvironmentConfig`:
uma declaração estática de "para onde apontar", não algo que se
reavalia a cada requisição).

## Decisão 8 — Testes de integração do fail-fast via novo script `scripts/validate-environment-config.mjs`

**Decisão**: novo script, mesmo padrão de
`scripts/validate-manifest-endpoint.mjs` (spawna
`providers/aws/dist/index.js` de verdade, com variáveis de ambiente
customizadas por cenário), cobrindo os três cenários que dependem do
bootstrap real do processo:
1. `MINISTACK_ENDPOINT`/`MINISTACK_MANAGED=false` customizados válidos
   → processo sobe, `GET /api/v1/manifest` reflete exatamente os
   valores configurados.
2. `MINISTACK_MANAGED=false` sem `MINISTACK_ENDPOINT` → processo
   encerra com código de saída diferente de zero, nunca loga "ouvindo
   na porta".
3. `MINISTACK_MANAGED` com valor não reconhecível (ex.: `"talvez"`) →
   mesmo comportamento do cenário 2.

`scripts/validate-manifest-endpoint.mjs` ganha apenas a asserção do
endpoint default (Decisão 5), já que continua exercitando exatamente o
cenário "sem nenhuma variável de ambiente customizada".

**Alternativas consideradas**:
- *Cobrir o fail-fast só com teste unitário de
  `resolveEnvironmentConfig()` (que já prova que a função lança a
  exceção)* — rejeitado como insuficiente sozinho: não prova que
  `index.ts` de fato captura a exceção e encerra com
  `process.exit(1)` **antes** de chamar `server.listen` — esse fio de
  integração entre o módulo de configuração e o bootstrap HTTP só é
  verificável subindo o processo real, mesmo padrão que já justificou
  a existência de `validate-manifest-endpoint.mjs` na spec 005.

**Consequência para `/tasks`**: `.pipeline/quality-gates.md` e
`.github/workflows/ci.yml` ganham
`node scripts/validate-environment-config.mjs` na linha/step "Testes
de integração", junto dos scripts já existentes. Confirmado que
`scripts/validate-ci-workflow-shape.mjs` não precisa de nenhuma
mudança — seu `expectedSteps` é uma lista de substrings obrigatórios
(não exaustiva), então adicionar um step novo ao `ci.yml` não quebra
essa validação.

## Decisões durante a implementação

- Nenhum desvio do plano original. `environment.config.ts`,
  `environment.config.test.ts`, `manifest.service.ts`, `index.ts`,
  `validate-manifest-endpoint.mjs` e `validate-environment-config.mjs`
  foram implementados exatamente como especificado em
  `contracts/environment-config-shape.md` — RED confirmado em T001
  antes de `environment.config.ts` existir, GREEN em T003 (20/20
  testes, 12 pré-existentes de `health-cache.test.ts` + 8 novos),
  build/typecheck limpos em T006, os dois scripts de validação `OK`
  em T009 na primeira execução, e `docker compose --profile
  managed-env up` (T010) subindo `eventpier-aws` normalmente com os
  defaults do Compose. Única nota operacional (não de design): derrubar
  o Compose desta spec exige `docker compose --profile managed-env
  down` — sem o profile, `ministack` (que só existe sob esse profile)
  fica de pé e o `down` reporta a rede ainda em uso; comportamento do
  próprio Compose, não algo introduzido por esta spec.
- **Achado e corrigido no `/review-pr` desta PR**: `MINISTACK_ENDPOINT`
  não passava por `trim()` antes de ser usado, diferente de
  `MINISTACK_MANAGED` (Decisão 4, já normalizado) — um espaço em
  branco incidental no valor (ex.: erro de digitação num `.env`)
  produzia um endpoint tecnicamente diferente do pretendido em vez de
  cair no default ou falhar explicitamente. A Decisão 5 original só
  cobria o default quando o valor estava ausente/vazio, sem considerar
  um valor presente mas "sujo". Corrigido com
  `process.env.MINISTACK_ENDPOINT?.trim()` em
  `environment.config.ts`; coberto por dois testes de regressão
  (endpoint com espaço ao redor preservando o valor limpo; endpoint só
  com espaços tratado como ausente, caindo no default) —
  `environment.config.test.ts` passa de 8 para 10 casos. 22/22 testes
  no total, build/typecheck e os dois scripts de integração
  reconfirmados `OK` após a correção.
- **Achado externo (bot Codex, comentário na PR #14), ALTO —
  `docker-compose.yml` mascarava `managed:false` sem endpoint como se
  tivesse um configurado**: `docker-compose.yml` (spec 003) definia
  `MINISTACK_ENDPOINT=${MINISTACK_ENDPOINT:-http://ministack:4566}` —
  quando o usuário não define `MINISTACK_ENDPOINT` no host, o Compose
  resolve essa expressão **antes** de passar a variável ao container,
  então `process.env.MINISTACK_ENDPOINT` dentro de
  `environment.config.ts` nunca chega a ver "ausente": vê sempre a
  string `"http://ministack:4566"`, indistinguível de um endpoint real
  customizado. Resultado: `MINISTACK_MANAGED=false` sozinho (sem
  `MINISTACK_ENDPOINT`), rodando via `docker compose up`, nunca
  disparava o fail-fast do Requisito Funcional 5 — o provider subia
  normalmente, reportando `managed:false` apontando para
  `http://ministack:4566` (o endereço do serviço **gerenciado**, que
  pode nem estar em execução se o profile `managed-env` não estiver
  ativo). Reproduzido e confirmado antes da correção: `docker compose
  config` com `MINISTACK_MANAGED=false` e sem `MINISTACK_ENDPOINT`
  resolvia `environment.MINISTACK_ENDPOINT` para o literal
  `"http://ministack:4566"`; rodando o processo com exatamente esse
  par de variáveis, o manifesto respondia
  `{endpoint:"http://ministack:4566", managed:false}` sem erro nenhum
  — o cenário exato que o Requisito Funcional 5 e a Decisão 4 desta
  spec pretendiam impedir, só que mediado pelo Compose em vez de
  diretamente pelo processo Node.

  **Correção aplicada**: `docker-compose.yml` muda para
  `MINISTACK_ENDPOINT=${MINISTACK_ENDPOINT:-}` — sem valor quando o
  host não define a variável, delegando o default inteiramente ao
  código do provider (fonte única da verdade para "qual é o default",
  em vez de dois defaults divergentes podendo mascarar um ao outro).
  `MINISTACK_MANAGED`/`HEALTH_CHECK_TTL_MS` mantidos como estavam — o
  mesmo problema não se aplica a eles (o código já trata "ausente" e
  o valor default do Compose de forma idêntica em ambos os casos, sem
  nenhum branch de fail-fast dependendo de detectar "ausente"
  especificamente). Regressão coberta por uma nova checagem em
  `scripts/validate-compose-shape.mjs`
  (`checkEndpointNotDefaultedByCompose`), que roda `docker compose
  config` com `MINISTACK_ENDPOINT` vazia e falha se o valor resolvido
  não ficar vazio — confirmado RED (reproduzindo o texto original)
  antes da correção, GREEN depois. Cenário fim a fim reconfirmado com
  o Docker real: `docker compose --profile managed-env up` (default)
  continua reportando `endpoint: "http://ministack:4566"` corretamente
  (agora vindo do código, não do Compose); `MINISTACK_MANAGED=false
  docker compose up eventpier-aws` (sem endpoint) agora encerra com
  exit code 1 e a mensagem de erro esperada, em vez de subir
  silenciosamente.
