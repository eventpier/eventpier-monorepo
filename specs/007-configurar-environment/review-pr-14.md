# Review — PR #14: EnvironmentConfig (endpoint / managed) (spec 007)

```yaml
quality_gates:
  typecheck: pass
  build: pass       # inclui Docker (docker compose build)
  docker: pass
  test: pass        # unitários (Vitest, 22/22) + integração (7 scripts) — reconfirmados no CI real (job "validate", run 32730658764)
  lint: not_run     # ainda não configurado no projeto (quality-gates.md)
review_judgment:
  security: pass
  architecture: pass
  functionality: pass   # 1 achado BAIXO encontrado e corrigido nesta mesma PR
  quality: pass
```

## Resumo executivo

`providers/aws` ganha `resolveEnvironmentConfig()`, substituindo o
`environment` fixo do manifesto por configuração real via
`MINISTACK_ENDPOINT`/`MINISTACK_MANAGED`, com fail-fast na
inicialização quando a configuração é inválida ou incompleta.
Implementação aderente ao plano: TDD literal (RED confirmado antes da
implementação, GREEN depois), `buildManifest()` refatorado para
receber `environment` como parâmetro em vez de lê-lo internamente,
dois scripts de integração cobrindo o cenário default, o customizado e
os dois cenários de fail-fast via processo real, e nenhuma chamada de
rede introduzida (RF7/RF8 garantidos por construção — confirmado lendo
o código, não só rodando gates). A decisão deliberada de divergir do
precedente de `HEALTH_CHECK_TTL_MS` (fail-fast em vez de default
silencioso, spec 006) está bem justificada e documentada em
`research.md`, Decisão 4.

## Comentários por arquivo

### `providers/aws/src/config/environment.config.ts`

**[BAIXO] `MINISTACK_ENDPOINT` não era normalizado (`trim()`) antes do
uso, inconsistente com `MINISTACK_MANAGED`** — CORRIGIDO

`parseManaged()` já fazia `.trim().toLowerCase()`, mas a leitura de
`endpointRaw` usava o valor bruto de `process.env.MINISTACK_ENDPOINT`.
Um espaço em branco incidental (ex.: erro de digitação num `.env`)
produzia um endpoint tecnicamente diferente do pretendido, sem cair no
default nem falhar explicitamente — o processo subiria "funcionando",
mas apontando para um endpoint sutilmente errado, só detectável quando
uma capability real (spec 008) tentasse conectar de fato.

**Correção aplicada** (commit `fix(provider-aws): trim
MINISTACK_ENDPOINT before use`):
`process.env.MINISTACK_ENDPOINT?.trim()`. Dois testes de regressão
adicionados a `environment.config.test.ts`: endpoint com espaço ao
redor preserva o valor limpo; endpoint só com espaços é tratado como
ausente (cai no default). 22/22 testes verdes; build, typecheck e os
dois scripts de integração reconfirmados `OK` após a correção.

## Diagnóstico geral

| # | Arquivo | Severidade | Status |
|---|---------|------------|--------|
| 1 | `providers/aws/src/config/environment.config.ts` | BAIXO | ✅ Corrigido |

## Quality gates

Testes unitários (Vitest, 22/22 — 12 pré-existentes de
`health-cache.test.ts` + 10 novos de `environment.config.test.ts`),
Build (3 workspaces), Typecheck, Docker, Testes de integração (7
scripts, incluindo o novo `validate-environment-config.mjs` e a
extensão de `validate-manifest-endpoint.mjs` desta spec) — todos
`pass`, confirmados localmente e no CI real desta PR (job "validate",
run 32730658764).

## Recomendação

**Aprovar.** Nenhum problema pendente após a correção aplicada nesta
mesma PR.

---
🤖 Gerado com [Claude Code](https://claude.com/claude-code)
