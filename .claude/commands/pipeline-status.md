# Comando: Pipeline Status

Reporta o estado de todas as features em andamento. Comando
**somente leitura** — não modifica nada, não avança nenhuma fase.

## Configuração

Leia `.pipeline/config.md` para obter `ESTADO_DIR`, `SPECS_DIR` e
`ARQUIVO_ROADMAP`.

## Execução

1. Liste todos os arquivos em `<ESTADO_DIR>/*.json`.
2. Para cada um, leia `current_phase`, `phases_completed`,
   `task_progress` e `last_updated`.
3. Classifique:
   - **Concluídas**: `current_phase == "done"`
   - **Em exceção**: `current_phase` em `blocked`/`cancelled`/`failed`
     — liste **separadamente** das demais, mostrando `status_detail`
   - **Em andamento**: tem `phases_completed` não vazio, não está em
     `done` nem em exceção
   - **Recém-iniciadas**: `phases_completed` vazio (só `specify`
     rodou, artefato ainda não gerado ou em geração)
4. Se `ARQUIVO_ROADMAP` estiver configurado, leia-o e compare contra o
   que foi apurado nos arquivos de estado. Aponte discrepâncias:
   - Spec no roadmap como 🔲/🟡 mas o estado real já é `done`
     (roadmap desatualizado — sugerir corrigir)
   - Spec no roadmap como ✅ mas o estado real não é `done`, ou não há
     `<ESTADO_DIR>/<slug>.json` correspondente (roadmap otimista
     demais — investigar)
   - Spec com `<ESTADO_DIR>/<slug>.json` mas **sem** entrada no
     roadmap (spec ad-hoc, fora do planejamento — sinalizar, não é
     necessariamente um erro, mas vale visibilidade)

## Saída

```
## Status do Pipeline

| Feature       | Fase atual | Tasks | Últimas fases concluídas         | Próximo comando |
|----------------|------------|-------|-----------------------------------|------------------|
| 017-user-auth  | tasks      | —     | specify, plan                     | /tasks           |
| 019-checkout   | implement  | 8/12  | specify, plan, tasks              | /implement       |
| 012-outra-feat | done       | 12/12 | specify, plan, tasks, implement, review | —          |

Coluna "Tasks": `task_progress.completed`/`task_progress.total`. `—`
quando `/tasks` ainda não rodou (`total: null`).

Features em specs/ sem arquivo de estado correspondente em
<ESTADO_DIR>/ não aparecem aqui — rode /specify (ou /specify-tech)
para começar o rastreamento.

### Features em estado de exceção
- 🚧 020-billing-sync (blocked): <status_detail> — bloqueado em
  <current_phase antes da exceção, se relevante para o motivo>
- ❌ 015-legacy-import (failed): <status_detail>

Omita esta seção se não houver nenhuma feature em exceção.

### Divergências com o roadmap
- ⚠ 009-old-feature: roadmap marca 🟡 Em andamento, mas o estado real
  já é ✅ done. Sugestão: atualizar ARQUIVO_ROADMAP.
- ⚠ 014-planned-only: existe no roadmap como 🔲 Pendente, sem
  arquivo de estado — ainda não iniciada, nenhuma ação necessária.
```

Se houver mais de uma feature incompleta, pergunte ao usuário qual
deseja retomar antes de sugerir qualquer próximo passo — nunca escolha
sozinho quando houver ambiguidade.
