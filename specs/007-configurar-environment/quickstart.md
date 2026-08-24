# Quickstart — Validação manual (007)

Passos para confirmar, na própria máquina, que `EnvironmentConfig`
(`endpoint`/`managed`) está correto. Complementa (não substitui) os
quality gates automatizados de `.pipeline/quality-gates.md`.

## 1. Suíte de testes unitários (Vitest)

```bash
pnpm --filter @eventpier/provider-aws test
```

**Esperado**: todos os testes de `environment.config.test.ts` passam
(default sem variáveis, endpoint customizado, `MINISTACK_MANAGED`
case-insensitive, `managed: false` com endpoint, e os dois casos de
`InvalidEnvironmentConfigError`), junto dos testes já existentes de
`health-cache.test.ts` (sem regressão).

## 2. Build + Typecheck

```bash
pnpm --filter @eventpier/contracts build
pnpm --filter @eventpier/provider-aws build
pnpm -r exec tsc --noEmit
```

**Esperado**: sem erros. `providers/aws/dist/config/environment.config.js`
é gerado.

## 3. Demonstração manual do default (fora da suíte de testes)

Com o build do passo 2 já feito, sem nenhuma variável de ambiente
customizada:

```bash
node providers/aws/dist/index.js &
sleep 1
curl -s http://localhost:4000/api/v1/manifest | node -e "
  let data = '';
  process.stdin.on('data', (c) => (data += c));
  process.stdin.on('end', () => console.log(JSON.parse(data).environment));
"
kill %1
```

**Esperado**:
`{ id: 'ministack', endpoint: 'http://ministack:4566', managed: true }`.

## 4. Demonstração manual do modo externo (`managed: false`)

```bash
MINISTACK_MANAGED=false MINISTACK_ENDPOINT=http://localhost:4566 node providers/aws/dist/index.js &
sleep 1
curl -s http://localhost:4000/api/v1/manifest
kill %1
```

**Esperado**: `environment` reflete exatamente
`{ id: "ministack", endpoint: "http://localhost:4566", managed: false }`.

## 5. Demonstração manual do fail-fast

```bash
MINISTACK_MANAGED=false node providers/aws/dist/index.js; echo "exit code: $?"
```

**Esperado**: o processo imprime uma mensagem de erro em `stderr`
explicando que `MINISTACK_ENDPOINT` é obrigatório com
`managed: false`, e encerra com código de saída diferente de zero —
sem nunca imprimir "ouvindo na porta".

```bash
MINISTACK_MANAGED=talvez node providers/aws/dist/index.js; echo "exit code: $?"
```

**Esperado**: mesmo comportamento — mensagem de erro sobre o valor
inválido de `MINISTACK_MANAGED`, código de saída diferente de zero.

## 6. Quality gates automatizados equivalentes aos passos 3-5

```bash
node scripts/validate-manifest-endpoint.mjs
node scripts/validate-environment-config.mjs
```

**Esperado**: ambos `OK` — a versão automatizada dos cenários acima,
já cobrindo os asserts exatos (ver
`contracts/environment-config-shape.md`).

## 7. `docker compose up` — confirmar integração real com o Compose

```bash
docker compose --profile managed-env up --build
curl -s http://localhost:3000 > /dev/null  # eventpier-ui de pé (spec 009+ não existe ainda, só confirma que não quebrou o compose)
docker compose exec eventpier-ui sh -c "true" 2>/dev/null || true
```

Como não há ainda nenhum jeito de consultar o manifesto pela UI (specs
009+), confirme via `docker compose logs eventpier-aws` que a
mensagem "eventpier-aws ouvindo na porta 4000" aparece — usando os
defaults de `docker-compose.yml`
(`MINISTACK_ENDPOINT=http://ministack:4566`, `MINISTACK_MANAGED=true`).

**Esperado**: nenhum erro nos logs de `eventpier-aws`; o serviço sobe
normalmente, exatamente como antes desta spec.

## 8. Confirmar que nada além do previsto foi tocado

```bash
git status --short
```

**Esperado**: mudanças restritas a
`providers/aws/src/config/environment.config.ts` (novo),
`providers/aws/src/config/environment.config.test.ts` (novo),
`providers/aws/src/manifest/manifest.service.ts`,
`providers/aws/src/index.ts`, `scripts/validate-manifest-endpoint.mjs`,
`scripts/validate-environment-config.mjs` (novo),
`.pipeline/quality-gates.md`, `.github/workflows/ci.yml`. Nenhuma
mudança em `packages/contracts/`, `docker-compose.yml`, `.env.example`
(já continham as variáveis desde a spec 003) ou
`providers/aws/src/manifest/health-cache.ts` (spec 006, não tocado por
esta spec).
