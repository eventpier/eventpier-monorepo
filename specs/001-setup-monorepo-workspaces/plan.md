# Plan — Setup do Monorepo (001)

## Contexto técnico

Feature puramente estrutural: cria o skeleton de workspaces do
monorepo (Estado 1 de `docs/arquitetura.md`), sem nenhuma lógica de
negócio, endpoint ou componente de UI. Detalhes de decisão técnica em
`research.md`; modelo estrutural em `data-model.md`; forma exigida de
cada `package.json`/`tsconfig.json` em `contracts/workspace-manifest.md`;
passos de validação manual em `quickstart.md`.

## Conformidade com `ARQUIVO_REGRAS` / `ARQUIVO_ARQUITETURA`

| Princípio/seção | Como este plano respeita |
|---|---|
| Constitution §1 (UI conhece capabilities, não clouds) | `apps/ui` não ganha nenhuma dependência de SDK de cloud nesta spec — nem teria como, já que não há código real ainda. `data-model.md` proíbe explicitamente `app` depender do código-fonte interno de `provider`. |
| Constitution §4 (contrato evolui de forma aditiva) | Não aplicável ainda — nenhum conteúdo do contrato é criado nesta spec (ver "Fora do escopo" em `spec.md`). |
| Constitution §12 (abstração só após necessidade comprovada) | Guiou a Decisão 1 (rejeitar Turborepo/Nx) e Decisão 4 (rejeitar TS project references) em `research.md` — nenhuma ferramenta de orquestração é introduzida sem necessidade comprovada por 3 workspaces sem código real. |
| Constitution §13 (contrato é artefato próprio, versionado desde o primeiro commit) | `packages/contracts` criado com `version: 0.1.0` (não `0.0.0`) desde esta spec — ver `research.md` Decisão 3 e `contracts/workspace-manifest.md`. |
| Arquitetura, Estado 1 (§2) | Estrutura `apps/ui`, `providers/aws`, `packages/contracts` replicada exatamente como descrita, incluindo nomes de pasta. |
| Arquitetura §9 (migração mecânica Estado 1→2) | Convenção de nomes `@eventpier/<slug>` (Decisão 2) já antecipa a extração futura sem exigir rename em massa. |

Nenhum conflito entre spec/plano e `ARQUIVO_REGRAS`/`ARQUIVO_ARQUITETURA`
foi identificado.

## Segurança e observabilidade

- **Sem superfície de ataque nova**: esta spec não expõe nenhuma porta,
  endpoint, variável de ambiente sensível ou dependência de rede — é
  só estrutura de arquivos em disco. Os pontos de atenção de segurança
  da constitution (§10 sem autenticação local, §11 rede interna
  restrita) só passam a valer a partir da spec 003 (Docker Compose).
- **Dependências**: o único pacote npm real adicionado nesta spec é
  `typescript` (dev dependency da raiz). `/tasks`/`/implement` devem
  fixar uma versão específica (não `latest`) para build reprodutível.
- **Logging/segredos**: não aplicável — nenhum código executa nesta
  spec além de `tsc --noEmit`.
- **Observabilidade**: não aplicável ainda — não há health-check nem
  capability nesta spec (isso começa na Fase 2 do roadmap).

## Artefatos desta fase

- [research.md](./research.md) — decisões técnicas e alternativas rejeitadas
- [data-model.md](./data-model.md) — entidade Workspace e invariantes de dependência
- [contracts/workspace-manifest.md](./contracts/workspace-manifest.md) — forma exigida de cada `package.json`/`tsconfig.json`
- [quickstart.md](./quickstart.md) — validação manual passo a passo

## Observação para `/tasks`

As tasks geradas devem, na ordem: (1) criar `pnpm-workspace.yaml` e
`tsconfig.base.json` na raiz, (2) criar cada um dos três workspaces
seguindo exatamente `contracts/workspace-manifest.md`, (3) validar com
os passos de `quickstart.md`. Nenhuma task desta spec deve tocar em
Docker Compose (spec 003), CI (spec 004) ou conteúdo do contrato
(spec 002).
