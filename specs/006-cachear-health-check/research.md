# Research — Cache de Health-check por Capability (006)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípios 5, 6, 8, 12 e
  13.
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seções 2 (árvore de
  arquivos — `providers/aws/src/manifest/health-cache.ts` já previsto
  ali), 3 (Contrato Mínimo — `HealthFailureCode`, `CapabilityDescriptor`)
  e 4 (Health-check e Cache — `CachedHealth`, regras de TTL/invalidação).
- `spec.md` desta feature, incluindo a Clarificação resolvida na sessão
  de `/specify` (mecanismo genérico isolado, sem integração com o
  manifesto nem capability sintética).
- `packages/contracts/src/manifest.ts` — `HealthFailureCode` já existe
  como constante/tipo exportado (`HEALTH_FAILURE_CODES`); esta spec
  reutiliza, nunca redefine.
- `providers/aws/src/manifest/manifest.service.ts` (spec 005) —
  `buildManifest()` não é tocado nesta spec (RF9); confirma que não há
  nenhum ponto de integração existente para alterar.
- `.pipeline/quality-gates.md` — nota explícita: "Trocar por um runner
  de verdade quando a primeira spec com lógica de negócio condicional
  (006, health-check com cache) precisar de testes unitários." Esta
  spec é o gatilho registrado para essa troca.
- `specs/002-definir-contrato-compartilhado/research.md` (Decisão 7,
  rejeição de test runner até haver lógica condicional real) e
  `specs/005-expor-manifesto/research.md` (Decisão 8, mesma nota) —
  ambas adiavam explicitamente para esta spec.

Nenhum conflito entre spec e regras/arquitetura encontrado. `CachedHealth`
(seção 4 de `arquitetura.md`) é um tipo interno do provider, distinto de
`CapabilityDescriptor` (contrato externo, já em `packages/contracts`) —
não é adicionado ao pacote de contratos, vive só em `providers/aws`.

## Decisão 1 — Cache por instância (factory), não por registro chaveado por capability id

**Decisão**: `createHealthCache(check, options)` retorna uma instância
independente (`{ getStatus, invalidate }`); cada capability futura (spec
008+) cria e guarda sua própria instância. Nenhum `Map`/registro global
chaveado por `capability id` dentro do módulo.

**Alternativas consideradas**:
- *Registro central* (`HealthCacheRegistry` mapeando `capability id` →
  entrada de cache, com API `getStatus(capabilityId)`/
  `invalidate(capabilityId)`) — rejeitado: exigiria o módulo conhecer os
  ids válidos de capability (acoplamento com `@eventpier/contracts`,
  violando o Requisito Funcional 8 da spec, que proíbe acoplamento a
  capability específica) e adicionaria uma camada de indireção por chave
  string sem necessidade real — isolamento entre capabilities já é
  garantido estruturalmente por instâncias independentes, mais forte que
  isolamento por chave (sem risco de colisão ou registro duplicado).

**Consequência para `/tasks`**: `health-cache.ts` exporta
`createHealthCache` como função pura, sem nenhum estado a nível de
módulo compartilhado entre instâncias — facilita diretamente o teste de
isolamento entre duas capabilities (Critérios de Sucesso de `spec.md`).

## Decisão 2 — `HealthCheckFn` resolve o resultado classificado; nunca precisa lançar para reportar falha

**Decisão**: `type HealthCheckFn = () => Promise<{status: "available"} | {status: "unavailable"; reason: HealthFailureCode}>`.
Quem implementa uma capability decide o motivo da falha e **resolve**
normalmente (falha de rede é um resultado esperado de um health-check,
não uma exceção). `createHealthCache` trata qualquer rejeição/exceção
não esperada (bug, throw não tratado) como rede de segurança, mapeando
para `{status: "unavailable", reason: "UNKNOWN"}` — nunca propaga para
quem chama `getStatus()` (Requisito Funcional 7).

**Alternativas consideradas**:
- *Assinatura `() => Promise<void>`, exigindo `reject(erro tipado)` para
  reportar falha com `HealthFailureCode`* — rejeitado: força modelar um
  resultado esperado (ambiente indisponível) como exceção, e obriga o
  módulo de cache a fazer parsing/type-narrowing de um erro arbitrário
  lançado por código de terceiro (a capability), aumentando a superfície
  de "exceção não tratada" que o Requisito Funcional 7 pede para evitar.

