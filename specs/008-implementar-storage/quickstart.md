# Quickstart — Validação manual (008)

Passos para confirmar, na própria máquina, que a capability Storage
está correta. Complementa (não substitui) os quality gates
automatizados de `.pipeline/quality-gates.md`. **Diferente das specs
005-007**, vários passos aqui exigem um MiniStack real de pé.

## 1. Suíte de testes unitários (Vitest)

```bash
pnpm --filter @eventpier/provider-aws test
```

**Esperado**: todos os testes de `storage.controller.test.ts` passam
(classificação de erro, health-check, `listBuckets`/`listObjects`,
`getStorageCapabilityDescriptor`), junto dos testes já existentes de
`health-cache.test.ts`/`environment.config.test.ts` (sem regressão).

## 2. Build + Typecheck

```bash
pnpm --filter @eventpier/contracts build
pnpm --filter @eventpier/provider-aws build
pnpm -r exec tsc --noEmit
```

**Esperado**: sem erros. `providers/aws/dist/adapters/ministack/storage.adapter.js`
e `providers/aws/dist/capabilities/storage.controller.js` são gerados.

## 3. Subir o MiniStack real

```bash
docker compose --profile managed-env up -d ministack
```

**Esperado**: container `ministack` de pé em poucos segundos
(imagem `ministackorg/ministack:latest`, porta `4566`).

## 4. Criar um bucket e objetos de teste (AWS CLI apontando para o MiniStack)

```bash
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

aws --endpoint-url=http://localhost:4566 s3 mb s3://demo-bucket
echo "conteudo" | aws --endpoint-url=http://localhost:4566 s3 cp - s3://demo-bucket/raiz.txt
echo "conteudo aninhado" | aws --endpoint-url=http://localhost:4566 s3 cp - s3://demo-bucket/pasta/dentro.txt
```

**Esperado**: os três comandos terminam sem erro.

## 5. Demonstração manual do caminho feliz (provider real, fora do Compose)

Com o build do passo 2 já feito:

```bash
MINISTACK_ENDPOINT=http://localhost:4566 MINISTACK_MANAGED=true node providers/aws/dist/index.js &
sleep 1

curl -s http://localhost:4000/api/v1/storage/buckets | node -e "
  let data = '';
  process.stdin.on('data', (c) => (data += c));
  process.stdin.on('end', () => console.log(JSON.parse(data)));
"

curl -s http://localhost:4000/api/v1/storage/buckets/demo-bucket/objects | node -e "
  let data = '';
  process.stdin.on('data', (c) => (data += c));
  process.stdin.on('end', () => console.log(JSON.parse(data)));
"

curl -s "http://localhost:4000/api/v1/storage/buckets/demo-bucket/objects?prefix=pasta/" | node -e "
  let data = '';
  process.stdin.on('data', (c) => (data += c));
  process.stdin.on('end', () => console.log(JSON.parse(data)));
"

curl -s http://localhost:4000/api/v1/manifest | node -e "
  let data = '';
  process.stdin.on('data', (c) => (data += c));
  process.stdin.on('end', () => console.log(JSON.parse(data).capabilities));
"

kill %1
```

**Esperado**:
- Lista de buckets inclui `demo-bucket`.
- Listagem raiz de `demo-bucket` retorna `{type: "folder", prefix: "pasta/"}`
  e `{type: "object", key: "raiz.txt", size, lastModified}`.
- Listagem com `prefix=pasta/` retorna só
  `{type: "object", key: "pasta/dentro.txt", ...}` — sem nenhum objeto
  fantasma para a própria pasta.
- `capabilities` do manifesto contém
  `{id: "storage", status: "available"}`.

## 6. Demonstração manual do bucket inexistente e do cenário indisponível

```bash
MINISTACK_ENDPOINT=http://localhost:4566 MINISTACK_MANAGED=true node providers/aws/dist/index.js &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/v1/storage/buckets/nao-existe/objects
kill %1

MINISTACK_ENDPOINT=http://localhost:1 MINISTACK_MANAGED=false node providers/aws/dist/index.js &
sleep 1
curl -s http://localhost:4000/api/v1/storage/buckets
curl -s http://localhost:4000/api/v1/manifest | node -e "
  let data = '';
  process.stdin.on('data', (c) => (data += c));
  process.stdin.on('end', () => console.log(JSON.parse(data).capabilities));
"
kill %1
```

**Esperado**:
- Bucket inexistente: HTTP `404`.
- Endpoint inalcançável: `GET /api/v1/storage/buckets` retorna
  `ProviderError` com `code: "CONNECTION_FAILED"`; `capabilities` do
  manifesto reporta `{id: "storage", status: "unavailable", reason: <HealthFailureCode>}`.

## 7. Quality gates automatizados equivalentes aos passos 3-6

```bash
node scripts/validate-manifest-endpoint.mjs
node scripts/validate-environment-config.mjs
node scripts/validate-storage-endpoint.mjs
```

**Esperado**: os três `OK` —
`validate-storage-endpoint.mjs` cria seu próprio bucket/objetos de
teste (não depende dos criados manualmente no passo 4) contra o mesmo
MiniStack já em execução (passo 3).

## 8. `docker compose up` completo — confirmar integração real

```bash
docker compose --profile managed-env up --build
```

Em outro terminal:

```bash
curl -s http://localhost:3000 > /dev/null || true  # eventpier-ui (specs 009+ ainda não existe, só confirma que o compose não quebrou)
docker compose logs eventpier-aws | tail -5
```

**Esperado**: nenhum erro nos logs de `eventpier-aws`; o serviço sobe
normalmente. Encerre com `docker compose --profile managed-env down`.

## 9. Confirmar que nada além do previsto foi tocado

```bash
git status --short
```

**Esperado**: mudanças restritas a
`packages/contracts/src/storage.ts` (novo),
`packages/contracts/src/index.ts`,
`providers/aws/package.json`,
`providers/aws/src/adapters/ministack/storage.adapter.ts` (novo),
`providers/aws/src/capabilities/storage.controller.ts` (novo),
`providers/aws/src/capabilities/storage.controller.test.ts` (novo),
`providers/aws/src/manifest/manifest.service.ts`,
`providers/aws/src/index.ts`,
`scripts/validate-manifest-endpoint.mjs`,
`scripts/validate-storage-endpoint.mjs` (novo),
`.pipeline/quality-gates.md`, `.github/workflows/ci.yml`. Nenhuma
mudança em `providers/aws/src/manifest/health-cache.ts`,
`providers/aws/src/config/environment.config.ts`, `docker-compose.yml`
ou `.env.example` (nenhuma variável nova é necessária — credenciais e
região do S3Client são fixas no código, Decisão 5 de `research.md`).
