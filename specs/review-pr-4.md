# Review — PR #4: feat(contracts): definir contrato compartilhado

PR: https://github.com/eventpier/eventpier-monorepo/pull/4
Spec: `specs/002-definir-contrato-compartilhado/`

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
  quality: pass
```

## Resumo executivo

PR implementa o contrato mínimo entre UI e providers
(`ProviderManifest`, `Page<T>`, `ProviderError`, `CapabilityDescriptor`)
em `packages/contracts`, seguindo `docs/arquitetura.md` §3 sem desvio
de forma, com union types derivados de arrays `as const` (fonte única
compile-time + runtime), TDD real via type-checking + script de
constantes, e empacotamento correto (`main`/`types`/`exports` →
`dist/`). Corrigiu, ainda durante a implementação, um gap real do
TypeScript 7 (`rootDir` ausente quebrando o layout do `dist/`),
registrado em `research.md` e no decisions-log. Nenhum problema de
segurança, funcionalidade ou arquitetura.

## Histórico do review

Primeira rodada (antes da submissão ao GitHub) identificou 3 achados
de qualidade, todos baixa severidade — todos corrigidos na própria
sessão de review, antes de submeter, então o diff final da PR já
reflete o estado corrigido:

1. **`packages/contracts/src/contract-shape.check.ts`** — `void`
   statements desnecessários com comentário enganoso (referenciava
   `noUnusedLocals`, que não está configurado em
   `tsconfig.base.json`). Removidos.
2. **`packages/contracts/src/contract-shape.check.ts`** — fixture
   interna de verificação de forma (não reexportada por `index.ts`)
   vazava para `dist/contract-shape.check.{js,d.ts}` junto com a API
   pública. Corrigido com `packages/contracts/tsconfig.build.json`
   (exclui esse arquivo da emissão do `build`, mantendo-o coberto pelo
   gate Typecheck via `tsconfig.json` original).
3. **`.pipeline/state/definir-contrato-compartilhado.json`** —
   `last_updated` ficou fixo em `2026-08-12T00:00:00Z` (placeholder)
   nas 4 transições de fase, em vez do horário real. Corrigido para o
   horário real na transição final; sinalizado para specs futuras.

Ambas as decisões de correção (2 e a do `rootDir` encontrada durante o
`/implement`) foram registradas em
`specs/002-definir-contrato-compartilhado/research.md` →
"Decisões durante a implementação" e em `.pipeline/decisions-log.md`.

## Recomendação de merge

**Aprovar** — nenhum problema pendente após as correções. Review
submetido ao GitHub como `COMMENT` (não `APPROVE`): o autor da PR é o
mesmo usuário autenticado no GitHub, que bloqueia autoaprovação
(`422 Review Can not approve your own pull request`); a aprovação real
ocorreu no chat, confirmada explicitamente pelo usuário antes da
submissão.

## Fechamento da feature

Incluído na própria PR (commit `docs(definir-contrato-compartilhado):
mark feature as complete`):
- `.pipeline/state/definir-contrato-compartilhado.json`:
  `current_phase` → `done`.
- `.pipeline/roadmap.md`: linha 002 → ✅ Concluído.
- `.pipeline/decisions-log.md`: nova entrada
  `002-definir-contrato-compartilhado`.
- `docs/features/contracts.md` (novo): doc de domínio do contrato
  compartilhado.
- `docs/features/monorepo.md`: correção incidental de uma limitação
  conhecida que ficou desatualizada por esta mesma PR (gate Build
  agora existe para `packages/contracts`).

## Observação (fora do escopo desta PR)

`.gitignore` ganhou uma linha (`.claude/settings.json`) e
`.claude/hooks/`/`.claude/settings.json` continuam não rastreados no
working tree — tooling local de permissões do Claude Code, não
relacionado a esta spec. Deixados de fora deste PR deliberadamente.
