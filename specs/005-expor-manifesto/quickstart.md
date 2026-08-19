# Quickstart — Validação manual (005)

Passos para confirmar, na própria máquina, que o endpoint de
manifesto está correto. Complementa (não substitui) os quality gates
automatizados de `.pipeline/quality-gates.md`. Estende o quickstart da
spec 003 (`specs/003-configurar-docker-compose/quickstart.md`), agora
com conteúdo real em vez do placeholder.

## 1. Build nativo (sem Docker)

```bash
pnpm --filter @eventpier/contracts build
pnpm --filter @eventpier/provider-aws build
```

**Esperado**: sem erros; `packages/contracts/dist/index.js` e
`providers/aws/dist/index.js` gerados.

## 2. Subir o provider isolado (sem Docker, sem UI, sem MiniStack)

```bash
pnpm --filter @eventpier/provider-aws start
```

**Esperado**: log `eventpier-aws ouvindo na porta 4000`.

## 3. `GET /api/v1/manifest`

Em outro terminal:

```bash
curl -s http://localhost:4000/api/v1/manifest | jq
```

**Esperado**: HTTP 200 (confirmar com `curl -si` se quiser ver o
header) e corpo:

```json
{
  "contractVersion": "1.0.0",
  "provider": { "id": "aws", "name": "AWS" },
  "environment": { "id": "ministack", "managed": true },
  "version": "0.2.0",
  "capabilities": []
}
```

(`version` deve bater com o campo `version` de
`providers/aws/package.json` no momento do teste.)

## 4. Método não permitido

```bash
curl -si -X POST http://localhost:4000/api/v1/manifest
```

**Esperado**: `HTTP/1.1 405`, header `Allow: GET`, corpo
`ProviderError` com `"code":"METHOD_NOT_ALLOWED"` e
`"retryable":false`.

## 5. Path desconhecido

```bash
curl -si http://localhost:4000/rota-que-nao-existe
```

**Esperado**: `HTTP/1.1 404`, corpo `ProviderError` com
`"code":"NOT_FOUND"` e `"retryable":false`.

## 6. Encerrar o provider isolado

Voltar ao terminal do passo 2 e `Ctrl+C`.

## 7. Build das imagens Docker

```bash
docker compose build
```

**Esperado**: `eventpier-ui` e `eventpier-aws` buildam sem erro. Esta
é a primeira vez que o build de `eventpier-aws` também builda
`packages/contracts` dentro do Dockerfile (research.md, Decisão 6) —
se falhar aqui por não achar `@eventpier/contracts`, é sinal de que o
estágio `build` do `Dockerfile` não está copiando/buildando
`packages/contracts` corretamente.

## 8. Subir via Compose e repetir os cenários pela rede interna

```bash
docker compose up -d --build
docker compose exec eventpier-ui wget -qO- http://eventpier-aws:4000/api/v1/manifest
```

**Esperado**: mesmo corpo JSON do passo 3 (não mais o texto de
placeholder da spec 003).

```bash
docker compose exec eventpier-ui wget -qO- --method=POST http://eventpier-aws:4000/api/v1/manifest; echo
docker compose exec eventpier-ui wget -qO- http://eventpier-aws:4000/rota-que-nao-existe; echo
```

**Esperado**: `wget` reporta erro HTTP (405 e 404, respectivamente) —
`wget` sem `-q` mostra o código; usar `wget -S -O- ... 2>&1 | grep "HTTP/"`
se quiser confirmar o status exato dentro do container.

## 9. `eventpier-aws` continua inalcançável pelo host

```bash
curl -sf http://localhost:4000/api/v1/manifest && echo "FALHOU: não deveria responder" || echo "OK: inalcançável do host"
```

**Esperado**: `OK` — confirma que nada nesta spec alterou a decisão da
spec 003 (constitution, princípio 11).

## 10. Limpeza

```bash
docker compose down
```

## 11. Confirmar que nada além do previsto foi tocado

```bash
git status --short
```

**Esperado**: mudanças restritas a `providers/aws/src/index.ts`,
`providers/aws/src/manifest/manifest.service.ts` (novo),
`providers/aws/package.json`, `providers/aws/Dockerfile`,
`scripts/validate-manifest-endpoint.mjs` (novo) e
`.pipeline/quality-gates.md`. Nenhuma mudança em `apps/ui/`,
`docker-compose.yml`, `.github/workflows/`, nem em
`packages/contracts/src/` (o contrato em si não muda nesta spec — só
passa a ser consumido).
