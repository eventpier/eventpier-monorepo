# Quickstart — Validação manual/execução (013)

Esta spec é, em si, uma sequência de verificações reais contra o
GitHub — não há "gate local" separado da execução. Passos em ordem;
cada um depende do anterior ter sido confirmado.

## Fase 1 — Adicionar o required status check (Requisito Funcional 1)

```bash
gh api repos/eventpier/eventpier-monorepo/rulesets/20759671 \
  --method PUT \
  --input <payload> # ver research.md, Decisão 1, para o JSON completo
```

**Esperado**: `gh api repos/eventpier/eventpier-monorepo/rulesets/20759671`
(GET) agora mostra 4 regras, incluindo `required_status_checks` com
`context: "validate"`.

## Fase 2 — Provar que o bloqueio funciona de verdade

1. Criar uma branch de teste a partir de `main`, quebrar
   `pnpm -r exec tsc --noEmit` de propósito (ex.: um erro de tipo
   óbvio num arquivo qualquer), abrir PR contra `main`.
2. Aguardar `ci.yml` rodar e falhar.
3. `gh pr view <N> --json mergeStateStatus` — **esperado**: `BLOCKED`
   (não `CLEAN`).
4. Fechar o PR **sem mergear** e deletar a branch de teste — ele
   existia só para esta prova.

## Fase 3 — Disparar a primeira publicação real (Requisitos 2 e 4b)

1. Criar `apps/ui/README.md` mínimo, PR isolado, merge em `main`.
   **Esperado**: `ci.yml` roda e passa; **nenhum** run de
   `publish-provider-aws.yml` aparece em Actions (confirma FR4a).
2. Criar `providers/aws/README.md` mínimo, PR isolado, merge em
   `main`.
   **Esperado**: `publish-provider-aws.yml` dispara e completa com
   `SUCCESS`.
   - **Se falhar com 403/permissão**: acessar
     `github.com/organizations/eventpier/settings/packages` →
     "Package creation" → habilitar criação de pacotes públicos
     (research.md, Decisão 2) → re-rodar o job (`gh run rerun
     <run-id>`) → confirmar sucesso.

## Fase 4 — Confirmar imagem pública (Requisito 3)

1. `gh api /orgs/eventpier/packages/container/eventpier-aws/versions --jq '.[0].metadata.container.tags'`
   — confirma que a imagem existe e tem as tags esperadas
   (`sha-<7>` + `latest`).
2. No GitHub: `github.com/orgs/eventpier/packages/container/eventpier-aws/settings`
   → **Change visibility** → **Public** (ação manual, ver
   `research.md`, Decisão 4 — token atual não tem escopo
   `write:packages` para automatizar isso).
3. De uma sessão **sem** `docker login ghcr.io`:
   ```bash
   docker pull ghcr.io/eventpier/eventpier-aws:latest
   ```
   **Esperado**: sucesso, sem prompt de autenticação.

## Fase 5 — Confirmar que o contrato sozinho também dispara publish (Requisito 4c)

1. Criar `packages/contracts/README.md` mínimo, PR isolado (não toca
   `providers/`), merge em `main`.
   **Esperado**: `publish-provider-aws.yml` dispara de novo, mesmo sem
   nenhuma mudança em `providers/aws/**` — confirma o comportamento
   central da spec 004 (contrato desatualizado nunca fica "esquecido"
   numa imagem publicada).

## Fase 6 — Registrar evidências

Preencher a tabela `RequirementEvidence` de `data-model.md` com os
links reais de cada PR/run observado nas Fases 2-5.
