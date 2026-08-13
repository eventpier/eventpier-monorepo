# Review — PR #5: Docker Compose do MVP (spec 003)

```yaml
quality_gates:
  typecheck: pass
  test: pass
  lint: not_run
  build: pass
review_judgment:
  security: pass
  architecture: pass
  functionality: pass
  quality: flagged
```

## Resumo executivo

Orquestra `eventpier-ui`/`eventpier-aws`/`ministack` via Docker Compose
com build local, rede interna restrita e overrides de ambiente —
implementação testada empiricamente de ponta a ponta (não só lida),
incluindo os três serviços subindo juntos e saudáveis, isolamento de
rede confirmado por curl real, e um script novo
(`validate-compose-shape.mjs`) que passa a proteger mecanicamente a
invariante "eventpier-aws nunca publica porta" (constitution §11).
Dois achados de ambiente (porta 4566 ocupada por um processo
pré-existente, `userland-proxy=false` bloqueando
`host.docker.internal`) foram investigados a fundo e documentados como
limitação do host, não do código.

## Comentários por arquivo

### `apps/ui/Dockerfile`, `providers/aws/Dockerfile`
BAIXO **Estágio `runtime` carrega pnpm/corepack sem necessidade**
> Linha: 3 (`RUN corepack enable && corepack prepare pnpm@11.10.0 --activate`)

`runtime` é `FROM base`, e `base` já ativa o pnpm — mas o `CMD` final é
só `node dist/index.js`; pnpm/corepack nunca são invocados na imagem
final, só a infla.

**Sugestão:** mover a ativação do pnpm para o estágio `deps` (que dela
precisa) e deixar `base` mínimo:
```dockerfile
FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
...
```
`runtime` continua `FROM base`, agora sem carregar pnpm.

### `.gitignore`
BAIXO **Mudança não relacionada ao escopo da spec entrou em um commit da feature**
> Linha: 3 (`+.claude/settings.json`)

O commit `81b3e46` (Dockerfiles) inclui essa linha — rastreei a
origem: uma edição pré-existente no working tree (não parte do escopo
desta spec) foi varrida para dentro do commit porque `git commit` sem
pathspec commita todo o índice, não só o que um `git add` anterior
tocou. Conteúdo benigno (protege um arquivo de settings local de ser
versionado), mas é mistura de escopo não intencional.

**Sugestão:** nenhuma ação necessária no código — nota de higiene para
commits futuros: conferir `git diff --cached --name-only` antes de
cada commit quando o working tree pode ter mudanças externas
concorrentes.

---

## Diagnóstico geral

| # | Arquivo | Severidade | Título |
|---|---------|------------|--------|
| 1 | `apps/ui/Dockerfile`, `providers/aws/Dockerfile` | Baixo | pnpm/corepack desnecessário no estágio `runtime` |
| 2 | `.gitignore` | Baixo | Mudança de escopo não relacionado entrou no commit |

## Recomendação de merge

- [x] **Aprovar com ressalvas** (apenas baixos, nenhum bloqueante)

## Fechamento da feature

Incluído nesta mesma PR (commit `docs(configurar-docker-compose): mark
feature as complete`):
- `.pipeline/state/configurar-docker-compose.json` → `current_phase: done`
- `.pipeline/roadmap.md` → spec 003 marcada ✅ Concluído
- `.pipeline/decisions-log.md` → nova entrada com as decisões não
  previstas no plano original
- `docs/features/docker-compose.md` (novo) → documentação viva do
  domínio de orquestração

## Aprovação

Revisado no chat e aprovado explicitamente pelo usuário (Edeno
Scherer) em 2026-08-13 — `event=COMMENT` no GitHub (não `APPROVE`,
autor da PR é o mesmo usuário autenticado; a aprovação real é esta
confirmação no chat, conforme regra do pipeline enquanto o repositório
tiver um único colaborador).
