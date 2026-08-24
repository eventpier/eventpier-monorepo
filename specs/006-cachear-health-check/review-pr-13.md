# Review — PR #13: Cache de health-check por capability (spec 006)

```yaml
quality_gates:
  typecheck: pass
  build: pass       # inclui Docker (docker compose build)
  docker: pass
  test: pass        # unitários (Vitest, 12/12 — inclui teste de regressão) + integração (6 scripts)
  lint: not_run     # ainda não configurado no projeto (quality-gates.md)
review_judgment:
  security: pass
  architecture: pass
  functionality: pass   # 1 achado ALTO encontrado e corrigido nesta mesma PR
  quality: pass
```

## Resumo executivo

Mecanismo de cache de health-check genérico e isolado por instância
(`createHealthCache(check, options?)` → `{ getStatus, invalidate }`),
implementado exatamente conforme `contracts/health-cache-shape.md`:
TTL default 4000ms configurável via `HEALTH_CHECK_TTL_MS`, invalidação
ativa, sem nenhum acoplamento a capability específica (RF8) — pronto
para a spec 008 (Storage) importar sem mudança de assinatura. TDD
literal (RED confirmado antes da implementação, GREEN depois). Também
introduz Vitest como primeiro test runner real do projeto, gatilho já
registrado desde a spec 002.

Durante a própria implementação (`/implement`), foi encontrado e
corrigido um problema de configuração do Vitest: sem `vitest.config.ts`,
a suíte também descobria e rodava a versão compilada dos testes em
`dist/` (gerada pelo build, já que testes não são excluídos do
`tsconfig.json` — decisão consciente para manter cobertura de
Typecheck), duplicando os 11 testes (22 no total) e arriscando mascarar
o resultado real com um `dist/` desatualizado. Corrigido com
`test.exclude: ["**/node_modules/**", "dist/**"]`.

Durante esta review foi encontrado e corrigido um segundo problema, de
corretude (ver "Comentários por arquivo" abaixo) — race condition entre
verificações concorrentes e `invalidate()`.

## Comentários por arquivo

### `providers/aws/src/manifest/health-cache.ts`

**[ALTO] Race condition: uma verificação antiga em voo podia sobrescrever
o cache e desfazer um `invalidate()` mais recente** — CORRIGIDO

`runCheck()` gravava em `cached` incondicionalmente, sem checar se
ainda era a verificação mais recente. Como não há deduplicação de
chamadas concorrentes (decisão consciente, `research.md` Decisão 4 —
mas essa decisão só avaliou o custo de chamadas redundantes, não essa
implicação de corretude), duas `runCheck()` concorrentes faziam
"last-write-wins" por ordem de **conclusão**, não de início. Um
`invalidate()` podia ser silenciosamente desfeito por uma verificação
antiga que só terminava depois — violando a garantia central do
princípio 6 da constitution e do RF6 da spec ("nunca reportar
`available` desatualizado").

Sem impacto na spec 006 em si (nenhum consumidor real ainda, RF9), mas
seria um problema real assim que a spec 008 expusesse `getStatus()` a
requisições HTTP concorrentes de verdade.

**Correção aplicada** (commit `e319fb5`): contador de geração —
`runCheck()` captura seu próprio número de geração antes de chamar
`check()` e só grava em `cached` se nenhuma verificação mais nova (nem
`invalidate()`) começou desde então; `invalidate()` também incrementa o
contador, descartando qualquer verificação já em voo. Coberto por um
teste de regressão dedicado, com ordem de resolução controlada
manualmente (promises resolvidas fora de ordem), não por tempo. Os 11
testes originais permanecem válidos (nenhum exercitava chamadas
concorrentes). 12/12 testes verdes; todos os quality gates
re-confirmados localmente e no CI real da PR após a correção.

## Diagnóstico geral

| # | Arquivo | Severidade | Status |
|---|---------|------------|--------|
| 1 | `providers/aws/src/manifest/health-cache.ts` | ALTO | ✅ Corrigido (commit `e319fb5`) |

## Recomendação de merge

**Aprovar.** Nenhum problema pendente.

## Fechamento da feature

- `.pipeline/state/cachear-health-check.json`: `current_phase` →
  `done`.
- `.pipeline/roadmap.md`: spec 006 → ✅ Concluído.
- `.pipeline/decisions-log.md`: entrada `006-cachear-health-check`
  registrada.
- `docs/features/provider-aws.md`: `health-cache.ts` documentado
  (comportamento-chave, correção de concorrência, "Specs
  Relacionadas").

Tudo commitado nesta mesma PR (commit `919cdc9`), efetivo em `main`
junto com o merge.
