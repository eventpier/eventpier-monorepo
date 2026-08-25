# Research — Capability Storage (008)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípios 1, 2, 4, 5,
  6, 8, 9, 10, 12 e 13.
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seções 2 (árvore de
  arquivos — `providers/aws/src/capabilities/storage.controller.ts` e
  `providers/aws/src/adapters/ministack/storage.adapter.ts` já
  previstos ali, ainda inexistentes), 3 (Contrato Mínimo), 4
  (Health-check e Cache), 5 (Configuração de Environment), 6 (Padrões
  de Acesso a Dados — `StorageAdapter` ilustrativo, acesso exclusivo
  via AWS SDK apontando o `endpoint`) e 8 (Docker Compose — serviço
  `ministack`, perfil `managed-env`).
- `spec.md` desta feature, incluindo a Clarificação resolvida na
  sessão de `/specify` (distinguir pastas/prefixos comuns de objetos
  reais, convenção S3 baseada em delimiter).
- `packages/contracts/src/manifest.ts`/`pagination.ts`/`errors.ts` —
  `Capability` já inclui `"storage"` desde a spec 002; `Page<T>` e
  `ProviderError` já existem e são reutilizados sem alteração de
  forma.
- `providers/aws/src/manifest/manifest.service.ts` (spec 005) —
  `buildManifest()` hoje monta `capabilities: []` fixo.
