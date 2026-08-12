# Eventpier — Monorepo

Organização open-source de ferramentas para inspeção e debugging de
ambientes cloud locais. Ver `CLAUDE.md` e `docs/` para visão de
produto, arquitetura e o pipeline de desenvolvimento deste
repositório.

## Estrutura

- **`apps/`** — aplicações finais. Hoje: `apps/ui`, a UI desacoplada
  de cloud (Next.js).
- **`providers/`** — um workspace por provider de cloud. Hoje:
  `providers/aws`, que fala com o MiniStack via AWS SDK.
- **`packages/`** — pacotes compartilhados consumidos por `apps/*` e
  `providers/*`. Hoje: `packages/contracts`, o contrato
  (`ProviderManifest`, `Page<T>`, `ProviderError`,
  `CapabilityDescriptor`) que atravessa a fronteira UI↔Provider.

Gerenciado como monorepo pnpm (`pnpm-workspace.yaml`). Ver
`docs/arquitetura.md` para o racional completo da divisão em
workspaces e sua evolução futura em múltiplos repositórios.