**Consequência para `/tasks`**: `health-cache.ts` exporta os tipos
`HealthCheckFn` e `HealthCheckResult`; a spec 008 (Storage) implementa a
verificação real da capability seguindo esta assinatura.

## Decisão 3 — TTL default 4000ms, resolvido na criação da instância, com fallback silencioso em valor inválido

**Decisão**: `resolveTtlMs(explicit?)` prioriza (1) um parâmetro
explícito (usado pelos testes, sem precisar mutar `process.env`), depois
(2) `process.env.HEALTH_CHECK_TTL_MS` parseado como inteiro positivo,
depois (3) `DEFAULT_TTL_MS = 4000`. Um valor de env var ausente, não
numérico ou `<= 0` cai silenciosamente no default — sem lançar erro na
criação da instância.

**Justificativa do default (4000ms)**: `docker-compose.yml`
(`arquitetura.md` §8) já usa `HEALTH_CHECK_TTL_MS=4000` como exemplo,
dentro do intervalo 3-5s do princípio 6 da constitution. Reaproveitar o
mesmo valor evita um segundo número "mágico" divergente entre a
documentação de arquitetura e o código.

**Alternativas consideradas**:
- *Lançar erro na inicialização se `HEALTH_CHECK_TTL_MS` vier inválido*
  — rejeitado: um provider que não sobe por causa de uma env var de
  tuning malformada é um risco desproporcional para um valor que já tem
  default razoável.
- *Logar um aviso no fallback* — rejeitado nesta spec por simplicidade:
  o projeto não tem nenhum padrão de logging estruturado definido ainda;
  reavaliar se/quando isso existir.

**Consequência para `/tasks`**: teste unitário cobre explicitamente env
var ausente, válida e inválida (string não numérica, zero, negativa).

## Decisão 4 — Sem deduplicação de chamadas concorrentes (in-flight promise sharing)

**Decisão**: cada chamada a `getStatus()` enquanto o cache está
expirado/vazio dispara sua própria chamada a `check()` — nenhuma promise
em voo é compartilhada entre chamadas concorrentes.

**Alternativas consideradas**:
- *Cachear a Promise em voo e compartilhar entre chamadas concorrentes*
  (proteção contra "thundering herd") — considerado, mas rejeitado
  nesta spec: nenhum Requisito Funcional exige isso, e não há nenhum
  consumidor real ainda (RF9 — nenhuma capability usa este mecanismo
  nesta spec) que exponha esse cenário de concorrência. Adicionar agora
  seria complexidade especulativa, no mesmo espírito do princípio 12 da
  constitution (abstração/robustez só após necessidade comprovada).

**Consequência para `/tasks`**: nenhuma task implementa lógica de
promise em voo. Revisitar quando a spec 008 (Storage) expuser
`getStatus()` a requisições HTTP concorrentes de verdade via manifesto.

## Decisão 5 — `invalidate()` limpa o cache; nunca marca `unavailable` de forma sintética

**Decisão**: `invalidate()` limpa a entrada cacheada, forçando a
próxima leitura a rodar `check()` de verdade — não seta
`status: "unavailable"` imediatamente. O Requisito Funcional 6 pede
"forçar nova verificação real", não "reportar indisponível sem checar".

**Alternativas consideradas**:
- *`invalidate()` já marca `status: "unavailable"` de forma otimista*
  (evita esperar round-trip na primeira leitura pós-falha) — rejeitado:
  reportaria um estado não verificado — a causa real pode já ter se
  resolvido entre a falha que disparou o `invalidate()` e a próxima
  leitura — contradizendo a motivação do próprio princípio 6 (refletir
  estado real, não suposição).

**Consequência para `/tasks`**: teste cobre que, logo após
`invalidate()`, a próxima `getStatus()` de fato chama `check()` de novo
(não apenas retorna um valor sintético).

## Decisão 6 — Runner de testes: Vitest, escopado a `providers/aws` (não workspace-raiz ainda)

**Decisão**: adicionar `vitest` (`4.1.11`, pin exato — mesmo padrão de
`typescript`/`@types/node` na raiz) como `devDependency` de
`providers/aws/package.json`; script `"test": "vitest run"`. Sem
`vitest.config.ts` — os defaults do Vitest bastam (ambiente `node`,
resolução TS nativa via esbuild, sem `ts-node`/`ts-jest`).

