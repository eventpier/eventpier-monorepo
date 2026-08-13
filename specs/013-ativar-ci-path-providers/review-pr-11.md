# Review — PR #11: Ativação operacional do CI (spec 013 — follow-ups da spec 004)

```yaml
quality_gates:
  typecheck: pass
  build: pass
  docker: pass
  test: pass
  lint: not_run
  ci_real_no_github: pass   # job "validate" desta própria PR passou (SUCCESS)
review_judgment:
  security: pass
  architecture: pass
  functionality: pass
  quality: flagged
```

## Resumo executivo

O diff desta PR é majoritariamente documentação — as ações reais
(regra `required_status_checks` no Ruleset "Protect main - PR only",
3 merges de README como gatilho de teste, ajuste de política de
visibilidade de pacotes na organização, visibilidade pública do
pacote GHCR) já aconteceram via PRs #7-#10, já mergeadas/fechadas
separadamente. Os 4 requisitos funcionais têm evidência real (links
de PR/run, não suposição), incluindo um achado genuíno não previsto
no plano original: a restrição real não era sobre criação de pacote
(Decisão 2 do plano previa isso como risco principal), mas sobre a
organização ter "Public"/"Internal" desabilitados para visibilidade
de pacotes — exigiu um segundo ajuste manual do usuário.

## Comentários por arquivo (encontrados e corrigidos durante o review, antes da submissão)

#### `specs/013-ativar-ci-path-providers/research.md`

**[BAIXO] Payload da Decisão 1 com `"integration_id": null` desatualizado**
> Decisão 1, payload do Ruleset

O payload "canônico" documentado ainda mostrava `"integration_id":
null`, exatamente o valor que causou o erro 422 real durante a
implementação (já registrado em "Decisões durante a implementação",
mas não refletido no payload principal). **Corrigido**: campo omitido
em vez de `null`.

**[BAIXO] `strict_required_status_checks_policy: false` sem justificativa registrada**
> Decisão 1, payload do Ruleset

Diferente das demais escolhas desta spec (cada uma com "Alternativa
considerada"), essa flag não tinha registro do porquê. **Corrigido**:
adicionada justificativa (fricção desproporcional de exigir PR
atualizado com `main` num repositório de mantenedor único; reavaliar
se/quando houver mais de um colaborador ativo).

## Diagnóstico geral

| # | Arquivo | Severidade | Título | Status |
|---|---------|------------|--------|--------|
| 1 | `specs/013-ativar-ci-path-providers/research.md` | Baixo | `integration_id: null` desatualizado no payload | Corrigido |
| 2 | `specs/013-ativar-ci-path-providers/research.md` | Baixo | `strict_required_status_checks_policy` sem justificativa | Corrigido |

## Recomendação de merge

**Aprovar** — os dois achados (baixos) foram corrigidos na própria
branch antes da submissão do review; nada pendente.

## Fechamento da feature

Incluído nesta mesma PR (commit "docs(ativar-ci-path-providers): mark
feature as complete"):

- `.pipeline/state/ativar-ci-path-providers.json`: `current_phase` → `done`.
- `.pipeline/roadmap.md`: linha 013 → ✅ Concluído.
- `.pipeline/decisions-log.md`: nova entrada "013-ativar-ci-path-providers".
- `docs/features/ci.md`: removidas as duas "Limitações conhecidas"
  agora resolvidas (pacote privado, required check manual);
  documentados os novos comportamentos-chave; nova linha em "Specs
  Relacionadas".

## Aprovação

Aprovado pelo usuário no chat em 2026-08-13 ("fazer a correção e subir
a PR" — aprovação implícita condicionada à correção dos achados, que
foi aplicada antes da submissão). Review submetido ao GitHub como
`event=COMMENT` (não `APPROVE`): autor da PR é o mesmo usuário
autenticado no GitHub (`edenoscherer`), API bloqueia autoaprovação —
aprovação real já aconteceu neste chat.
