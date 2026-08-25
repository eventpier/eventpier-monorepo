# Plan — Capability Storage (008)

## Contexto técnico

Primeira capability real do provider AWS — fecha a lacuna que a spec
006 explicitamente deixou aberta ("a integração observável via API só
acontece quando a primeira capability real existir, spec 008") e usa,
pela primeira vez de verdade, o `environment.endpoint` resolvido pela
spec 007. Introduz a primeira dependência de runtime além de
`@eventpier/contracts` (`@aws-sdk/client-s3`) e o primeiro cenário em
que os quality gates deste projeto dependem de um serviço externo real
(`ministack`) — todos os scripts de validação anteriores eram
autocontidos.

Uma Clarificação foi resolvida com o usuário na sessão de `/specify` e
orienta todo este plano: a navegação por prefixo deve distinguir
explicitamente pastas (prefixos comuns) de objetos reais, seguindo a
convenção nativa do S3 baseada em `Delimiter`.

Detalhes técnicos e alternativas rejeitadas em `research.md`
(10 decisões); entidades e regras de classificação de erro em
`data-model.md`; código exato (`storage.ts` do contrato,
`storage.adapter.ts`, `storage.controller.ts` + teste,
`manifest.service.ts`, `index.ts`, `package.json`, dois scripts de
validação — um alterado, um novo — `quality-gates.md`, `ci.yml`) em
`contracts/storage-capability-shape.md`; passos de validação manual em
`quickstart.md`.

## Conformidade com `ARQUIVO_REGRAS` / `ARQUIVO_ARQUITETURA`

| Princípio/seção | Como este plano respeita |
|---|---|
| Constitution §1 (UI conhece capabilities, não clouds) | Nenhum código desta spec toca `apps/ui` (inexistente ainda); o AWS SDK fica inteiramente contido em `providers/aws/src/adapters/ministack/`. |
| Constitution §2 (Provider/Environment distintos) | `StorageAdapter` recebe só `environment.endpoint` (já resolvido pela spec 007) — nenhuma lógica de `managed`/environment é duplicada aqui. |
| Constitution §4 (contrato evolui aditivamente) | `packages/contracts` ganha um arquivo novo (`storage.ts`) e uma nova exportação — nenhum tipo existente (`Page<T>`, `ProviderError`, `CapabilityDescriptor`) é alterado, só consumido (Decisão 1 de `research.md`). |
| Constitution §5 (status enumerado, não booleano) | `CapabilityDescriptor` de `storage` usa `available`/`unavailable` com `HealthFailureCode` quando aplicável (Decisão 8); nenhuma condição de `degraded` é inventada (fora do escopo de `spec.md`, mecanismo de cache da spec 006 não produz esse status). |
| Constitution §6 (health-check cacheado, isolado por capability, invalidação ativa) | `storage` ganha sua própria instância de `createHealthCache()` (spec 006), nunca compartilhada; falha real de conexão invalida ativamente via `healthCache.invalidate()` (Decisão 7/8, Requisito Funcional 7 de `spec.md`) — falha de "bucket não encontrado" explicitamente **não** invalida (não é falha de conectividade). |
| Constitution §8 (endpoint sempre configurável) | O adapter usa exatamente o `endpoint` já resolvido por `resolveEnvironmentConfig()` (spec 007) — nenhum endpoint hardcoded fora do fluxo de configuração existente. |
| Constitution §9 (recursos `managed:false` sem ações de ciclo de vida) | Toda operação desta spec é somente leitura (`listBuckets`/`listObjects`) — nenhuma criação/exclusão/modificação de bucket ou objeto é introduzida, independente de `managed`. |
| Constitution §10 (sem autenticação em ambientes locais) | Nenhuma rota nova exige autenticação; credenciais do `S3Client` são dummy fixas, só para satisfazer o SDK, nunca para autenticar quem chama o provider. |
| Constitution §12 (abstração só após necessidade comprovada) | Credenciais/região do `S3Client` fixas, não configuráveis (Decisão 5); nenhum framework HTTP novo introduzido (Decisão 4); `Bucket`/`StorageEntry` só com os campos exigidos pela spec, nada especulativo (Decisão 2). |
| Constitution §13 (contrato é artefato próprio) | `Bucket`/`StorageEntry` vivem em `packages/contracts/src/storage.ts`, nunca dentro de `providers/aws`. |
| Arquitetura §2 (árvore do Estado 1) | `providers/aws/src/capabilities/storage.controller.ts` e `providers/aws/src/adapters/ministack/storage.adapter.ts` criados exatamente nos caminhos já previstos ali. |
| Arquitetura §3 (Contrato Mínimo) | `CapabilityDescriptor`/`Page<T>`/`ProviderError` reutilizados sem alteração de forma. |
| Arquitetura §4 (Health-check e Cache) | Consumo real do mecanismo da spec 006, exatamente como documentado (TTL/invalidação), sem alterar `health-cache.ts`. |
| Arquitetura §6 (Padrões de Acesso a Dados) | Acesso ao MiniStack exclusivamente via AWS SDK apontando o `endpoint`, nunca uma API proprietária — `StorageAdapter` refinado da Decisão 1 (distinção pasta/objeto) permanece fiel à intenção original (isolar o Environment atrás de uma interface). |
| Arquitetura §8 (Docker Compose) | Nenhuma mudança em `docker-compose.yml`/`.env.example` — `ministack` e as variáveis de `eventpier-aws` já existiam desde as specs 003/007. |

Nenhum conflito entre spec/plano e `ARQUIVO_REGRAS`/`ARQUIVO_ARQUITETURA`
foi identificado.

## Segurança e observabilidade

- **Sem superfície de entrada externa sensível**: as três rotas novas
  são somente leitura, sem parâmetro que dispare qualquer ação sobre o
  MiniStack além de listar; `bucket`/`prefix`/`cursor` são só
  repassados ao SDK como filtros de leitura, nunca interpolados em
  comando de shell ou usados para montar caminho de arquivo local —
  sem risco de injeção.
- **Sem dados sensíveis**: MiniStack é um emulador local sem dados
  reais (princípio 10 da constitution); credenciais do `S3Client` são
  dummy fixas (`"test"`/`"test"`), nunca lidas de variável de ambiente
  nem logadas.
- **Erros nunca vazam detalhe interno desnecessário**: `ProviderError`
  retornado ao chamador usa mensagens genéricas por classificação
  (Decisão 7 de `research.md`) — não ecoa stack trace nem payload bruto
  do erro do SDK.
- **Timeout limitado evita esgotamento de recursos**: `requestTimeout`/
  `connectionTimeout` de 3s no `S3Client` (Decisão 5) evita que uma
  requisição HTTP do provider fique pendurada indefinidamente
  aguardando um endpoint inalcançável — bounded latency também para
  quem chama `GET /api/v1/storage/*`.
- **Logging**: nenhum log novo além do já existente (`console.log` no
  bootstrap, `console.error` no fail-fast de configuração) — mesma nota
  já registrada nos planos das specs 005-007 (sem padrão de logging
  estruturado definido ainda no projeto). Nenhum dado de erro do SDK é
  logado no servidor (só devolvido, já classificado, ao chamador).
- **Observabilidade real, pela primeira vez**: esta é a primeira spec
  em que o provider de fato abre uma conexão de rede real contra o
  environment configurado — tanto em runtime (cada chamada de storage)
  quanto no health-check (Decisão 8). O comportamento sob falha real
  (endpoint inalcançável) é validado automaticamente em CI (Decisão 9
  de `research.md`), não só descrito em teoria.

## Artefatos desta fase

- [research.md](./research.md) — 10 decisões técnicas e alternativas rejeitadas, incluindo confirmação externa do comportamento do MiniStack (path-style, credenciais dummy, região)
- [data-model.md](./data-model.md) — `Bucket`, `StorageEntry` (união discriminada), `classifyStorageError`, `StorageAdapter`, funções de `storage.controller.ts`
- [contracts/storage-capability-shape.md](./contracts/storage-capability-shape.md) — código exato: contrato novo, adapter, controller + teste, `manifest.service.ts`, `index.ts`, `package.json`, dois scripts de validação, `quality-gates.md`, `ci.yml`
- [quickstart.md](./quickstart.md) — validação manual passo a passo (testes, build/typecheck, MiniStack real, fixtures via AWS CLI, caminho feliz, bucket inexistente, indisponibilidade, quality gates, `docker compose up`, regressão)

## Observação para `/tasks`

Ordem sugerida: (1) `packages/contracts/src/storage.ts` +
`packages/contracts/src/index.ts` conforme
`contracts/storage-capability-shape.md`; (2)
`pnpm --filter @eventpier/contracts build`, confirmar sem erros; (3)
`providers/aws/package.json` (nova dependência
`@aws-sdk/client-s3`) + `pnpm install`; (4)
`providers/aws/src/adapters/ministack/storage.adapter.ts`; (5)
`providers/aws/src/capabilities/storage.controller.ts`; (6)
`providers/aws/src/capabilities/storage.controller.test.ts`; (7)
`pnpm --filter @eventpier/provider-aws test`, confirmar todos os testes
verdes (novos + `health-cache.test.ts`/`environment.config.test.ts`
sem regressão) antes de seguir; (8) alterar
`providers/aws/src/manifest/manifest.service.ts` (assinatura de
`buildManifest`); (9) alterar `providers/aws/src/index.ts` (wiring,
três rotas, handler assíncrono); (10)
`pnpm --filter @eventpier/provider-aws build && pnpm -r exec tsc --noEmit`,
confirmar sem erros; (11) alterar `scripts/validate-manifest-endpoint.mjs`
(nova asserção de `capabilities`); (12) criar
`scripts/validate-storage-endpoint.mjs` conforme
`contracts/storage-capability-shape.md`; (13)
`docker compose --profile managed-env up -d ministack`, validar
manualmente com os passos 3-6 de `quickstart.md`; (14) rodar os três
scripts de "Testes de integração" que tocam o provider
(`validate-manifest-endpoint.mjs`, `validate-environment-config.mjs`,
`validate-storage-endpoint.mjs`), confirmar todos `OK`; (15) atualizar
`.pipeline/quality-gates.md` — nova entrada na linha "Testes de
integração" e frase explicativa sobre o pré-requisito do MiniStack;
(16) atualizar `.github/workflows/ci.yml` — novo step "Iniciar
MiniStack" + nova linha no step "Testes de integração"; (17) confirmar
todos os quality gates verdes, incluindo o passo 8 de `quickstart.md`
(`docker compose up` completo sem regressão).

Nenhuma task desta spec deve: alterar
`packages/contracts/src/manifest.ts`/`pagination.ts`/`errors.ts` (os
três já são suficientes como estão — `storage.ts` é aditivo, arquivo
novo); alterar `providers/aws/src/manifest/health-cache.ts` (spec 006,
mecanismo genérico reutilizado sem mudança); alterar
`providers/aws/src/config/environment.config.ts` (spec 007, endpoint já
resolvido, só consumido); alterar `docker-compose.yml`/`.env.example`
(nenhuma variável nova é necessária, Decisão 5 de `research.md`);
introduzir qualquer operação de escrita sobre buckets/objetos (criar,
subir, excluir — fora do MVP, `docs/product.md`); introduzir qualquer
capability além de `storage` (`queue`/`topic`/`secret`/`logs`, union
fechado); introduzir qualquer framework HTTP (Express/Fastify/etc.,
Decisão 4); tornar credenciais ou região do `S3Client` configuráveis
via variável de ambiente (Decisão 5); consumir estes endpoints pela UI
(spec 011, ainda não iniciada).
