# Review — PR #16: fix(ci): atualizar actions/checkout e actions/setup-node (deprecação Node 20)

```yaml
quality_gates:
  typecheck: pass
  test: pass
  lint: not_run   # sem linter configurado no projeto ainda
  build: pass
  docker: pass
review_judgment:
  security: pass
  architecture: pass
  functionality: pass
  quality: flagged   # 1 item baixo, ver abaixo
```

Evidência mecânica: run real do GitHub Actions
[32865175204](https://github.com/eventpier/eventpier-monorepo/actions/runs/32865175204),
job `validate`, todos os steps concluídos com sucesso, Annotations da
run = `[]`. Coletado via `gh run watch` + `gh api .../check-runs/.../annotations`,
não inferido.

## Resumo executivo

Bump de `actions/checkout`/`actions/setup-node` de `@v4` (runtime
`node20`, depreciado pelo GitHub) para as versões mais recentes
disponíveis (`v7.0.1`/`v7.0.0`, runtime `node24`), fixadas por SHA de
commit completo — estendendo o padrão já usado para
`docker/login-action`/`docker/build-push-action` (achado da PR #6).
`scripts/validate-ci-workflow-shape.mjs` estendido para impedir
regressão futura desse mesmo pin. Diff cirúrgico nos workflows: só as
3 linhas `uses:` afetadas mudam, nenhum outro comportamento. Evidência
real, não apenas teórica: duas runs completas desta PR, ambas com
Annotations vazias — o aviso "Node.js 20 is deprecated" desapareceu de
fato. Boa prática observada: TDD real em configuração de CI (RED
confirmado em T002 antes da correção; regressão do gate comprovada em
T006, revertendo o pin e restaurando antes de abrir a PR).

## Comentários por arquivo

#### Descrição da PR (não é um arquivo do diff)

**[BAIXO] Checklist da descrição desatualizado**

O item "Confirmar nas Annotations... T007" tinha ficado `[ ]` na
descrição original do PR, mas a evidência já existia no momento do
review (2 runs, Annotations vazias, documentada em `research.md`/
`quickstart.md` desta spec).

**Correção aplicada:** item marcado como concluído na descrição do PR,
com o link da run como evidência, antes da submissão deste review.

## Diagnóstico geral

| # | Arquivo | Severidade | Título |
|---|---------|------------|--------|
| 1 | Descrição da PR | Baixo | Checklist desatualizado (T007 já tinha evidência) — corrigido |

## Recomendação de merge

- [ ] Bloquear merge
- [x] Aprovar com ressalvas (apenas 1 item baixo, não bloqueante, já corrigido)
- [ ] Aprovar

## Fechamento da feature (incluído nesta mesma PR)

1. `.pipeline/state/atualizar-actions-ci.json`: `current_phase` →
   `done`, `phases_completed` completo, `phases_pending: []`.
2. `.pipeline/roadmap.md`: linha 014 → ✅ Concluído.
3. `.pipeline/decisions-log.md`: nova entrada `014-atualizar-actions-ci`.
4. `docs/features/ci.md`: nova linha em "Specs Relacionadas" (🐛 Bug
   fix) + novo bullet em "Comportamentos-chave" documentando o pin por
   SHA estendido às 4 actions dos dois workflows.

Aprovação obtida via confirmação explícita no chat (autoaprovação de
PR bloqueada pelo GitHub — projeto com um único colaborador no
momento). Review submetido ao GitHub com `event: COMMENT` (não
`APPROVE`, pelo mesmo motivo).