**Alternativas consideradas**:
- *Jest* — rejeitado: exigiria configuração adicional para ESM +
  TypeScript nativo (`ts-jest` ou `babel-jest`) que o projeto não tem
  hoje, enquanto Vitest suporta TS/ESM nativamente sem transformação
  extra — alinhado à ausência de bundler já decidida (`arquitetura.md`
  §6).
- *`node:test` (runner nativo do Node)* — considerado; rejeitado porque
  testar expiração de TTL de forma determinística exige controle de
  tempo (fake timers), e `node:test` não tem uma API de fake timers tão
  madura quanto a do Vitest embutida — precisaria de uma lib externa só
  para isso, anulando a vantagem de "sem dependência nova".
- *Instalar Vitest no root do monorepo, compartilhado por todos os
  workspaces* — rejeitado por ora: nenhum outro workspace precisa de
  test runner ainda (`apps/ui` usa Storybook para validação visual,
  `packages/contracts` usa checagem estática via
  `contract-shape.check.ts`) — mesmo raciocínio do princípio 12
  (abstração/tooling compartilhado só após necessidade comprovada em
  mais de um lugar). Mover para o root quando um segundo workspace
  precisar de um test runner real.

**Consequência para `/tasks`**: `providers/aws/package.json` ganha
`devDependencies.vitest` e `scripts.test`; `.pipeline/quality-gates.md`
ganha uma linha nova **Testes unitários**
(`pnpm --filter @eventpier/provider-aws test`); `.github/workflows/ci.yml`
(hardcoded — não lê `quality-gates.md` dinamicamente, ver
`specs/005-expor-manifesto/research.md`, Decisão 8) ganha um step novo
correspondente.

## Decisão 7 — Tempo controlado via `vi.useFakeTimers()`/`vi.setSystemTime()`, nunca `setTimeout` real nos testes

**Decisão**: testes que exercitam expiração de TTL usam
`vi.useFakeTimers()` e avançam o tempo manualmente
(`vi.setSystemTime`/`vi.advanceTimersByTime`), nunca esperando o TTL
real transcorrer com um sleep de verdade.

**Justificativa**: com TTL configurável e testado em múltiplos valores
(Decisão 3), um teste com espera real seria lento (soma de vários TTLs
reais) e potencialmente instável perto da borda do TTL (jitter de
scheduler do SO); tempo controlado é determinístico e instantâneo.

**Consequência para `/tasks`**: cada teste que usa fake timers restaura
timers reais no `afterEach` (`vi.useRealTimers()`), evitando vazar
estado de tempo mockado entre testes.

## Decisão 8 — Sem `exclude` de arquivos de teste no `tsconfig.json` de `providers/aws`

**Decisão**: `src/manifest/health-cache.test.ts` permanece dentro do
escopo normal de `include: ["src"]` — sem adicionar `exclude` para
arquivos `*.test.ts`. O gate **Build** (`tsc -p tsconfig.json`) gera
`dist/manifest/health-cache.test.js` junto do código de produção; o gate
**Docker** copia esse arquivo para dentro da imagem como consequência
(nunca importado por `index.ts`, sem efeito em runtime).

**Alternativas consideradas**:
- *Excluir `*.test.ts` do `tsconfig.json`* — considerado para manter
  `dist/`/imagem Docker "limpos" de código de teste; rejeitado porque o
  gate **Typecheck** (`tsc --noEmit`) usa o mesmo `tsconfig.json` do
  **Build** — excluir os testes ali também os tiraria da cobertura do
  Typecheck, e o Vitest (via esbuild) não faz checagem de tipo real,
  apenas remove tipos — um erro de tipo dentro de um teste ficaria sem
  nenhum gate para pegá-lo. O custo de alguns KBs de código de teste
  compilado dentro da imagem é irrelevante frente a perder cobertura de
  tipo; mesmo raciocínio de `specs/005-expor-manifesto/research.md`
  (Decisão 6) de preferir a solução mais simples até o problema que a
  complexidade resolveria (tamanho de imagem) se tornar real.

**Consequência para `/tasks`**: nenhuma mudança em
`providers/aws/tsconfig.json` além do que já existe.

## Decisões durante a implementação
