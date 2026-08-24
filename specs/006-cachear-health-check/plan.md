# Plan — Cache de Health-check por Capability (006)

## Contexto técnico

Segunda spec da Fase 2 (Provider AWS) — constrói o mecanismo genérico
de cache de health-check em memória (`docs/arquitetura.md` §4,
constitution princípio 6), como peça de infraestrutura isolada e
testável, **sem** nenhuma capability real para exercitá-lo ainda
(Storage é a spec 008, depois desta). Decisão de escopo confirmada
explicitamente com o usuário como Clarificação em `spec.md`: mecanismo
genérico, sem integração com o endpoint de manifesto (spec 005) nem
capability sintética para provar comportamento fim a fim.

Esta é também a primeira spec a introduzir um test runner real
(Vitest) no projeto — `.pipeline/quality-gates.md` já registrava esta
spec como o gatilho para essa troca, por ser a primeira com lógica de
negócio condicional (TTL, cache hit/miss, invalidação) que os scripts
Node puros usados até aqui não validam bem.

Detalhes técnicos e alternativas rejeitadas em `research.md`; entidades
e invariantes em `data-model.md`; código exato (`health-cache.ts`,
teste, `package.json`, `quality-gates.md`, `ci.yml`) em
`contracts/health-cache-shape.md`; passos de validação manual em
`quickstart.md`.

## Conformidade com `ARQUIVO_REGRAS` / `ARQUIVO_ARQUITETURA`

| Princípio/seção | Como este plano respeita |
|---|---|
| Constitution §5 (capability tem status, não booleano) | `CachedHealth.status` é `"available"`/`"unavailable"` (nunca booleano); `reason` tipado como `HealthFailureCode` quando `unavailable` — ver `data-model.md`. |
| Constitution §6 (health-check cacheado por capability, TTL 3-5s configurável, invalidação ativa) | Implementado literalmente: cache isolado por instância (Decisão 1 de `research.md`), TTL default 4000ms configurável via `HEALTH_CHECK_TTL_MS` (Decisão 3), `invalidate()` para falha de chamada real (Decisão 5). Esta spec **é** a implementação direta do princípio 6. |
| Constitution §8 (endpoint do environment sempre configurável) | Não afetado — este mecanismo não lida com `EnvironmentConfig` (spec 007). |
| Constitution §12 (abstração só após necessidade comprovada) | Aplicado duas vezes: (1) sem registro central chaveado por capability id, já que uma única instância por capability basta e não há segunda forma de uso comprovada (Decisão 1); (2) sem deduplicação de chamadas concorrentes, já que nenhum consumidor real existe ainda para expor esse cenário (Decisão 4). Vitest fica escopado a `providers/aws`, não promovido a tooling compartilhado do monorepo sem um segundo workspace precisando dele (Decisão 6). |
| Constitution §13 (contrato é artefato próprio) | `HealthFailureCode` é importado de `@eventpier/contracts` (já existente desde a spec 002), nunca redefinido dentro de `providers/aws`. `CachedHealth` é intencionalmente **não** adicionado ao contrato — é um tipo interno do provider, não algo que atravessa a fronteira UI↔Provider (ver `data-model.md`). |
| Arquitetura §2 (árvore do Estado 1) | `providers/aws/src/manifest/health-cache.ts` criado exatamente no caminho já previsto na árvore de arquivos. |
| Arquitetura §4 (Health-check e Cache) | Implementação literal da interface `CachedHealth` e das regras de TTL/invalidação já documentadas ali — nenhum campo ou comportamento novo além do que a seção já especifica. |
| Arquitetura §6 (acesso via SDK, sem bundler) | Não aplicável diretamente (sem chamada real a MiniStack/AWS SDK nesta spec) — mas o `HealthCheckFn` injetado é o ponto de extensão que a spec 008 usará para plugar a chamada real via AWS SDK, sem o módulo de cache precisar conhecer SDK nenhum. |

Nenhum conflito entre spec/plano e `ARQUIVO_REGRAS`/`ARQUIVO_ARQUITETURA`
foi identificado.

