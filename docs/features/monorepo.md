# Monorepo — Estrutura de Workspaces

## O que o módulo faz

Define e mantém a estrutura de workspaces do monorepo Eventpier
(Estado 1 de `docs/arquitetura.md`): `apps/ui`, `providers/aws`,
`packages/contracts`, geridos via pnpm workspaces.

## Comportamentos-chave e regras de negócio

- Três workspaces: `apps/ui` (`@eventpier/ui`), `providers/aws`
  (`@eventpier/provider-aws`), `packages/contracts`
  (`@eventpier/contracts`).
- Todo `package.json` de workspace tem `name`, `version` (semver,
  nunca `0.0.0`), `private: true`, `type: "module"`, `scripts`.
  `type: "module"` é obrigatório porque `tsconfig.base.json` emite
  sintaxe ESM — sem ele, Node interpretaria o `.js` gerado como
  CommonJS e quebraria em runtime.
- Direção de dependência: `apps/ui` e `providers/aws` podem depender
  de `packages/contracts`; nunca o inverso; `apps/ui` nunca depende do
  código-fonte interno de `providers/aws`.
- TypeScript compartilhado via `tsconfig.base.json` na raiz
  (`target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`,
  `strict: true`); cada workspace estende esse base.
- Dois scripts sem dependências externas garantem que a estrutura não
  regrida: `scripts/validate-workspace-manifests.mjs` (forma dos
  `package.json`) e `scripts/validate-workspace-dependencies.mjs`
  (direção de dependência).

## Contrato de API

N/A — nenhuma API HTTP exposta. O "contrato" é a forma de cada
`package.json`/`tsconfig.json` de workspace; ver
`specs/001-setup-monorepo-workspaces/contracts/workspace-manifest.md`.

## Limitações conhecidas

- TypeScript fixado em `7.0.2` sem confirmação de compatibilidade com
  Next.js/Storybook — a confirmar quando a spec 009 (skeleton Next.js)
  chegar.
- `validate-workspace-manifests.mjs` checa `pnpm-workspace.yaml` por
  substring, não parse YAML real — um pattern comentado passaria como
  válido.
- Nenhum lint/build configurado ainda em
  `.pipeline/quality-gates.md`; entram quando as specs correspondentes
  (ESLint junto de `apps/ui`, build real) existirem.

## Specs Relacionadas

| # | Spec | Tipo | Resumo | Data |
|---|------|------|--------|------|
| 001 | [001-setup-monorepo-workspaces](../../specs/001-setup-monorepo-workspaces/) | ✨ Feature | Cria os workspaces `apps/ui`, `providers/aws`, `packages/contracts` com pnpm | 2026-08-12 |
