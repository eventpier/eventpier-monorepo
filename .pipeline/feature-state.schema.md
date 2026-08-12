# Formato do feature-state.json

Cada feature ativa mantém um arquivo de estado em:

```
<ESTADO_DIR>/<slug>.json
```

onde `<slug>` é o nome curto da feature (ex.: `user-auth`, sem o
prefixo numérico). Todo comando do pipeline lê e atualiza este arquivo
— nunca redigite ou re-derive o diretório da feature a partir de
conversa/memória quando o estado já existir.

## Schema

```json
{
  "feature_dir": "specs/017-user-auth",
  "branch": "017-user-auth",
  "short_name": "user-auth",
  "current_phase": "tasks",
  "status_detail": null,
  "phases_completed": ["specify", "plan"],
  "phases_pending": ["tasks", "implement", "review"],
  "clarifications_asked": 2,
  "last_updated": "2026-08-08T00:00:00Z",
  "quality_gates_status": {
    "typecheck": null,
    "test": null,
    "lint": null,
    "build": null
  },
  "task_progress": {
    "total": null,
    "completed": 0,
    "failed": 0
  }
}
```

### Campos

| Campo | Tipo | Descrição |
|---|---|---|
| `feature_dir` | string | Caminho completo do diretório da feature em `SPECS_DIR` |
| `branch` | string | Nome da branch git associada |
| `short_name` | string | Slug usado para nomear o próprio arquivo de estado |
| `current_phase` | string | Uma de: `specify`, `plan`, `tasks`, `implement`, `review`, `done` (progresso linear) — ou `blocked`, `cancelled`, `failed` (estado de exceção, ver seção própria abaixo) |
| `status_detail` | string \| null | Motivo em 1 frase. `null` no progresso linear; **obrigatório** quando `current_phase` é `blocked`/`cancelled`/`failed` |
| `phases_completed` | string[] | Fases já concluídas, na ordem em que terminaram |
| `phases_pending` | string[] | Fases restantes, na ordem esperada |
| `clarifications_asked` | number | Total de perguntas de clarificação já feitas nesta feature (soma entre specify/specify-tech) |
| `last_updated` | string (ISO 8601) | Timestamp da última atualização do estado |
| `quality_gates_status` | object | Resultado do último gate rodado por `/implement`, um por linha de `ARQUIVO_QUALITY_GATES` (`typecheck`/`test`/`lint`/`build`, ou o subconjunto que o projeto de fato tiver): `null` (não rodado), `"pass"` ou `"fail"` |
| `task_progress` | object | Progresso de execução de `tasks.md`, independente de `current_phase`. `total`: nº de tasks geradas por `/tasks` (`null` antes disso). `completed`: incrementado por `/implement` a cada task marcada `[X]`. `failed`: incrementado quando uma task falha |

## Regras de uso

1. `/specify` (ou `/specify-tech`) cria este arquivo na primeira
   execução para a feature.
2. Todo comando subsequente (`plan`, `tasks`, `implement`, `review-pr`)
   lê `feature_dir` e `branch` daqui antes de qualquer outra ação —
   nunca pergunta ao usuário "qual é o diretório da feature" se o
   arquivo já existir e a referência for inequívoca.
3. Ao concluir uma fase com sucesso, o comando responsável:
   - move a fase de `phases_pending` para `phases_completed`
   - atualiza `current_phase` para a próxima fase pendente
   - atualiza `last_updated`
4. Se houver mais de uma feature com estado incompleto no mesmo
   projeto, `/pipeline-status` lista todas e pede ao usuário para
   indicar qual retomar — nenhum comando deve escolher sozinho qual
   feature continuar se houver ambiguidade.
5. Quando `current_phase` chega a `"done"`, o arquivo pode ser mantido
   (histórico) ou arquivado — isso é decisão do projeto, não do pipeline.

## Estados de exceção (`blocked` / `cancelled` / `failed`)

Representam uma feature parada por motivo externo ao progresso linear
(esperando aprovação, cancelada, ou uma tentativa de implementação que
falhou de forma não recuperável) — diferente de `phases_pending`, que
representa apenas "o que ainda não rodou".

1. **Somente manuais.** Só entram em vigor a pedido explícito do
   usuário (ex.: "marca essa feature como bloqueada, estou esperando
   aprovação de X"). Nenhum comando deste pipeline infere sozinho que
   uma feature está bloqueada, cancelada ou falhou — quality gate
   falhando, por exemplo, não é `failed` automático; é o comando
   parando e reportando, e o usuário decidindo se quer marcar exceção.
2. **Entrar em exceção**: qualquer comando (`specify`, `specify-tech`,
   `plan`, `tasks`, `implement`) reconhece o pedido durante sua
   execução, grava `current_phase` com o estado pedido e preenche
   `status_detail` com o motivo em 1 frase. `phases_completed` e
   `phases_pending` **não mudam** — continuam registrando o progresso
   real; é assim que se sabe onde retomar depois.
3. **Sair de exceção** (a pedido do usuário): `current_phase` volta
   para `phases_pending[0]` (a próxima fase pendente antes da
   interrupção) e `status_detail` volta para `null`.
4. **Mapeamento para `ARQUIVO_ROADMAP`** (ver `.pipeline/roadmap.md`):
   `blocked → 🚧`, `cancelled → ⛔`, `failed → ❌`. O comando que grava
   a exceção também atualiza a linha da feature no roadmap, se
   `ARQUIVO_ROADMAP` estiver configurado.
5. `/pipeline-status` lista features em estado de exceção separadamente
   das demais, mostrando `status_detail`.
