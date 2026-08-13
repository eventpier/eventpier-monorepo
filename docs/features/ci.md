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
- O job `validate` de `ci.yml` é *required status check* na proteção
  de `main` (Ruleset "Protect main - PR only", regra
  `required_status_checks`, `context: "validate"`) — um PR com esse
  job falho fica estruturalmente impedido de ser mergeado, não é só
  reportado. Este repositório usa **Rulesets**, não a API clássica de
  Branch Protection (`branches/main/protection` retorna 404) — ver
  `specs/013-ativar-ci-path-providers/research.md`, Decisão 1.
- A imagem `ghcr.io/eventpier/eventpier-aws` é pública desde a
  primeira publicação real (spec 013) — `docker pull` funciona sem
  autenticação. Publicar o pacote de um provider novo (Azure/GCP)
  exige que a organização já permita pacotes públicos em
  `settings/packages`; para `eventpier`, essa política já está
  habilitada (spec 013, T008), não precisa ser reconfigurada.

## Contrato de API

N/A — nenhum endpoint HTTP. O "contrato" é a forma dos arquivos de
workflow; ver
`specs/004-configurar-ci-path-providers/contracts/ci-workflow-shape.md`.

## Limitações conhecidas

- Todo pacote GHCR novo (ex.: quando Azure/GCP ganharem seu próprio
  `publish-provider-<nome>.yml`) ainda nasce **privado** na primeira
  publicação — é preciso repetir a ação manual de marcar como público
  nas settings do pacote (a política de org que permite pacotes
  públicos já está habilitada, mas a visibilidade é por pacote, não
  herdada automaticamente).
- Sem cache de dependências pnpm em `ci.yml` e sem build multi-arch em
  `publish-provider-aws.yml` — adiados por não serem necessidade
  comprovada ainda (ver `research.md`, "Decisões descartadas por
  ora").

## Specs Relacionadas

| # | Spec | Tipo | Resumo | Data |
|---|------|------|--------|------|
| 013 | [013-ativar-ci-path-providers](../../specs/013-ativar-ci-path-providers/) | ✨ Feature | Ativação operacional do CI: required status check via Ruleset, primeira publicação real, pacote GHCR público, gatilho por path confirmado com evidência real | 2026-08-13 |
| 004 | [004-configurar-ci-path-providers](../../specs/004-configurar-ci-path-providers/) | ✨ Feature | CI com validação em todo PR e publish de imagem do provider AWS com gatilho por path (`providers/aws/**` + `packages/contracts/**`) | 2026-08-13 |
