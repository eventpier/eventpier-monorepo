# Data Model — Endpoint de Manifesto (005)

`ProviderManifest` e `ProviderError` já estão definidos, com sua forma
genérica completa, em
`specs/002-definir-contrato-compartilhado/data-model.md` — este
documento **não** os redefine. Aqui ficam apenas: (1) os valores
concretos que `providers/aws` produz nesta spec, fixados pelas
Clarificações de `spec.md`; e (2) as duas instâncias de `ProviderError`
que este endpoint de fato emite.

## Instância: `ProviderManifest` produzido por `providers/aws` nesta spec

```json
{
  "contractVersion": "1.0.0",
  "provider": { "id": "aws", "name": "AWS" },
  "environment": { "id": "ministack", "managed": true },
  "version": "0.2.0",
  "capabilities": []
}
```

| Campo | Origem do valor nesta spec | Fixo ou variável? |
|---|---|---|
| `contractVersion` | `CONTRACT_VERSION`, importado de `@eventpier/contracts` em runtime | Variável — segue o pacote; nunca duplicado como literal em `providers/aws` (research.md, Decisão 2) |
| `provider.id` / `provider.name` | Literal `"aws"` / `"AWS"` — este provider só representa AWS | Fixo nesta spec e nas seguintes (não há motivo para variar) |
| `environment.id` | Literal `"ministack"` | Fixo **nesta spec**; passa a vir de `EnvironmentConfig` na spec 007 (research.md, Decisão 5) |
| `environment.endpoint` | Ausente (campo opcional do contrato) | Fixo nesta spec — nenhum endpoint customizado ainda |
| `environment.managed` | Literal `true` | Fixo **nesta spec**; passa a ser configurável na spec 007 |
| `version` | Lido de `providers/aws/package.json` em runtime | Variável — segue o `package.json` do provider (research.md, Decisão 3) |
| `capabilities` | Literal `[]` | Fixo **nesta spec**; ganha itens reais a partir da spec 008 (Storage) |

**Invariante desta spec**: `capabilities` é sempre um array vazio.
Nenhuma task desta spec deve inserir um `CapabilityDescriptor` com
`id: "storage"` (ou qualquer outro) nesse array, mesmo com status
`"unavailable"` — ver Clarificação registrada em `spec.md` e Decisão 4
de `research.md`.

## Instâncias: `ProviderError` emitidas por este endpoint

| Cenário | HTTP status | `code` | `message` (exemplo) | `capability` | `retryable` |
|---|---|---|---|---|---|
| Método diferente de `GET` em `/api/v1/manifest` | 405 | `"METHOD_NOT_ALLOWED"` | `"Método POST não suportado em /api/v1/manifest. Use GET."` | ausente | `false` |
| Path desconhecido (qualquer path ≠ `/api/v1/manifest`) | 404 | `"NOT_FOUND"` | `"Recurso não encontrado: /qualquer-coisa"` | ausente | `false` |

**Invariante**: `message` só interpola o `method` e o `path` já
recebidos na própria requisição — nunca variável de ambiente, nunca
detalhe de configuração interna, nunca stack trace (sinal deixado por
`specs/002-definir-contrato-compartilhado/plan.md`, seção de
Segurança, para quando `ProviderError` passasse a ser produzido de
verdade — é agora). `capability` fica sempre ausente nesta spec: os
dois erros são de roteamento HTTP genérico, não atribuíveis a uma
capability específica.

**`code` como conjunto fechado nesta spec**: `"METHOD_NOT_ALLOWED"` e
`"NOT_FOUND"` são os dois únicos valores de `ProviderError.code`
produzidos por `providers/aws` até este ponto do roadmap. Novos
códigos (ex.: erros específicos de Storage na spec 008) devem ser
registrados da mesma forma, num data-model.md próprio — `code`
continua sendo `string` livre no tipo (não um union fechado, ver
`specs/002.../data-model.md`), então essa disciplina é de convenção
documentada, não imposta pelo compilador.

## Fora do escopo desta entidade/modelo

- `CapabilityDescriptor` populado com dados reais — permanece só como
  tipo (spec 002); nenhuma instância real nesta spec (`capabilities`
  é sempre `[]`).
- `EnvironmentConfig` como entidade configurável (endpoint
  customizado, `managed: false`) — spec 007.
- Qualquer entidade de domínio de Storage (`Bucket`, `StorageObject`)
  — spec 008.
