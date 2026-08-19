# Plan — Endpoint de Manifesto (005)

## Contexto técnico

Primeira spec da Fase 2 (Provider AWS) — substitui o placeholder HTTP
mínimo introduzido pela spec 003 (`node:http`, sem rota real) por um
endpoint real (`GET /api/v1/manifest`) que retorna o `ProviderManifest`
já definido pela spec 002 (`packages/contracts`). É também a primeira
vez que `providers/aws` importa `@eventpier/contracts` como
dependência de verdade (não só um `package.json` copiado para
resolução de workspace, como fazia o Dockerfile desde a spec 003).

Nesta spec, `capabilities` é sempre `[]` e `environment` é sempre um
valor fixo (`{ id: "ministack", managed: true }`) — health-check com
cache (spec 006), `EnvironmentConfig` configurável (spec 007) e a
capability Storage (spec 008) ainda não existem; ambas as decisões
foram confirmadas explicitamente com o usuário como Clarificações em
`spec.md`, não são suposição desta fase de plano.

Detalhes técnicos e alternativas rejeitadas em `research.md`;
entidades e invariantes em `data-model.md`; código exato (endpoint,
`manifest.service.ts`, `Dockerfile`, script de validação) em
`contracts/manifest-endpoint-shape.md`; passos de validação manual em
`quickstart.md`.

## Conformidade com `ARQUIVO_REGRAS` / `ARQUIVO_ARQUITETURA`

| Princípio/seção | Como este plano respeita |
|---|---|
| Constitution §1 (UI conhece capabilities, não clouds) | Não afetado diretamente por esta spec (sem código de UI), mas o endpoint é exatamente o ponto de fronteira que torna esse princípio possível — devolve capabilities por `id`/`status`, nunca detalhe de AWS SDK/MiniStack. |
| Constitution §4 (contrato evolui de forma aditiva) | Nenhum campo novo é adicionado ao contrato; o endpoint apenas expõe a forma já fixada na spec 002, sem alterar `packages/contracts/src/*`. |
| Constitution §5 (capability tem status, não booleano) | Motivou a Decisão 4 de `research.md`: `capabilities: []` em vez de declarar `storage` com um status arbitrário que não reflete uma checagem real ainda. |
| Constitution §6 (health-check cacheado por capability) | Explicitamente fora de escopo (nenhuma capability real ainda) — ver `spec.md`, "Fora do escopo", e Decisão 4 de `research.md`. |
| Constitution §8 (endpoint do environment sempre configurável) | Reconhecido como não implementado ainda nesta spec (Decisão 5 de `research.md`) — `environment` é fixo, configurabilidade é spec 007. Sem violação: o princípio descreve o estado final do provider, não exige que toda spec intermediária já a implemente. |
| Constitution §10 (sem autenticação local) | Endpoint não exige nenhuma autenticação — consistente com o escopo local do MVP. |
| Constitution §11 (rede interna restrita) | Inalterado: `providers/aws` continua sem publicar porta no `docker-compose.yml`; validado no passo 9 de `quickstart.md`. |
| Constitution §13 (contrato é artefato próprio) | `providers/aws` passa a importar `@eventpier/contracts` como dependência real (`research.md`, Decisão 2), nunca duplica `contractVersion` como literal. |
| Arquitetura §2 (árvore do Estado 1) | `providers/aws/src/manifest/manifest.service.ts` criado exatamente no caminho já previsto na árvore — nenhum arquivo fora do que `arquitetura.md` antecipa para esta parte da Fase 2. |
| Arquitetura §3 (Contrato Mínimo) | Forma do `ProviderManifest` retornado é literal à interface documentada — nenhum campo extra, nenhum campo faltando. |
| Arquitetura §6 (acesso via SDK, sem bundler) | Reforça a Decisão 3 de `specs/002.../research.md` (extensão `.js` em imports internos) agora aplicada dentro de `providers/aws/src` pela primeira vez (`index.ts` → `./manifest/manifest.service.js`). |
| Arquitetura §7 (autenticação só entra em pauta com cloud real) | Sem autenticação nesta spec, consistente. |
| Arquitetura §8 (arquitetura de containers) | `Dockerfile` atualizado (`research.md`, Decisão 6) sem alterar `docker-compose.yml` nem a topologia de rede/portas já fixada na spec 003. |

