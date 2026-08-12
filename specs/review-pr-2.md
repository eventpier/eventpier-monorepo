# Review — PR #2: feat(monorepo): setup dos workspaces (ui, provider-aws, contracts)

PR: https://github.com/eventpier/eventpier-monorepo/pull/2
Substitui a PR #1 (fechada automaticamente pelo GitHub ao renomear a
branch `001-setup-monorepo-workspaces` →
`feature/001-setup-monorepo-workspaces`).

```yaml
quality_gates:
  typecheck: pass
  test: pass
  lint: not_run
  build: not_run
review_judgment:
  security: pass
  architecture: pass
  functionality: pass
  quality: flagged
```

## Resumo executivo

PR cria o skeleton de monorepo pnpm (`apps/ui`, `providers/aws`,
`packages/contracts`) seguindo `docs/arquitetura.md` Estado 1, com
trilha de decisão bem documentada (`research.md`), scripts de
validação estrutural com ciclo RED→GREEN real, e quality gates
preenchidos pragmaticamente para o estágio atual do projeto.

## Histórico do review

### Rodada 1 (PR #1, fechada pelo rename)
5 achados: 2 MÉDIO, 3 BAIXO.
1. [MÉDIO] Convenção de branch em conflito com `ARQUIVO_REGRAS`
   (`.claude/commands/specify.md` criava `<NNN>-<slug>` sem o prefixo
   `feature/` exigido pela constitution) — **corrigido**: `/specify`
   agora cria `feature/<NNN>-<slug>`; branch desta feature renomeada
   via API do GitHub.
2. [MÉDIO] `tsconfig.base.json`: `module: "ESNext"` sem `"type":
   "module"` em nenhum workspace — risco real de quebra em runtime
   para `providers/aws` (Node.js puro, sem bundler) — **corrigido**:
   `"type": "module"` adicionado aos 3 `package.json`, validado por
   `validate-workspace-manifests.mjs`.
3. [BAIXO] `scripts/validate-workspace-dependencies.mjs` não cobria
   `peerDependencies`/`optionalDependencies` — **corrigido**.
4. [BAIXO] `scripts/validate-workspace-manifests.mjs` checa
   `pnpm-workspace.yaml` por substring, não parse real — **mantido**,
   limitação aceita (ver comentário inline na PR #2).
5. [BAIXO] PR misturava fix de pipeline com entrega da feature —
   **sem ação**, nota de processo para o futuro.

### Rodada 2 (PR #2, final)
Apenas os 2 achados BAIXO remanescentes (4 e 5 da rodada 1), ambos
informativos, sem ação necessária.

## Diagnóstico geral (final)

| # | Arquivo | Severidade | Título |
|---|---------|------------|--------|
| 1 | `scripts/validate-workspace-manifests.mjs` | BAIXO | Checagem de `pnpm-workspace.yaml` por substring, não parse real |
| 2 | PR geral | BAIXO | Fix de pipeline bundlado com a feature (padrão a considerar daqui pra frente) |

## Recomendação de merge

- [x] Aprovar

## Submissão

Review submetida via API do GitHub (`gh api`) como evento `COMMENT`
— o token do `gh` CLI pertence ao mesmo usuário autor da PR
(`edenoscherer`), e o GitHub bloqueia autoaprovação
(`Review Can not approve your own pull request`, HTTP 422). O
conteúdo e a recomendação são de aprovação; só o campo `state` da
review no GitHub ficou como `COMMENTED` em vez de `APPROVED` por essa
restrição da plataforma, não por ressalva do revisor.

Nota adicional: o MCP server `github` estava com credenciais
inválidas (`401 Bad credentials`) durante toda esta sessão de review
— todas as operações de leitura e escrita de PR foram feitas via `gh`
CLI (que tinha auth válida) em vez das tools MCP `pull_request_read` /
`pull_request_review_write`.
