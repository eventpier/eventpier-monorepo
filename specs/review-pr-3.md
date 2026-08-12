# Review — PR #3: fix(pipeline): fechamento de feature dentro da PR, não pós-merge

PR: https://github.com/eventpier/eventpier-monorepo/pull/3
Branch: `chore/review-pr-close-before-merge` → `main`
Sem `<ESTADO_DIR>/<slug>.json` associado — PR de correção de pipeline,
fora do fluxo `/specify` → `/implement`. Etapas de fechamento de
feature (Etapa 7 item 1, Etapa 8) puladas conforme Pré-condição 3.

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

PR resolve o problema real (Etapa 8 antiga do `/review-pr` tentava
commitar direto em `main`, impossível desde que a branch protection
foi ativada) e move o fechamento da feature (state/roadmap/
decisions-log/docs-sync) para dentro da própria PR, revisado junto com
o código — atendendo ao pedido do usuário de que a documentação também
passe por revisão.

## Histórico do review

### Rodada 1
5 achados: 2 ALTO, 2 MÉDIO, 1 BAIXO.
1. [ALTO] Ambiguidade sobre quem commita as mudanças do `/docs-sync`
   (Etapa 5 dizia "não commite ainda", mas mandava rodar a lógica
   completa do `docs-sync`, que tem seu próprio passo de commit) —
   **corrigido**: Etapa 5 agora delega só os Passos 1-3 de
   `docs-sync.md` (montar, sem commitar).
2. [ALTO] Autoaprovação do GitHub não documentada (`event=APPROVE`
   falha quando autor = usuário autenticado, já vivenciado na PR #2)
   — **corrigido**: documentado como comportamento esperado; a
   aprovação real passou a ser a confirmação explícita no chat
   (Etapa 6); nota adicionada sobre exigir aprovação humana real via
   branch protection quando houver mais de um colaborador.
3. [MÉDIO] `current_phase: done` visível antes do merge real se
   `/pipeline-status` rodar na branch da PR — **corrigido**: nota de
   consistência de estado adicionada à Etapa 5.
4. [MÉDIO] Branch desta própria PR (`chore/review-pr-close-before-merge`)
   não segue a convenção `feature/`/`fix/` da constitution —
   **mantido sem ação retroativa** (custo de renomear de novo não
   compensa); nota para usar `fix/<nome>` na próxima correção de
   pipeline.
5. [BAIXO] Bookkeeping misturado com código revisado na mesma PR —
   **sem ação**, aceitável com um único colaborador.

### Rodada 2 (final)
Apenas os achados 4 e 5 da rodada 1 remanescem, ambos informativos.

## Recomendação de merge

- [x] Aprovar

## Submissão

Review submetida via API do GitHub (`gh api`) como evento `COMMENT` —
mesma limitação de autoaprovação já documentada na PR #2 e, agora,
formalizada no próprio `review-pr.md` por esta PR. A aprovação real
aconteceu via confirmação explícita do usuário no chat antes desta
submissão.

MCP server `github` seguiu com credenciais inválidas (`401 Bad
credentials`) durante esta sessão — todas as operações via `gh` CLI.
