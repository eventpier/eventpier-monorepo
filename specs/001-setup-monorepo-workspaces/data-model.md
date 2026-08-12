# Data Model — Setup do Monorepo (001)

Esta spec não tem dados de domínio (nenhuma capability, provider ou UI
real ainda). A "entidade" aqui é estrutural: o **Workspace** em si e
suas relações de dependência permitidas.

## Entidade: Workspace

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | Nome do pacote npm, sempre `@eventpier/<slug>` (ver research.md, Decisão 2) |
| `path` | string | Caminho relativo à raiz do monorepo (ex.: `apps/ui`) |
| `kind` | enum: `app` \| `provider` \| `package` | Categoria — determina a pasta raiz (`apps/`, `providers/`, `packages/`) |
| `private` | boolean | `true` para `app` e `provider` (nunca publicados no npm — viram imagem Docker); `packages/contracts` também `private: true` no MVP (só passa a ser publicável no Estado 2, ver `arquitetura.md` seção 2) |
| `version` | string (semver) | Começa em `0.1.0` para todo workspace criado por esta spec |

## Instâncias criadas por esta spec

| `name` | `path` | `kind` |
|---|---|---|
| `@eventpier/ui` | `apps/ui` | `app` |
| `@eventpier/provider-aws` | `providers/aws` | `provider` |
| `@eventpier/contracts` | `packages/contracts` | `package` |

Nenhuma outra instância (não criar `providers/azure`, `providers/gcp`
nem nenhum outro pacote — fora do escopo desta spec e do MVP, ver
`docs/product.md` "Fora do MVP").

## Relacionamentos e invariantes

- **Dependência permitida**: `app` e `provider` podem depender de
  `package` (`@eventpier/contracts`). Nenhuma outra direção é
  permitida.
- **Proibido**: `app` depender do código-fonte interno de `provider`
  (constitution, princípio 1 — a UI conhece capabilities, não
  clouds/providers diretamente).
- **Proibido**: `package` depender de `app` ou `provider` (o contrato
  é a base; nada pode depender "para cima").
- Nesta spec, como nenhum workspace tem código real ainda, nenhuma
  dependência de fato é declarada em nenhum `package.json` além da
  entrada de `devDependencies` compartilhada na raiz (TypeScript,
  etc.) — as invariantes acima existem para orientar `/tasks` e specs
  futuras, não para serem verificadas nesta spec (não há o que
  verificar ainda).
