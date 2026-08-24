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
  functionality: pass   # 1 achado BAIXO (revisor) + 1 achado ALTO (Codex, externo) — ambos encontrados e corrigidos nesta mesma PR
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

### `docker-compose.yml`

**[ALTO] Default embutido de `MINISTACK_ENDPOINT` no Compose mascarava
`managed:false` sem endpoint como se tivesse um configurado** —
CORRIGIDO (achado externo: comentário automático do bot Codex nesta
PR, https://github.com/eventpier/eventpier-monorepo/pull/14#discussion_r3843742161)

`docker-compose.yml` (spec 003) definia
`MINISTACK_ENDPOINT=${MINISTACK_ENDPOINT:-http://ministack:4566}`. O
Compose resolve essa expressão no host, **antes** de passar a variável
ao container — então `process.env.MINISTACK_ENDPOINT`, dentro de
`environment.config.ts`, nunca via a variável como "ausente" quando o
usuário não a definia: via sempre a string
`"http://ministack:4566"`, indistinguível de um endpoint real
customizado. Resultado prático: `MINISTACK_MANAGED=false` sozinho
(sem `MINISTACK_ENDPOINT` no `.env`), rodando via `docker compose up`,
**nunca disparava o fail-fast do Requisito Funcional 5** — o provider
subia normalmente, reportando `managed:false` apontando para o
endereço do serviço **gerenciado** (que pode nem estar em execução se
o profile `managed-env` não estiver ativo). Exatamente o cenário que a
Decisão 4 desta spec (fail-fast deliberado) pretendia impedir, só que
mediado pelo Compose em vez de diretamente pelo processo Node — a
suíte de testes desta spec não pegava isso porque nenhum dos testes
passa pela resolução de variáveis do Compose, só spawna o processo
Node diretamente.

Reproduzido e confirmado antes da correção: `docker compose config`
com `MINISTACK_MANAGED=false` e sem `MINISTACK_ENDPOINT` resolvia
`environment.MINISTACK_ENDPOINT` para o literal
`"http://ministack:4566"`; rodando o processo com exatamente esse par
de variáveis, o manifesto respondia
`{endpoint:"http://ministack:4566", managed:false}` sem erro nenhum.

**Correção aplicada**: `docker-compose.yml` muda para
`MINISTACK_ENDPOINT=${MINISTACK_ENDPOINT:-}` — sem valor quando o host
não define a variável, delegando o default inteiramente ao código do
provider (fonte única da verdade). Nova checagem de regressão em
`scripts/validate-compose-shape.mjs`
(`checkEndpointNotDefaultedByCompose`), confirmada RED antes da
correção (reproduzindo o texto original) e GREEN depois. Reconfirmado
com Docker real: `docker compose --profile managed-env up` (default)
continua reportando `endpoint: "http://ministack:4566"` corretamente
(agora vindo do código); `MINISTACK_MANAGED=false docker compose up
eventpier-aws` (sem endpoint) agora encerra com exit code 1 e a
mensagem de erro esperada, em vez de subir silenciosamente. Detalhes
completos em `research.md`, "Decisões durante a implementação".

## Diagnóstico geral

| # | Arquivo | Severidade | Status |
|---|---------|------------|--------|
| 1 | `docker-compose.yml` | ALTO | ✅ Corrigido (achado do Codex) |
| 2 | `providers/aws/src/config/environment.config.ts` | BAIXO | ✅ Corrigido |

## Quality gates

Testes unitários (Vitest, 22/22 — 12 pré-existentes de
`health-cache.test.ts` + 10 novos de `environment.config.test.ts`),
Build (3 workspaces), Typecheck, Docker, Testes de integração (7
scripts, incluindo o novo `validate-environment-config.mjs`, a
extensão de `validate-manifest-endpoint.mjs` e a nova checagem em
`validate-compose-shape.mjs`) — todos `pass`, confirmados localmente.
Cenário real via `docker compose up`/`docker compose config`
reconfirmado manualmente para os dois achados (default preservado;
fail-fast agora funcionando através do Compose).

## Recomendação

**Aprovar.** Nenhum problema pendente após a correção aplicada nesta
mesma PR.

---
🤖 Gerado com [Claude Code](https://claude.com/claude-code)