## Segurança e observabilidade

- **Sem superfície de entrada externa**: `createHealthCache` só recebe
  parâmetros de código interno do próprio provider (uma função de
  verificação e um TTL opcional) — nenhum dado vindo de rede, query
  param ou corpo de requisição passa por este módulo nesta spec. Nada a
  validar como boundary de segurança.
- **Sem dados sensíveis no cache**: `CachedHealth` armazena apenas
  `status`, `reason` (enum fechado) e `checkedAt` (timestamp) — nunca
  credenciais, endpoints internos ou qualquer payload da capability.
  Consequência direta para a spec 008: a função `check()` que uma
  capability fornecer não deve resolver/rejeitar com dados sensíveis
  dentro do `HealthCheckResult`, já que esse valor é retido em memória
  pelo TTL inteiro.
- **Sem exceção não tratada vazando para o chamador**: RF7 exige que
  qualquer falha (esperada ou não) resulte em `CachedHealth` válido,
  nunca uma exceção — reduz risco de um erro não capturado expor stack
  trace ou detalhe interno em uma camada acima (ex.: futura resposta
  HTTP do manifesto, spec 008).
- **Logging**: nenhum log é adicionado nesta spec — mesmo raciocínio já
  registrado em `specs/005-expor-manifesto/plan.md` (sem padrão de
  logging estruturado definido ainda no projeto).
- **Observabilidade real**: ainda não existe nenhuma chamada de rede de
  verdade para MiniStack/AWS nesta spec — `check()` é sempre fornecido
  por quem chama (testes, ou a spec 008 futuramente). Nada aqui se
  conecta a um serviço externo.

## Artefatos desta fase

- [research.md](./research.md) — decisões técnicas e alternativas rejeitadas
- [data-model.md](./data-model.md) — `CachedHealth`, `HealthCheckResult`, `HealthCheckFn`, `HealthCache`
- [contracts/health-cache-shape.md](./contracts/health-cache-shape.md) — código exato: `health-cache.ts`, `health-cache.test.ts`, `package.json`, `quality-gates.md`, `ci.yml`
- [quickstart.md](./quickstart.md) — validação manual passo a passo (suíte de testes, build/typecheck, demonstração ad-hoc, regressão do endpoint de manifesto)

## Observação para `/tasks`

Ordem sugerida: (1) `providers/aws/package.json` — adicionar
`devDependencies.vitest` (`4.1.11`) e `scripts.test`, rodar
`pnpm install` para resolver a nova dependência; (2)
`providers/aws/src/manifest/health-cache.ts` conforme
`contracts/health-cache-shape.md`; (3)
`providers/aws/src/manifest/health-cache.test.ts` conforme o mesmo
arquivo; (4) `pnpm --filter @eventpier/provider-aws test`, confirmar
todos os testes verdes antes de seguir; (5)
`pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build && pnpm -r exec tsc --noEmit`,
confirmar sem erros (inclui `health-cache.test.ts` no escopo do
Typecheck — Decisão 8 de `research.md`); (6) validar manualmente com os
passos 1-4 de `quickstart.md`; (7) atualizar
`.pipeline/quality-gates.md` — nova linha **Testes unitários** antes de
**Build**, renomear a linha **Testes** existente para **Testes de
integração** (sem mudar seu comando); (8) atualizar
`.github/workflows/ci.yml` — novo step **Testes unitários** logo após
"Install dependencies", renomear o step **Testes** existente para
**Testes de integração**; (9) confirmar todos os quality gates verdes,
incluindo o passo 5 de `quickstart.md` (regressão do endpoint de
manifesto).

Nenhuma task desta spec deve: alterar
`providers/aws/src/manifest/manifest.service.ts` ou
`providers/aws/src/index.ts` (RF9 — sem integração com o manifesto
ainda); adicionar qualquer capability real ou referência a Storage/AWS
SDK; adicionar `CachedHealth` a `packages/contracts/src/`; implementar
deduplicação de chamadas concorrentes (Decisão 4 de `research.md`);
mover `vitest` para o `package.json` raiz do monorepo (Decisão 6).
