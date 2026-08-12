# Quickstart — Validação manual (002)

Passos para confirmar, na própria máquina, que o contrato compartilhado
está correto. Complementa (não substitui) os quality gates
automatizados de `.pipeline/quality-gates.md`.

## 1. Typecheck (inclui a verificação de forma)

```bash
pnpm -r exec tsc --noEmit
```

**Esperado**: sem erros em nenhum workspace, incluindo
`packages/contracts/src/contract-shape.check.ts` — se algum campo
obrigatório do contrato mudar de forma incompatível, este comando
falha aqui, antes de qualquer runtime.

## 2. Build do pacote

```bash
pnpm --filter @eventpier/contracts build
```

**Esperado**: gera `packages/contracts/dist/index.js` e
`packages/contracts/dist/index.d.ts` sem erro. `dist/` não deve
aparecer em `git status` (coberto por `.gitignore`).

## 3. Constantes em runtime

```bash
node scripts/validate-contract-constants.mjs
```

**Esperado**: `OK` — confirma `CONTRACT_VERSION` como semver válido e
os três arrays (`CAPABILITIES`, `CAPABILITY_STATUSES`,
`HEALTH_FAILURE_CODES`) com exatamente os valores de
`data-model.md`. Rodar **antes** do passo 2 deve falhar com mensagem
clara pedindo para buildar primeiro — confirme esse caso também.

## 4. Confirmar consumibilidade sem tocar em `apps/ui`/`providers/aws`

```bash
node -e "
  const c = await import('./packages/contracts/dist/index.js');
  console.log(Object.keys(c).sort());
"
```

**Esperado**: lista inclui, no mínimo,
`CAPABILITIES, CAPABILITY_STATUSES, CONTRACT_VERSION, HEALTH_FAILURE_CODES`
— confirma que o barrel `index.ts` está reexportando de fato as três
fontes (`manifest.ts`, `pagination.ts`, `errors.ts`), sem exigir
nenhuma mudança em `apps/ui/package.json` nem
`providers/aws/package.json` (fora do escopo desta spec).

## 5. Confirmar que nada além do contrato foi tocado

```bash
git status --short
```

**Esperado**: mudanças restritas a `packages/contracts/`,
`scripts/validate-contract-constants.mjs` e
`.pipeline/quality-gates.md` (novo gate Build + Testes atualizado).
Nenhuma mudança em `apps/ui/`, `providers/aws/` ou Docker Compose
(specs 003, 005, 009 — fora do escopo).
