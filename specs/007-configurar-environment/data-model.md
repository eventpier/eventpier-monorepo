# Data Model — EnvironmentConfig (`endpoint` / `managed`) (007)

## Entidade: `Environment` (contrato externo, reutilizado)

Já definida em `packages/contracts/src/manifest.ts` (spec 002) e
usada, sem alteração, como tipo de retorno desta feature. Documentada
aqui apenas para referência — **não** é redefinida nem estendida por
esta spec.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `string` | sim | Fixo em `"ministack"` nesta spec — nenhuma variável de ambiente controla `id` (único environment suportado no MVP, `docs/product.md`) |
| `endpoint` | `string` \| `undefined` | tecnicamente opcional no tipo, **sempre presente na prática após esta spec** | Endpoint efetivo em uso pelo provider — nunca omitido, mesmo no default (Clarificação de `spec.md`, Decisão 5 de `research.md`) |
| `managed` | `boolean` | sim | `true` = MiniStack gerenciado pelo Compose; `false` = instância externa já em execução |

## Função: `resolveEnvironmentConfig(): Environment`

Lê `process.env.MINISTACK_ENDPOINT` e `process.env.MINISTACK_MANAGED`,
valida e retorna um `Environment` completo, ou lança
`InvalidEnvironmentConfigError`. Chamada uma única vez, no bootstrap de
`index.ts` (Decisão 2 de `research.md`).

### Regras de resolução

| Entrada (`MINISTACK_MANAGED`, `MINISTACK_ENDPOINT`) | Resultado |
|---|---|
| ausente/vazio, ausente/vazio | `{ id: "ministack", endpoint: "http://ministack:4566", managed: true }` |
| ausente/vazio, `"<custom>"` | `{ id: "ministack", endpoint: "<custom>", managed: true }` |
| `"true"` (qualquer capitalização), ausente/vazio | `{ id: "ministack", endpoint: "http://ministack:4566", managed: true }` |
| `"true"`, `"<custom>"` | `{ id: "ministack", endpoint: "<custom>", managed: true }` |
| `"false"`, `"<custom>"` | `{ id: "ministack", endpoint: "<custom>", managed: false }` |
| `"false"`, ausente/vazio | lança `InvalidEnvironmentConfigError` (RF5 de `spec.md`) |
| valor não reconhecível (≠ `"true"`/`"false"`, case-insensitive), qualquer `MINISTACK_ENDPOINT` | lança `InvalidEnvironmentConfigError` (RF6 de `spec.md`) |

### Invariante

Toda chamada a `resolveEnvironmentConfig()` que **não** lança retorna
um `Environment` com `endpoint` sempre definido — nunca `undefined` no
valor de retorno, apesar do tipo `Environment.endpoint` permanecer
opcional no contrato (o contrato permite ausência para outros
consumidores hipotéticos do tipo; esta implementação específica opta
por sempre preencher, ver Decisão 5 de `research.md`).

## Entidade: `InvalidEnvironmentConfigError`

Classe de erro interna ao provider (não faz parte de
`packages/contracts` — é um detalhe de bootstrap, nunca serializado
numa resposta HTTP; distinto de `ProviderError`, que é o formato de
erro do contrato para respostas de API).

| Membro | Tipo | Descrição |
|---|---|---|
| `message` | `string` | Mensagem legível explicando exatamente qual variável está ausente/inválida e por quê |

## Relacionamentos

```text
index.ts (bootstrap, executa uma única vez)
├── resolveEnvironmentConfig()
│   ├── sucesso → Environment
│   │   └── repassado a cada chamada de buildManifest(environment)
│   │       dentro do handler GET /api/v1/manifest (spec 005)
│   └── falha → InvalidEnvironmentConfigError
│       └── capturado em index.ts → stderr + process.exit(1)
│           (server.listen nunca é chamado)
```

## Fora do escopo desta entidade/modelo

- Nenhuma mudança em `Environment` (`packages/contracts`) — o tipo já
  era suficiente.
- Nenhuma verificação de conectividade real contra o `endpoint`
  resolvido — isso é papel do mecanismo de health-check (specs
  006/008), que opera sobre uma capability, não sobre a declaração de
  `EnvironmentConfig` em si.
- Nenhum campo novo além de `id`/`endpoint`/`managed` — sem
  `region`/`credentials`/etc., que só fariam sentido para suporte a
  cloud real (fora do MVP, `docs/product.md`).