- `providers/aws/src/manifest/health-cache.ts` (spec 006) — mecanismo
  de cache genérico (`createHealthCache`, `HealthCheckFn`,
  `HealthCache`), pronto mas **sem nenhum consumidor real** até esta
  spec (spec 006 explicitamente adiou a integração real para "a
  primeira capability real, spec 008").
- `providers/aws/src/config/environment.config.ts` (spec 007) —
  `resolveEnvironmentConfig()` já resolve `Environment.endpoint`
  efetivo (gerenciado ou externo); esta spec é o primeiro consumidor
  real desse endpoint.
- `providers/aws/src/index.ts` — roteamento manual sem framework
  (`node:http`), comparação de path por igualdade de string exata,
  sem suporte a parâmetro de rota ou query string estruturada ainda.
- `docker-compose.yml`/`.env.example` — serviço `ministack`
  (`ministackorg/ministack:latest`), porta `4566`, sob profile
  `managed-env`; `eventpier-aws` já recebe `MINISTACK_ENDPOINT`/
  `MINISTACK_MANAGED` (spec 007).
- `.pipeline/quality-gates.md`/`.github/workflows/ci.yml` — gates
  atuais não sobem nenhum container real via `docker compose up`; o
  gate "Docker" só faz `docker compose build` (nunca `up`). Nenhum
  script de validação existente depende de um serviço externo de
  verdade — todos ou leem arquivos/config, ou spawnam o processo do
  próprio provider isoladamente.
- **Pesquisa externa sobre o MiniStack** (`ministackorg/ministack`,
  imagem Docker pública, MIT, ~150MB, ~30MB RAM em idle, ~2s de
  startup): confirmado que é um substituto drop-in do LocalStack —
  mesmo endpoint único (porta `4566`), compatível com AWS SDK/CLI sem
  modificação, aceita credenciais dummy (`AWS_ACCESS_KEY_ID=test`/
  `AWS_SECRET_ACCESS_KEY=test`), requer `forcePathStyle: true` no
  cliente S3 (não usa virtual-hosted-style DNS) e região arbitrária
  (convenção `us-east-1`). Sem login, conta ou cartão exigidos — nada
  impede subir uma instância real em CI.

Nenhum conflito entre spec e regras/arquitetura encontrado.
`StorageAdapter` de `docs/arquitetura.md` §6 é um esboço ilustrativo
(assinatura simplificada, sem distinguir pastas de objetos, sem
`Bucket`/`StorageObject` definidos em lugar nenhum) — esta spec refina
essa assinatura para refletir a Clarificação resolvida no `/specify`,
sem contradizer a intenção original (isolar o Environment atrás de uma
interface, trocável sem alterar controller/contrato).

## Decisão 1 — Novo tipo `StorageEntry` (união discriminada) em vez de estender `Page<T>`

**Decisão**: a listagem de objetos retorna `Page<StorageEntry>`, onde
`StorageEntry` é uma união discriminada por `type`:
`{ type: "folder"; prefix: string } | { type: "object"; key: string; size: number; lastModified: string }`.
Uma única lista (`items`) mistura pastas e objetos do nível atual,
cada item se autoidentificando via `type`.

**Alternativas consideradas**:
- *Estender `Page<T>` com dois arrays (`folders`/`objects`)* —
  rejeitado: `Page<T>` já é usado por `ProviderManifest`/contrato
  geral com uma forma fixa (`items`/`nextCursor`); criar uma segunda
  forma de paginação só para Storage quebraria a consistência do
  contrato e complicaria a paginação combinada (cursor precisaria
  cobrir dois arrays simultaneamente, ambíguo quando um se esgota
  antes do outro).
- *Lista plana de chaves, sem distinção* — era a alternativa não
  recomendada na Clarificação de `spec.md`; descartada pelo próprio
  usuário durante `/specify`.

**Consequência para `/tasks`**: novo arquivo
`packages/contracts/src/storage.ts` com `Bucket`, `StorageEntry` (e os
dois membros da união); `packages/contracts/src/index.ts` reexporta.

## Decisão 2 — `Bucket` e `StorageEntry` com campos mínimos, sem metadados especulativos

**Decisão**: `Bucket = { name: string }`; objeto dentro de
`StorageEntry` = `{ type: "object", key, size, lastModified }`; pasta
= `{ type: "folder", prefix }`. Nenhum campo além do exigido
literalmente pelos Requisitos Funcionais 1 e 3 de `spec.md` (ex.: sem
`createdAt` de bucket, sem `contentType`/`etag`/tags de objeto).

**Justificativa**: princípio 12 da constitution (abstração só após
necessidade comprovada) — a AWS SDK devolve `CreationDate` de bucket
"de graça", mas adicionar um campo não pedido pela spec antecipa uma
necessidade não confirmada. Se a UI (spec 011) precisar de mais
metadados, é uma extensão aditiva trivial ao contrato (princípio 4),
não uma mudança estrutural.

**Consequência para `/tasks`**: o adapter mapeia apenas os campos
listados a partir da resposta do AWS SDK, descartando o resto.

## Decisão 3 — `buildManifest` recebe `capabilities` já resolvidas; cálculo assíncrono fica no chamador

**Decisão**: `buildManifest(environment: Environment, capabilities: CapabilityDescriptor[]): ProviderManifest`
continua uma função **síncrona e pura** de montagem (mesmo padrão da
spec 007, que já mudou sua assinatura de `buildManifest()` para
`buildManifest(environment)`). Quem resolve a capability `storage`
(chamada assíncrona ao `HealthCache.getStatus()`) é o handler HTTP em
`index.ts`, via nova função
`getStorageCapabilityDescriptor(healthCache): Promise<CapabilityDescriptor>`
exportada por `capabilities/storage.controller.ts`.

**Alternativas consideradas**:
- *`buildManifest` assíncrono, resolvendo capabilities internamente*
  — rejeitado: acoplaria `manifest.service.ts` (montagem pura de
  payload) ao mecanismo de health-check de uma capability específica,
  contradizendo a separação de responsabilidades já estabelecida
  (mesma razão que justificou, na spec 007, `buildManifest` receber
  `environment` já resolvido em vez de ler `process.env` sozinho).

**Consequência para `/tasks`**: o handler `GET /api/v1/manifest` em
`index.ts` vira uma função assíncrona; `manifest.service.ts` ganha
apenas um novo parâmetro, sem virar `async`.

## Decisão 4 — Roteamento HTTP manual continua sem framework; `URL`/`URLSearchParams` nativos para path params e query string

**Decisão**: mantém `node:http` puro (nenhum Express/Fastify
introduzido). O novo path com parâmetro
(`/api/v1/storage/buckets/:bucket/objects`) é casado com uma regex
(`/^\/api\/v1\/storage\/buckets\/([^/]+)\/objects$/`); `req.url` passa
a ser parseado com `new URL(req.url ?? "/", "http://localhost")` (API
`URL` global do Node, sem dependência nova) em vez do atual
`req.url.split("?")[0]`, habilitando `url.pathname` e
`url.searchParams.get(...)` para `prefix`/`cursor`.

**Alternativas consideradas**:
- *Introduzir um router (Express/Fastify/Hono)* — rejeitado por ora:
  duas rotas novas (três no total) ainda são administráveis
  manualmente sem framework; princípio 12 (abstração só após
  necessidade comprovada) — reconsiderar quando `queue`/`topic`/etc.
  (fora do MVP) pressionarem por algo mais estruturado.

**Consequência para `/tasks`**: `methodNotAllowed()` em `index.ts`
deixa de fechar sobre `MANIFEST_PATH` fixo e passa a receber o path
como parâmetro (usado pelas três rotas). Comportamento do path
`/api/v1/manifest` não muda (mesma resolução de `pathname`).

## Decisão 5 — Adapter usa `@aws-sdk/client-s3` com `forcePathStyle`, credenciais dummy fixas e timeout curto

**Decisão**: `createMiniStackStorageAdapter(endpoint: string)` cria um
`S3Client` com `region: "us-east-1"` (fixo), `endpoint`,
`forcePathStyle: true`, `credentials: { accessKeyId: "test", secretAccessKey: "test" }`
(fixos, não configuráveis via variável de ambiente) e um timeout de
requisição curto (`requestHandler: { requestTimeout: 3000, connectionTimeout: 3000 }`).

**Justificativa**: confirmado por pesquisa externa que o MiniStack
segue a mesma convenção do LocalStack (path-style obrigatório,
qualquer credencial não vazia serve, região arbitrária). Nenhuma
dessas variáveis afeta a identidade real de um ambiente cloud (não há
cloud real no MVP, princípio 10 da constitution) — não há razão para
torná-las configuráveis agora (princípio 12); se um dia o Eventpier
precisar apontar para credenciais reais (suporte a cloud real, fora do
MVP), isso reabre este adapter deliberadamente. O timeout curto evita
que uma chamada a um `endpoint` inalcançável fique pendurada além do
TTL do cache de health-check (spec 006, default 4s) — sem ele, o
health-check e as próprias chamadas de listagem poderiam demorar muito
mais que o TTL para reportar indisponibilidade.

**Alternativas consideradas**:
- *Credenciais/região configuráveis via variável de ambiente* —
  rejeitado por não ter nenhum requisito funcional que peça isso; YAGNI
  (princípio 12).

**Consequência para `/tasks`**: `providers/aws/package.json` ganha
`@aws-sdk/client-s3` (versão `3.1110.0`, última publicada no momento
desta pesquisa) como dependência real, primeira dependência de runtime
do provider além de `@eventpier/contracts`.

## Decisão 6 — Listagem de objetos usa `Delimiter: "/"`; item cujo `Key` é idêntico ao `prefix` é descartado

**Decisão**: `listObjects()` chama `ListObjectsV2Command` com
`Delimiter: "/"` e o `prefix` recebido; `CommonPrefixes` da resposta
viram entradas `{ type: "folder" }`, `Contents` viram
`{ type: "object" }` — exceto um item cujo `Key` seja exatamente igual
ao `prefix` informado (o "objeto marcador de pasta" de zero bytes que
alguns clientes S3, incluindo o console da AWS, criam ao "criar uma
pasta" explicitamente).

**Justificativa**: sem esse filtro, navegar para dentro de uma pasta
criada por um cliente que grava esse marcador mostraria um objeto
fantasma de tamanho zero com o mesmo nome da própria pasta —
contradiz o objetivo da Clarificação de `spec.md` (distinguir
claramente pastas de objetos reais).

**Consequência para `/tasks`**: `storage.controller.test.ts` (via
adapter falso, não o SDK real) cobre a distinção pasta/objeto; o
filtro do marcador é exercitado apenas pelo adapter real
(`storage.adapter.ts`), validado manualmente em `quickstart.md` e pelo
script de integração (Decisão 9) criando esse cenário de verdade
contra um MiniStack real.

## Decisão 7 — Classificação de erro isolada (`classifyStorageError`), função pura testável sem SDK real

**Decisão**: `capabilities/storage.controller.ts` exporta uma função
pura `classifyStorageError(err: unknown): StorageErrorClassification`
(`{ kind: "connection"; reason: HealthFailureCode } | { kind: "not-found" } | { kind: "unknown" }`),
usada tanto pelos handlers HTTP (montar `ProviderError`) quanto pela
verificação de health-check (Decisão 8). Reconhece `err.code`/
`err.cause?.code` em `{"ECONNREFUSED"}` → `CONNECTION_REFUSED`;
`{"ETIMEDOUT", "ECONNRESET"}` ou `err.name === "TimeoutError"` →
`CONNECTION_TIMEOUT`; `err.name === "NoSuchBucket"` → `"not-found"`
(explicitamente **não** invalida o cache de health — o MiniStack
respondeu normalmente, só o bucket não existe); qualquer outro erro →
`"unknown"`.

**Justificativa**: Requisito Funcional 7 de `spec.md` exige invalidar
o cache só em falha real de conexão; Requisito Funcional 8 exige um
erro distinto (não vazio, não conectividade) para bucket inexistente.
Uma função pura e isolada permite testar as duas ramificações sem
subir MiniStack nem mockar o SDK inteiro — só construir objetos de
erro com a forma mínima que o SDK realmente produz
(`{ name: "NoSuchBucket" }`, `{ code: "ECONNREFUSED" }`, etc.).

**Consequência para `/tasks`**: `storage.controller.test.ts` cobre
`classifyStorageError` com casos construídos manualmente, sem
depender de rede nem de mocks do `@aws-sdk/client-s3`.

## Decisão 8 — Health-check real da capability `storage` chama `listBuckets()`

**Decisão**: `createStorageHealthCheck(adapter): HealthCheckFn` chama
`adapter.listBuckets()` sem argumentos; sucesso →
`{status: "available"}`; falha classificada como `"connection"` via
Decisão 7 → `{status: "unavailable", reason}`; qualquer outra falha
(`"not-found"` não se aplica aqui, `"unknown"`) → `{status: "unavailable", reason: "UNKNOWN"}`.

**Justificativa**: `listBuckets()` é a operação mais barata e sem
efeitos colaterais disponível no `StorageAdapter` para provar
conectividade real com o ambiente configurado — não exige saber o
nome de nenhum bucket previamente.

**Alternativas consideradas**:
- *Checagem de conectividade TCP/HTTP genérica, sem usar o SDK* —
  rejeitado: não prova que o MiniStack está de fato respondendo como
  um S3 válido (poderia estar de pé mas respondendo erro em toda
  operação S3); usar a própria operação real do SDK é mais fiel ao
  princípio de "observar exatamente o que uma aplicação real veria"
  (`docs/arquitetura.md` §6).

**Consequência para `/tasks`**: em `index.ts`,
`createHealthCache(createStorageHealthCheck(storageAdapter))` é
construído uma única vez no bootstrap, junto da resolução de
`environment` — mesmo ponto de wiring, sem novo estado global
disperso.

## Decisão 9 — Validação de integração real com MiniStack em CI, script novo `scripts/validate-storage-endpoint.mjs`

**Decisão**: diferente de todos os scripts de validação anteriores
(que nunca dependem de um serviço externo real), este novo script
depende de um MiniStack real acessível, e o `ci.yml` ganha um passo
`docker compose --profile managed-env up -d ministack` antes de
rodá-lo. O script:
1. Cria um bucket de teste e uma estrutura de prefixos/objetos
   próprios (fixture autocontida, via `@aws-sdk/client-s3` direto no
   script) — nunca assume dado pré-existente no MiniStack.
2. Sobe o processo real do provider apontando para esse MiniStack
   (`MINISTACK_ENDPOINT` do ambiente de CI).
3. Valida `GET /api/v1/storage/buckets`, `GET .../objects` (raiz e um
   prefixo aninhado, confirmando a distinção pasta/objeto da Decisão
   1) e um bucket inexistente (`RESOURCE_NOT_FOUND`) contra o
   MiniStack real.
4. Valida que `GET /api/v1/manifest` reflete `storage` com
   `status: "available"` nesse cenário.
5. Roda **outro** spawn do provider, separado, apontando para um
   endpoint deliberadamente inalcançável (porta não escutada), para
   validar o cenário de indisponibilidade (`ProviderError` de conexão
   e `status: "unavailable"` no manifesto) — sem precisar derrubar o
   MiniStack real compartilhado pelo restante do script.

**Justificativa da mudança de padrão**: pesquisa externa (ver
"Contexto lido") confirma que o MiniStack sobe em ~2s, ~30MB RAM, sem
login/conta — o custo de trazê-lo para CI é baixo, e é exatamente o
"primeira conexão real" que a spec 006 já apontava para esta spec. Sem
isso, a distinção pasta/objeto (o próprio motivo da Clarificação desta
spec) e o mapeamento de erros reais do SDK (`NoSuchBucket`, etc.)
nunca seriam verificados de forma automatizada — só manualmente
(`quickstart.md`), o que é mais frágil para regressão contínua.

**Alternativas consideradas**:
- *Só testar o cenário "MiniStack indisponível" em CI (sem subir o
  container), deixando o caminho feliz só para validação manual* —
  era a opção inicialmente mais conservadora (evita adicionar
  `docker compose up` ao CI pela primeira vez); descartada depois da
  pesquisa externa confirmar que o custo/risco de subir o MiniStack em
  CI é baixo — vale testar automaticamente o comportamento que é
  literalmente o propósito desta spec.
- *Testcontainers* — existe um módulo oficial
  (`ministackorg/testcontainers-ministack`), mas introduziria uma
  dependência de teste nova e um padrão (Testcontainers) inexistente
  no restante do projeto, que já orquestra containers via
  `docker compose` diretamente nos scripts de CI — inconsistente sem
  ganho concreto para o único cenário desta spec.

**Consequência para `/tasks`**: `.github/workflows/ci.yml` ganha um
passo "Iniciar MiniStack" (`docker compose --profile managed-env up -d ministack`)
antes do step de "Testes de integração"; `.pipeline/quality-gates.md`
documenta esse novo pré-requisito (também para quem rodar os gates
localmente). Sem passo de teardown dedicado — cada job de CI roda em
uma VM efêmera, destruída ao final; adicionar `down` explícito não tem
efeito prático (YAGNI).

## Decisão 10 — `scripts/validate-manifest-endpoint.mjs` atualizado para refletir `capabilities` não mais vazio

**Decisão**: a asserção existente
(`capabilities.length !== 0` → erro) muda para verificar que
`capabilities` tem exatamente um item, `{ id: "storage", status: "unavailable", reason: <HealthFailureCode válido> }`
— este script spawna o provider isoladamente, sem MiniStack real
acessível (nem `docker compose`), então a capability `storage` é
genuinamente `unavailable` nesse contexto (o MiniStack apontado pelo
default, `http://ministack:4566`, não resolve fora da rede do
Compose).

**Justificativa**: este script já provava, sem querer, o cenário de
indisponibilidade real (hostname `ministack` não resolvível fora do
Docker) — só a asserção estava desatualizada (esperava lista vazia,
válido antes desta spec).

**Consequência para `/tasks`**: nenhuma mudança de comportamento do
provider em si; só a asserção do script muda.

## Decisão 11 — `@aws-sdk/client-s3` também declarado no `package.json` raiz

**Decisão**: além de `providers/aws/package.json` (Decisão 5),
`package.json` na raiz do monorepo ganha `@aws-sdk/client-s3` como
`devDependency`, na mesma versão exata (`3.1110.0`).

**Justificativa**: `scripts/validate-storage-endpoint.mjs` (Decisão 9)
roda a partir da raiz do monorepo, fora de qualquer workspace, e
precisa importar `@aws-sdk/client-s3` de verdade para criar sua
fixture (bucket/objetos de teste) contra o MiniStack real. Sob o
isolamento estrito de `node_modules` do pnpm (sem hoisting implícito,
`pnpm-workspace.yaml` sem `.npmrc` customizado), uma dependência
declarada só em `providers/aws/package.json` não fica resolvível a
partir de `scripts/` — só pacotes declarados no `package.json` que
"possui" o diretório de onde o import parte são linkados ali. Os
scripts anteriores nunca bateram nesse problema porque só importavam
`packages/contracts/dist/index.js` via caminho relativo de arquivo
(sem resolução de pacote) ou não importavam nada externo.

**Alternativas consideradas**:
- *Usar a AWS CLI via `child_process.spawn` na fixture, em vez de
  importar o SDK* — evitaria o problema de hoisting sem duplicar a
  dependência, e é o mesmo caminho já usado em `quickstart.md` (passo
  4, validação manual). Rejeitada para o script automatizado de CI
  especificamente por depender de um binário do sistema não declarado
  em lugar nenhum do repositório (diferente de `docker`/`node`, que já
  são pré-requisitos assumidos por todo o pipeline) — uma dependência
  npm declarada e instalada via `pnpm install` é mais hermética e
  reproduzível do que assumir que `aws` CLI está no `PATH` do runner de
  CI. `quickstart.md` continua usando a AWS CLI para validação manual
  (ferramenta comum de desenvolvimento local), sem contradição — são
  dois contextos diferentes com trade-offs diferentes.
- *Mover `validate-storage-endpoint.mjs` para dentro de
  `providers/aws/` (ex.: `providers/aws/scripts/`)* — rejeitado por
  quebrar o padrão estabelecido desde a spec 001 de todo script de
  validação viver em `scripts/` na raiz, independente de qual
  workspace ele valida (`validate-manifest-endpoint.mjs` e
  `validate-environment-config.mjs` também validam especificamente
  `providers/aws` e vivem em `scripts/`).

**Consequência para `/tasks`**: a task que cria
`scripts/validate-storage-endpoint.mjs` também edita `package.json`
(raiz) e roda `pnpm install` antes de poder executar o script.

## Decisões durante a implementação

- **T004-T006 — versão de `@aws-sdk/client-s3` rebaixada de `3.1117.0`
  para `3.1110.0`**: ao rodar `pnpm install` com `3.1117.0` (a versão
  mais recente no momento da pesquisa do plano), o pnpm adicionou
  automaticamente uma entrada `minimumReleaseAgeExclude` em
  `pnpm-workspace.yaml` — sinal de que essa versão havia sido publicada
  há menos de 24h (confirmado via `npm view`: publicada
  2026-08-24T19:02Z, um dia antes desta implementação) e foi bloqueada
  pelo gate de segurança de supply-chain do pnpm por padrão. Em vez de
  aceitar o bypass automático, a versão foi trocada para `3.1110.0`
  (publicada 2026-08-13, ~12 dias de maturidade), que instala sem
  precisar de nenhuma exceção em `pnpm-workspace.yaml`. Todos os
  documentos desta spec (`research.md`, `contracts/storage-capability-shape.md`,
  `tasks.md`) foram atualizados para refletir `3.1110.0` como a versão
  correta. Nenhuma mudança de comportamento do adapter — só a versão
  pinada.

- **T018 — `providers/aws/Dockerfile` não previsto no plano original,
  corrigido para instalar dependências reais na imagem de runtime**:
  nenhum artefato de `/plan` desta spec examinou `providers/aws/Dockerfile`
  — omissão do plano. O runtime stage copiava `@eventpier/contracts`
  manualmente (`COPY --from=build .../dist ...`) porque, até a spec
  007, essa era a única dependência do provider, um workspace local
  sem dependências transitivas. Com `@aws-sdk/client-s3` (dependência
  real, com dezenas de pacotes transitivos `@aws-sdk/*`/`@smithy/*`),
  esse padrão manual quebrou: `docker compose --profile managed-env up --build`
  subiu o container `eventpier-aws`, que encerrou imediatamente com
  `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@aws-sdk/client-s3'`.
  Corrigido substituindo o `COPY` manual por
  `pnpm --filter @eventpier/provider-aws deploy --prod --legacy /app/deploy`
  no fim do stage `build` (produz um `node_modules` de produção
  autocontido, incluindo `@eventpier/contracts` com `dist/` já
  presente e todas as dependências transitivas do AWS SDK resolvidas
  via cópia real, não symlink cross-stage) e copiando
  `/app/deploy/node_modules` inteiro para o stage `runtime` — testado
  localmente com `pnpm deploy` antes de alterar o Dockerfile,
  confirmado funcionando dentro do `docker compose` real
  (`GET /api/v1/manifest` retornando `capabilities: [{"id":"storage","status":"available"}]`
  de dentro do container, provando conectividade real com o `ministack`
  do Compose). `--legacy` foi necessário porque pnpm v10+ por padrão
  exige `inject-workspace-packages=true` para `pnpm deploy` sem essa
  flag — não configurado neste projeto, e configurá-lo é uma mudança
  de escopo maior do que o necessário para esta correção pontual.

- **Passo 3 (Quality Gates) — `pnpm --filter <pkg> test`/`build` disparou
  `pnpm install --production` e removeu `devDependencies`**: ao rodar
  os gates finais em sequência, `pnpm --filter @eventpier/provider-aws test`
  falhou com `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY]` (pnpm
  detectou possível divergência entre `node_modules` e o lockfile —
  provavelmente resíduo do teste local de `pnpm deploy` num diretório
  fora do projeto, decisão do Dockerfile acima — e tentou reconciliar
  automaticamente antes do comando filtrado). Rodar com `CI=true`
  destravou a reconciliação, mas ela rodou como `install --production`,
  removendo `vitest`/`typescript`/`@types/node` de `node_modules`
  (`vitest: not found` na tentativa seguinte). Corrigido com
  `CI=true pnpm install` (sem `--production`), restaurando as
  `devDependencies`; suíte voltou a passar (39/39) na sequência.
  Nenhuma mudança de arquivo — só um efeito colateral local do ambiente
  de execução, sem relação com o código desta spec; `pnpm-lock.yaml`
  permaneceu idêntico durante todo o episódio (confirmado via
  `git status` antes/depois).

- **`/review-pr` (PR #15) — 5 correções antes da submissão do review**:
  1. **[ALTO, achado externo, bot Codex]** `decodeURIComponent(objectsMatch[1])`
     em `index.ts` (rota de objects) lançava `URIError` para um segmento de
     bucket malformado (ex.: `/api/v1/storage/buckets/%/objects`) sem
     nenhum try/catch em volta — como o handler do `createServer` é
     `async`, a exceção virava uma promise rejeitada não tratada, e o
     Node encerra o processo por padrão nesse caso (confirmado
     reproduzindo antes da correção: uma única requisição malformada
     derrubava o provider inteiro). Corrigido com um try/catch dedicado
     em volta do `decodeURIComponent` (retorna `400 BAD_REQUEST` para
     path malformado) **e** um try/catch geral em volta de todo o corpo
     do handler (rede de segurança para qualquer outra exceção síncrona
     não prevista, retorna `500`). Reconfirmado depois da correção:
     requisição malformada agora retorna 400 e o processo continua
     respondendo normalmente na sequência (testado manualmente e via
     novo Cenário 3 de `scripts/validate-storage-endpoint.mjs`).
  2. **[MÉDIO]** O filtro do "objeto marcador de pasta" em
     `storage.adapter.ts` (`o.Key !== prefix`) escondia qualquer objeto
     real cuja key coincidisse exatamente com um `prefix` que não
     terminasse em `/` — só deveria filtrar quando `prefix` termina no
     delimiter (única forma de ser de fato um marcador de pasta).
     Corrigido com `isFolderMarker()`, condicionando o filtro a
     `prefix.endsWith(DELIMITER)`. Coberto por um novo caso em
     `scripts/validate-storage-endpoint.mjs` (`prefix=raiz.txt`, sem
     `/`, deve manter o objeto real).
  3. **[MÉDIO]** Erros `unknown` de storage (nem conexão, nem
     `NoSuchBucket`) não deixavam nenhum rastro server-side — só a
     mensagem genérica do `ProviderError` chegava ao chamador. Corrigido
     com `logIfUnknown()` (`console.error`) nos dois pontos que
     classificam erro (`createStorageHealthCheck` e
     `withStorageErrorHandling`) — só no ramo `unknown`, já que os ramos
     `connection`/`not-found` já carregam informação suficiente via
     `code`/status HTTP.
  4. **[BAIXO]** `environment.endpoint ?? ""` em `index.ts` mascararia
     silenciosamente uma quebra futura do invariante "endpoint sempre
     preenchido" da spec 007. Trocado por `environment.endpoint!`
     (asserção explícita do invariante já documentado/testado, em vez
     de um fallback que produziria um `S3Client` com endpoint vazio e um
     erro confuso).
  5. **[BAIXO]** Faltava um teste espelhando, para `listObjects`, o
     teste que `listBuckets` já tinha de invalidação de cache em falha
     de conexão real. Adicionado — cobertura simétrica entre as duas
     funções (compartilham `withStorageErrorHandling`).

  **Achado adicional durante a verificação da correção #3**: ao
  reproduzir o log de erro `unknown` recém-adicionado,
  `validate-manifest-endpoint.mjs`/`validate-storage-endpoint.mjs`
  revelaram que uma falha de resolução DNS (`EAI_AGAIN`/`ENOTFOUND` —
  o cenário real de `MINISTACK_ENDPOINT=http://ministack:4566` rodando
  fora da rede do Compose) caía em `unknown` em vez de `connection`,
  já que `classifyStorageError` só reconhecia
  `ECONNREFUSED`/`ETIMEDOUT`/`ECONNRESET`. Isso significava não
  invalidar o cache de health-check numa falha de ambiente
  perfeitamente real e comum. Corrigido adicionando `ENOTFOUND`/
  `EAI_AGAIN` à classificação `connection`/`CONNECTION_REFUSED`
  (`HealthFailureCode` não tem um valor dedicado a falha de DNS — o mais
  próximo semanticamente é "não consegui alcançar o host"), com dois
  novos casos de teste parametrizados.

  Suíte final: 42/42 testes unitários (era 39/39 antes desta rodada);
  os três scripts de integração (`validate-manifest-endpoint.mjs`,
  `validate-environment-config.mjs`, `validate-storage-endpoint.mjs`)
  `OK` contra MiniStack real; `docker compose up --build` reconfirmado
  com sucesso, incluindo o cenário de path malformado dentro do
  container real (400, processo sobrevive).

- **SonarCloud Code Analysis (check de CI não documentado em
  `.pipeline/quality-gates.md` — integração configurada fora do
  pipeline do Eventpier, direto no GitHub/SonarCloud) — 2 achados após
  o push da correção do Codex**:
  1. **CRITICAL** (`typescript:S3776`) — o handler do `createServer`
     em `index.ts` passou de complexidade cognitiva ~10 para 21 (limite
     15) depois do try/catch geral adicionado para a correção do
     Codex. Corrigido extraindo cada rota para sua própria função
     (`handleManifest`, `handleStorageBuckets`, `handleStorageObjects`)
     e um helper compartilhado (`sendStorageResult`) para o padrão
     `if (result.ok) {...} else {...}` repetido três vezes — o handler
     principal do `createServer` vira uma sequência linear de
     `if (path === X) { await handleX(...); return; }`, sem aninhamento
     de método/try dentro de cada rota. Exigiu uma correção adicional
     de tipo: `let environment;` (sem anotação) parava de ter seu tipo
     inferido corretamente dentro das novas funções `function`
     hoisted que o referenciam (`TS7034`/`TS7005`) — corrigido com
     `let environment: Environment;` explícito.
  2. **MINOR** (`javascript:S4036`, vulnerability) — `spawn("node", ...)`
     em `scripts/validate-storage-endpoint.mjs` resolve o executável
     via `PATH` em vez de um caminho absoluto. Corrigido com
     `spawn(process.execPath, ...)`. O mesmo padrão já existe em
     `validate-manifest-endpoint.mjs`/`validate-environment-config.mjs`
     (specs 005/007, não tocados por esta PR) — fora de escopo corrigir
     ali; sinal para quando algum desses scripts for alterado de novo.

  Suíte final após esta rodada: 42/42 testes unitários (inalterado —
  refactor sem mudança de comportamento), build/typecheck limpos, os
  três scripts de integração `OK` contra MiniStack real de novo.