Nenhum conflito entre spec/plano e `ARQUIVO_REGRAS`/`ARQUIVO_ARQUITETURA`
foi identificado.

## Segurança e observabilidade

- **Sem autenticação, por design do MVP** (constitution §10) — o
  endpoint responde a qualquer requisição `GET` na rede interna, sem
  verificação de identidade. Aceitável enquanto o escopo for
  exclusivamente local; reavaliar quando suporte a cloud real entrar
  em pauta (fora do MVP, `docs/product.md`).
- **Sem superfície de entrada para validar**: o endpoint não aceita
  query params, corpo de requisição nem parâmetros de path — não há
  dado externo para sanitizar ou validar nesta spec (`research.md`,
  Decisão 7). Isso muda a partir da spec 008 (Storage, entrada real:
  nome de bucket, cursor de paginação) — não antecipar validação de
  schema aqui.
- **Mensagens de erro sem vazamento de informação sensível**: as duas
  instâncias de `ProviderError` produzidas (405, 404) só interpolam
  `method`/`path` do próprio request — nunca stack trace, variável de
  ambiente ou detalhe de configuração interna (`data-model.md`,
  invariante da seção de `ProviderError`). Isso resolve o ponto que
  `specs/002-definir-contrato-compartilhado/plan.md` já havia
  sinalizado explicitamente para esta spec.
- **Logging**: o único log desta spec é a linha de startup
  (`eventpier-aws ouvindo na porta 4000`, já existia no placeholder da
  spec 003) — nenhum log por requisição é adicionado nesta spec (não
  há requisito que peça isso; evita decidir formato de log estruturado
  sem necessidade concreta ainda).
- **Observabilidade de health real**: continua não existindo até a
  spec 006 — este endpoint não executa nenhuma chamada de rede para
  MiniStack ou qualquer serviço externo, então não há falha de rede
  para observar aqui.

## Artefatos desta fase

- [research.md](./research.md) — decisões técnicas e alternativas rejeitadas
- [data-model.md](./data-model.md) — valores concretos do manifesto e das duas instâncias de `ProviderError`
- [contracts/manifest-endpoint-shape.md](./contracts/manifest-endpoint-shape.md) — código exato: `manifest.service.ts`, `index.ts`, `package.json`, `Dockerfile`, script de validação
- [quickstart.md](./quickstart.md) — validação manual passo a passo, nativo e via Docker Compose

## Observação para `/tasks`

Ordem sugerida: (1) `providers/aws/package.json` — adicionar
`"dependencies": { "@eventpier/contracts": "workspace:*" }` e rodar
`pnpm install` para resolver o link de workspace; (2)
`providers/aws/src/manifest/manifest.service.ts` conforme
`contracts/manifest-endpoint-shape.md`; (3) reescrever
`providers/aws/src/index.ts` (remove o placeholder da spec 003 por
completo); (4) `pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build`,
confirmar `dist/` de ambos; (5) validar manualmente com os passos 1-6
de `quickstart.md` antes de mexer em Docker; (6) atualizar
`providers/aws/Dockerfile` conforme
`contracts/manifest-endpoint-shape.md`; (7)
`docker compose build && docker compose up -d --build`, validar com os
passos 7-10 de `quickstart.md`; (8) criar
`scripts/validate-manifest-endpoint.mjs`; (9) atualizar
`.pipeline/quality-gates.md` — linha **Testes** ganha
`&& node scripts/validate-manifest-endpoint.mjs` ao final da cadeia
existente (nenhuma mudança na linha **Build**, a ordem
contracts-antes-de-provider já está correta); (10) confirmar todos os
quality gates verdes.

Nenhuma task desta spec deve: ler `process.env.MINISTACK_ENDPOINT`/
`MINISTACK_MANAGED` em `providers/aws/src` (spec 007); inserir
qualquer item em `capabilities` (spec 006/008); alterar
`docker-compose.yml`, `apps/ui/` ou `packages/contracts/src/`.
