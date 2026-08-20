# Data Model — Cache de Health-check por Capability (006)

Entidades de dado puras (sem persistência, sem banco), todas **internas
ao provider** — diferente de `specs/002-.../data-model.md` (contrato
que atravessa a fronteira UI ↔ Provider), nada aqui é serializado numa
resposta HTTP nesta spec (ver `spec.md`, Requisito Funcional 9). `id`
de capability nunca aparece nestas entidades (Decisão 1 de
`research.md`) — quem associa um cache a uma capability é o código
externo que cria a instância, não o módulo em si.

## Entidade: `CachedHealth`

Resultado cacheado, retornado por `getStatus()`. Formato já previsto em
`docs/arquitetura.md` §4.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `status` | `"available"` \| `"unavailable"` | sim | Nunca `"degraded"` nesta spec — `degraded` é um julgamento de negócio da capability (ex.: Storage acessível mas lento), não algo que o mecanismo de cache genérico infere sozinho |
| `reason` | `HealthFailureCode` (de `@eventpier/contracts`) | não | Presente quando `status: "unavailable"`; ausente quando `status: "available"` |
| `checkedAt` | number (epoch ms, `Date.now()`) | sim | Momento em que a verificação real que originou este valor foi concluída — não o momento da leitura do cache |

**Invariante**: `status: "available"` → `reason` ausente;
`status: "unavailable"` → `reason` presente (mesma convenção de
`CapabilityDescriptor` em `specs/002-.../data-model.md`, aplicada aqui
ao tipo interno).

## Entidade: `HealthCheckResult`

Formato que a verificação real de uma capability deve resolver —
entrada do mecanismo de cache, não sua saída (`CachedHealth` adiciona
`checkedAt`, que quem implementa a capability não fornece).

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `status` | `"available"` \| `"unavailable"` | sim | Resultado da verificação real, antes do cache anexar `checkedAt` |
| `reason` | `HealthFailureCode` | somente quando `status: "unavailable"` | Motivo classificado pela própria capability |

## Tipo função: `HealthCheckFn`

```text
HealthCheckFn = () => Promise<HealthCheckResult>
```

Fornecida por quem cria uma instância de cache (spec 008+, por
capability). Pode rejeitar/lançar em caso de erro não esperado — ver
Decisão 2 de `research.md` para como isso é tratado (nunca propagado
para quem lê o cache).

## Entidade: `HealthCache` (instância)

Retornada por `createHealthCache(check, options?)`.

| Membro | Tipo | Descrição |
|---|---|---|
| `getStatus` | `() => Promise<CachedHealth>` | Retorna o valor cacheado se dentro do TTL; senão dispara nova verificação real e atualiza o cache antes de retornar |
| `invalidate` | `() => void` | Limpa o cache desta instância, forçando a próxima `getStatus()` a rodar `check()` de novo, independente do TTL restante (Decisão 5 de `research.md`) |

## Parâmetros de criação: `createHealthCache(check, options?)`

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `check` | `HealthCheckFn` | sim | Verificação real desta capability |
| `options.ttlMs` | number | não | TTL explícito, sobrepõe `HEALTH_CHECK_TTL_MS`; usado principalmente pelos testes (Decisão 3 de `research.md`) |

**Resolução de TTL (`resolveTtlMs`)**, em ordem de prioridade:
1. `options.ttlMs`, se fornecido.
2. `process.env.HEALTH_CHECK_TTL_MS`, se um inteiro positivo válido.
3. `4000` (default, dentro do intervalo 3-5s do princípio 6 da
   constitution — ver Decisão 3 de `research.md`).

## Relacionamentos

```text
HealthCache (instância)
├── criada com: HealthCheckFn (fornecida externamente)
└── getStatus() → CachedHealth
    └── reason?: HealthFailureCode (referência a HEALTH_FAILURE_CODES,
        @eventpier/contracts — reaproveitado, nunca redefinido aqui)

Cada capability futura (spec 008+) possui sua própria instância de
HealthCache — nenhuma relação entre instâncias (Decisão 1 de
research.md).
```

## Fora do escopo desta entidade/modelo

- `CapabilityDescriptor` (contrato externo, `packages/contracts`) não é
  alterado nem produzido a partir de `CachedHealth` nesta spec — essa
  tradução (`CachedHealth` → `CapabilityDescriptor` no manifesto) é
  trabalho da spec 008, quando a primeira capability real existir.
- `status: "degraded"` não é um valor possível de `CachedHealth` nesta
  spec — ver nota na entidade acima.
- Nenhum registro/índice de capabilities conhecidas — ver Decisão 1 de
  `research.md`.
