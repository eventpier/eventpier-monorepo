# CI — Validação e Publicação de Imagens

## O que o módulo faz

Automação de CI no GitHub Actions (`.github/workflows/`), em dois
workflows com responsabilidades distintas: `ci.yml` valida todo Pull
Request contra `main` (quality gates de `.pipeline/quality-gates.md`,
sem filtro de path); `publish-provider-aws.yml` builda e publica a
imagem Docker do provider AWS no GHCR, disparado por `push` em `main`
com gatilho por path — isola release por provider mesmo com todos
compartilhando o mesmo repositório (constitution, princípio 3;
`docs/arquitetura.md` §9, Estado 3).

## Comportamentos-chave e regras de negócio

- `ci.yml` roda em todo `pull_request` contra `main`, **sem** filtro de
  path — cobre qualquer workspace alterado, sempre. Executa, nesta
  ordem: Typecheck (`pnpm -r exec tsc --noEmit`), Build dos três
  workspaces, Docker build (`docker compose build`) e os cinco scripts
  de validação estrutural de `.pipeline/quality-gates.md` (linha
  Testes).
- `publish-provider-aws.yml` roda em `push` para `main` — nunca em
  `pull_request`, para não virar um required status check que possa
  ficar pendente para sempre em PRs que não tocam seu path (ver
  `specs/004-configurar-ci-path-providers/research.md`, Decisão 2).
  Gatilho por path: `providers/aws/**` **e** `packages/contracts/**` —
  uma mudança só no contrato também republica o provider, para nunca
  deixar uma imagem publicada com um contrato desatualizado.
- Cada provider futuro (Azure, GCP) ganha seu próprio arquivo de
  workflow de publish (não uma matriz dinâmica) — mecânico de
  replicar, sem redesenho (`research.md`, Decisão 3).
- Imagem publicada em `ghcr.io/eventpier/eventpier-aws`, duas tags por
  publish: `sha-<7 chars do commit>` (rastreabilidade) e `latest`.
  Nenhum segredo além de `secrets.GITHUB_TOKEN` nativo do Actions é
  usado — sem PAT nem credencial externa.
- `docker-compose.yml` não foi alterado por este CI — o build local
  para desenvolvimento (spec 003) continua funcionando exatamente como
  antes; a publicação de imagem é um caminho paralelo, para consumo
  externo ao fluxo de dev.
- `scripts/validate-ci-workflow-shape.mjs` valida a forma dos dois
  workflows (gatilho, filtro de path, permissões, tags, ausência de
  segredo não previsto) lendo-os como texto — sem dependência de
  parser YAML.

## Contrato de API

N/A — nenhum endpoint HTTP. O "contrato" é a forma dos arquivos de
workflow; ver
`specs/004-configurar-ci-path-providers/contracts/ci-workflow-shape.md`.

## Limitações conhecidas

- O pacote `eventpier-aws` no GHCR nasce **privado** na primeira
  publicação, independente do repositório ser público — é o
  comportamento documentado do GitHub, não um bug deste CI. Precisa
  ser marcado como público manualmente, uma única vez, nas settings do
  pacote.
- O job `validate` de `ci.yml` só bloqueia merge de fato depois de ser
  marcado manualmente como *required status check* na branch
  protection de `main` — configuração de repositório, não
  automatizável via `GITHUB_TOKEN`.
- Sem cache de dependências pnpm em `ci.yml` e sem build multi-arch em
  `publish-provider-aws.yml` — adiados por não serem necessidade
  comprovada ainda (ver `research.md`, "Decisões descartadas por
  ora").

## Specs Relacionadas

| # | Spec | Tipo | Resumo | Data |
|---|------|------|--------|------|
| 004 | [004-configurar-ci-path-providers](../../specs/004-configurar-ci-path-providers/) | ✨ Feature | CI com validação em todo PR e publish de imagem do provider AWS com gatilho por path (`providers/aws/**` + `packages/contracts/**`) | 2026-08-13 |
