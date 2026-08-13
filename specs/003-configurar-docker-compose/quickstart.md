# Quickstart — Validação manual (003)

Passos para confirmar, na própria máquina, que o Docker Compose do MVP
está correto. Complementa (não substitui) os quality gates
automatizados de `.pipeline/quality-gates.md`.

## 1. Build nativo (sem Docker) ainda passa

```bash
pnpm -r exec tsc --noEmit
pnpm --filter @eventpier/provider-aws build
pnpm --filter @eventpier/ui build
```

**Esperado**: sem erros; `apps/ui/dist/index.js` e
`providers/aws/dist/index.js` gerados.

## 2. Build das imagens

```bash
docker compose build
```

**Esperado**: `eventpier-ui` e `eventpier-aws` buildam sem erro, sem
precisar de nenhuma imagem publicada em registry (spec 004, CI, ainda
não existe). `ministack` não aparece nesta etapa — é `image:`, não
`build:`.

## 3. Subir com o MiniStack gerenciado pelo Compose

```bash
docker compose --profile managed-env up -d --build
docker compose ps
```

**Esperado**: três serviços `Up` — `eventpier-ui`, `eventpier-aws`,
`ministack`.

```bash
curl -s http://localhost:3000
curl -s http://localhost:4566/_ministack/health
```

**Esperado**: primeiro comando retorna o texto do placeholder de
`eventpier-ui`; segundo retorna resposta de saúde do MiniStack (200).

## 4. `eventpier-aws` não é alcançável pelo host

```bash
curl -sf http://localhost:4000 && echo "FALHOU: não deveria responder" || echo "OK: inalcançável do host"
```

**Esperado**: `OK` — confirma constitution, princípio 11
(`eventpier-aws` não publica porta).

## 5. `eventpier-aws` é alcançável pela rede interna

```bash
docker compose exec eventpier-ui wget -qO- http://eventpier-aws:4000
```

**Esperado**: retorna o texto do placeholder de `eventpier-aws` — a
comunicação interna funciona mesmo sem porta publicada.

## 6. Subir sem o MiniStack gerenciado (cenário `managed: false`)

```bash
docker compose down
docker compose up -d --build
docker compose ps
```

**Esperado**: apenas `eventpier-ui` e `eventpier-aws` sobem;
`ministack` não aparece em `docker compose ps` — confirma que o
profile `managed-env` é de fato opcional.

## 7. Apontar para um MiniStack externo

Em outro terminal, suba um MiniStack solto (fora deste Compose):

```bash
docker run --rm -p 4566:4566 ministackorg/ministack:latest
```

Depois, aponte o Compose para ele sem subir o serviço `ministack`
gerenciado:

```bash
MINISTACK_ENDPOINT=http://host.docker.internal:4566 MINISTACK_MANAGED=false \
  docker compose up -d --build
```

**Esperado**: `eventpier-aws` sobe normalmente; não há erro de porta
`4566` em conflito (o `ministack` deste Compose não subiu, porque o
profile não foi passado).

## 8. Alterar TTL/endpoint sem rebuild

```bash
HEALTH_CHECK_TTL_MS=8000 docker compose up -d
docker compose exec eventpier-aws printenv HEALTH_CHECK_TTL_MS
```

**Esperado**: `8000` — confirma que a variável chega ao container só
com restart, sem exigir `docker compose build` de novo.

## 9. Limpeza

```bash
docker compose --profile managed-env down
```

## 10. Confirmar que nada além do previsto foi tocado

```bash
git status --short
```

**Esperado**: mudanças restritas a `docker-compose.yml`,
`.dockerignore`, `.env.example`, `apps/ui/Dockerfile`,
`providers/aws/Dockerfile`, `apps/ui/src/index.ts`,
`providers/aws/src/index.ts`, `apps/ui/tsconfig.json`,
`providers/aws/tsconfig.json`, `apps/ui/package.json`,
`providers/aws/package.json`, `package.json` (raiz) e
`.pipeline/quality-gates.md`. Nenhuma mudança em
`packages/contracts/`, nenhum endpoint HTTP real, nenhuma tela de UI
(fora do escopo — specs 005+, 009+).
