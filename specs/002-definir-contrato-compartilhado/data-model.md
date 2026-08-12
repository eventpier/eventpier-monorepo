# Data Model — Contrato Compartilhado (002)

Entidades de dado puras (sem persistência, sem banco) — o "modelo" aqui
é a forma exata que atravessa a fronteira UI ↔ Provider, conforme
`docs/arquitetura.md` §3, mais as constantes de runtime que a
Decisão 1 de `research.md` introduz como fonte única para os union
types.

## Entidade: `Provider`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | sim | Identificador estável do provider (ex.: `"aws"`) |
| `name` | string | sim | Nome legível (ex.: `"AWS"`) |

## Entidade: `Environment`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | sim | Identificador do environment ativo (ex.: `"ministack"`) |
| `endpoint` | string | não | Endpoint customizado; ausente = usa o endpoint do serviço gerenciado pelo compose (ver `arquitetura.md` §5) |
| `managed` | boolean | sim | `true` = Eventpier gerencia o container; `false` = externo, já em execução |

## Constantes / union types derivados (Decisão 1 de `research.md`)

| Constante runtime | Tipo derivado | Valores |
|---|---|---|
| `CAPABILITIES` | `Capability` | `"storage"`, `"queue"`, `"topic"`, `"secret"`, `"logs"` |
| `CAPABILITY_STATUSES` | `CapabilityStatus` | `"available"`, `"unavailable"`, `"degraded"` |
| `HEALTH_FAILURE_CODES` | `HealthFailureCode` | `"CONNECTION_TIMEOUT"`, `"CONNECTION_REFUSED"`, `"AUTH_FAILED"`, `"UNKNOWN"` |

O tipo é sempre `(typeof ARRAY)[number]` — nunca uma união declarada em
paralelo ao array. Ver `contracts/contract-shape.md` para a assinatura
exata.

## Entidade: `CapabilityDescriptor`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `Capability` | sim | Qual capability está sendo descrita |
| `status` | `CapabilityStatus` | sim | Nunca booleano (constitution, princípio 5) |
| `reason` | `HealthFailureCode` | não | Motivo da falha/limitação |

**Invariante (convenção, não imposta pelo tipo — ver Decisão 4 de
`research.md`)**:
- `status: "available"` → `reason` **deve** estar ausente.
- `status: "unavailable"` → `reason` **deve** estar presente.
- `status: "degraded"` → `reason` **pode** estar presente (limitação
  parcial identificável) ou ausente (degradação sem causa enumerável
  ainda).

Esta spec não impõe a invariante via tipo (decisão consciente); specs
que produzem `CapabilityDescriptor` de verdade (006, health-check)
devem respeitá-la por convenção, e `contract-shape.check.ts` (ver
`research.md`, Decisão 7) documenta exemplos válidos e inválidos em
comentário para reforçar a regra no ponto de leitura mais provável.

## Entidade: `ProviderManifest`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `contractVersion` | string (semver) | sim | Versão do contrato em si — ver `CONTRACT_VERSION` |
| `provider` | `Provider` | sim | |
| `environment` | `Environment` | sim | |
| `version` | string | sim | Versão do *provider* (não do contrato) |
| `capabilities` | `CapabilityDescriptor[]` | sim | Pode ser array vazio (provider sem nenhuma capability implementada ainda é um estado válido) |

## Entidade genérica: `Page<T>`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `items` | `T[]` | sim | Pode ser vazio (página vazia é um resultado válido, não erro) |
| `nextCursor` | string | não | Opaco para quem consome — nunca interpretado ou parseado fora do provider que o emitiu |

**Invariante**: `nextCursor` ausente significa "não há próxima
página" — nenhum outro valor (string vazia, `null` explícito) deve ser
usado com esse significado, para manter um único jeito de expressar
"fim da paginação".

## Entidade: `ProviderError`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `code` | string | sim | Identificador estável (ex.: `"RESOURCE_NOT_FOUND"`) — não é o `HealthFailureCode` do manifesto, é um código de erro de operação |
| `message` | string | sim | Mensagem legível, nunca a única forma de identificar o erro programaticamente (`code` é o campo estável) |
| `capability` | `Capability` | não | Presente quando o erro é atribuível a uma capability específica |
| `retryable` | boolean | sim | Nunca omitido — quem consome precisa decidir "tentar de novo?" sem inferir por heurística de `code`/`message` |

## Relacionamentos

```text
ProviderManifest
├── provider: Provider (1:1)
├── environment: Environment (1:1)
└── capabilities: CapabilityDescriptor[] (1:N)
    └── id: Capability (referência a CAPABILITIES)
    └── reason?: HealthFailureCode (referência a HEALTH_FAILURE_CODES)

ProviderError
└── capability?: Capability (referência a CAPABILITIES, opcional)

Page<T> — genérico, sem relação fixa; T é definido por quem usa
(ex.: Page<StorageObject> nas specs de Storage, fora do escopo aqui)
```

## Fora do escopo desta entidade/modelo

- Nenhuma entidade de domínio real (`Bucket`, `StorageObject`, etc.) é
  definida aqui — essas nascem junto das capabilities que as usam
  (spec 008+), instanciando `Page<T>` com o `T` concreto na hora.
- Nenhuma validação de runtime além das constantes (`CAPABILITIES` etc.)
  — ver Decisão 1 de `research.md`.
