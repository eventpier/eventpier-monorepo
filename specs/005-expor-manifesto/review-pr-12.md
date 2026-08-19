# Review — PR #12: Endpoint de manifesto GET /api/v1/manifest (spec 005)

```yaml
quality_gates:
  typecheck: pass   # CI real (run 32250664985), após correção — Build agora roda antes
  build: pass
  docker: pass
  test: pass
  lint: not_run   # ainda não configurado no projeto (quality-gates.md)
review_judgment:
  security: pass
  architecture: pass   # 2 achados encontrados e corrigidos nesta mesma PR
  functionality: pass
  quality: pass
```

## Resumo executivo

A implementação segue exatamente `contracts/manifest-endpoint-shape.md`:
`manifest.service.ts`/`index.ts` substituem o placeholder da spec 003
por um endpoint real, os três cenários HTTP (200/405/404) funcionam
corretamente — validado via `curl` nativo e via `docker compose exec`
na rede interna —, e as duas Clarificações da spec (`capabilities: []`,
`environment` fixo) foram respeitadas à risca. `research.md` documenta
9 decisões com alternativas rejeitadas, incluindo a escolha consciente
de não usar Fastify/Express ainda (uma única rota) e de copiar
`packages/contracts/dist` manualmente no Dockerfile em vez de
`pnpm deploy` (sem dependência de terceiro que o justifique ainda).

O review inicial encontrou o CI real quebrado (`mergeStateStatus:
BLOCKED`) — um problema de ordenação de gates que só se manifesta em
checkout limpo, mascarado localmente por artefatos de build de uma
sessão anterior. Ambos os achados foram corrigidos nesta mesma PR e o
CI confirmado verde antes da submissão deste review.

## Comentários por arquivo

### `.github/workflows/ci.yml` / `.pipeline/quality-gates.md`

**[CRÍTICO] Typecheck rodava antes de Build, mas passou a depender dele**
> Linha 40 de `ci.yml` (posição final, após a correção)

`providers/aws` importa `@eventpier/contracts` de verdade pela
primeira vez nesta spec. `pnpm -r exec tsc --noEmit` (gate Typecheck,
primeiro step do CI) passou a exigir
`packages/contracts/dist/index.d.ts` para resolver o módulo — e só o
gate Build gera esse `dist/`. Num checkout limpo (exatamente o que o
CI faz), isso falhava com `TS2307: Cannot find module
'@eventpier/contracts'` ([run 32249870616](https://github.com/eventpier/eventpier-monorepo/actions/runs/32249870616)).
Localmente passou despercebido porque `dist/` já existia de passos
anteriores da mesma sessão de implementação.

**Corrigido nesta mesma PR:** ordem invertida para
**Build → Typecheck → Docker → Testes** em `quality-gates.md` e
`ci.yml`. Confirmado localmente com `dist/` apagado de propósito
(simulando checkout limpo) e no [CI real após a correção](https://github.com/eventpier/eventpier-monorepo/actions/runs/32250664985)
— job `validate` `SUCCESS`.

---

**[ALTO] Script de teste novo não estava no CI real**
> Linha 53 de `ci.yml` (posição final, após a correção)

`quality-gates.md` (task T012) foi atualizado para encadear
`scripts/validate-manifest-endpoint.mjs` na linha Testes, mas
`ci.yml` é hardcoded (não lê `quality-gates.md` dinamicamente) e
ficou sem o novo script — o CI real nunca teria validado o
comportamento HTTP do endpoint, mesmo depois de corrigido o achado
acima.

**Corrigido nesta mesma PR:** `validate-manifest-endpoint.mjs`
adicionado ao step "Testes" de `ci.yml`.

## Diagnóstico geral

| # | Arquivo | Severidade | Título |
|---|---------|------------|--------|
| 1 | `.github/workflows/ci.yml`, `.pipeline/quality-gates.md` | Crítico | Typecheck rodava antes de Build, mas passou a depender dele |
| 2 | `.github/workflows/ci.yml` | Alto | Script de teste novo não estava no CI real |

## Recomendação de merge

**Aprovar** — ambos os achados corrigidos e verificados no CI real
antes da submissão deste review; nada bloqueante remanescente.

## Fechamento da feature

Incluído nesta mesma PR (commit "docs(expor-manifesto): mark feature
as complete"):

- `.pipeline/state/expor-manifesto.json`: `current_phase` → `done`.
- `.pipeline/roadmap.md`: linha 005 → ✅ Concluído.
- `.pipeline/decisions-log.md`: nova entrada "005-expor-manifesto" com
  os 3 desvios não previstos (ordem Typecheck/Build, `ci.yml`
  desatualizado, `wget` do BusyBox sem `--method=POST`).
- `docs/features/provider-aws.md` (novo): primeiro doc de domínio do
  provider — endpoint de manifesto, decisões de `environment`/
  `capabilities` fixos, limitações conhecidas.
- `docs/features/contracts.md`: remove a nota "sem endpoint HTTP
  ainda" (desatualizada por esta spec) e reavalia a limitação de
  validação de runtime.

## Aprovação

Aprovado pelo usuário no chat em 2026-08-19, em duas rodadas: (1)
"corrigir e submeter review" — autorizando a correção dos 2 achados
antes da submissão; (2) "submeter como está" — após confirmação do CI
verde, autorizando a submissão final incluindo o fechamento da
feature. Review submetido ao GitHub como `event=COMMENT` (não
`APPROVE`): o autor da PR é o mesmo usuário autenticado no GitHub
(`edenoscherer`), e a API do GitHub bloqueia autoaprovação — a
aprovação real já aconteceu neste chat. `state` da review no GitHub
fica `COMMENTED`, não `APPROVED`; isso não muda a recomendação acima.

Nota: o GitHub MCP server retornou erro `401 Bad credentials` ao
tentar coletar dados da PR — mesmo problema já registrado em memória
(2026-08-12). Toda a coleta e submissão desta review foi feita via
`gh` CLI/`gh api` como fallback.
