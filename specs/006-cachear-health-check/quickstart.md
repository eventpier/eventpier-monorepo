# Quickstart — Validação manual (006)

Passos para confirmar, na própria máquina, que o mecanismo de cache de
health-check está correto. Complementa (não substitui) os quality gates
automatizados de `.pipeline/quality-gates.md`. Como esta spec não tem
endpoint HTTP nem UI (`spec.md`, RF9), a validação manual é sobre o
módulo em si, não sobre uma requisição de rede.

## 1. Suíte de testes unitários (Vitest)

```bash
pnpm --filter @eventpier/provider-aws test
```

**Esperado**: todos os testes de `health-cache.test.ts` passam,
incluindo os nomes que descrevem cada comportamento do Requisito
Funcional correspondente (cache hit, expiração de TTL, invalidação
ativa, isolamento entre capabilities, default/override de
`HEALTH_CHECK_TTL_MS`, falha inesperada mapeada para `UNKNOWN`).

## 2. Build + Typecheck

```bash
pnpm --filter @eventpier/contracts build
pnpm --filter @eventpier/provider-aws build
pnpm -r exec tsc --noEmit
```

**Esperado**: sem erros. `providers/aws/dist/manifest/health-cache.js`
é gerado (junto do `.test.js` compilado — ver Decisão 8 de
`research.md`, intencional).

## 3. Demonstração manual do comportamento (fora da suíte de testes)

Com o build do passo 2 já feito:

```bash
node -e "
const { createHealthCache } = await import('./providers/aws/dist/manifest/health-cache.js');
let calls = 0;
const cache = createHealthCache(async () => { calls++; return { status: 'available' }; }, { ttlMs: 200 });

console.log('1a leitura:', await cache.getStatus(), 'calls =', calls);
console.log('2a leitura (dentro do TTL, deve reusar cache):', await cache.getStatus(), 'calls =', calls);

await new Promise((r) => setTimeout(r, 250));
console.log('3a leitura (apos TTL expirar, nova checagem):', await cache.getStatus(), 'calls =', calls);

cache.invalidate();
console.log('4a leitura (logo apos invalidate, nova checagem mesmo dentro do TTL):', await cache.getStatus(), 'calls =', calls);

console.log('total esperado de chamadas reais: 3 — obtido:', calls);
"
```

**Esperado**: a saída mostra `calls` incrementando exatamente nas
leituras 1, 3 e 4 (nunca na 2, que é cache hit), terminando em
`calls = 3`.

## 4. Confirmar que o endpoint de manifesto (spec 005) não regrediu

```bash
node scripts/validate-manifest-endpoint.mjs
```

**Esperado**: `OK` — `GET /api/v1/manifest` continua retornando
`capabilities: []`, exatamente como especificado na spec 005 (RF9
desta spec: nenhuma integração com o manifesto ainda).

## 5. Confirmar que nada além do previsto foi tocado

```bash
git status --short
```

**Esperado**: mudanças restritas a
`providers/aws/src/manifest/health-cache.ts`,
`providers/aws/src/manifest/health-cache.test.ts`,
`providers/aws/package.json` (novo `devDependencies.vitest` e
`scripts.test`), `pnpm-lock.yaml`, `.pipeline/quality-gates.md` e
`.github/workflows/ci.yml` (novo step + renomeações de rótulo). Nenhuma
mudança em `manifest.service.ts`, `index.ts`, `packages/contracts/` ou
Docker Compose — esta spec não integra o cache a nada ainda (RF9).
