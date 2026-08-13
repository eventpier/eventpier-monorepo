# Plan — Docker Compose do MVP (003)

## Contexto técnico

Primeira spec a orquestrar os três serviços do Eventpier via Docker
Compose (`docs/arquitetura.md` §8): `eventpier-ui`, `eventpier-aws` e
`ministack`. Como nenhuma CI de publicação de imagens existe ainda
(spec 004) e nenhum dos dois workspaces do Eventpier tem código real
além de um placeholder vazio (spec 001), este plano cobre duas coisas
que a spec 002 não precisou resolver: (1) build local via Dockerfile
multi-stage em vez de `image:` publicada, e (2) um servidor HTTP
mínimo (só `node:http`, sem framework) para que os containers de fato
tenham algo escutando a porta — sem isso, o Critério de Sucesso já
aprovado em `spec.md` ("os serviços sobem com sucesso... UI acessível
pelo host") seria inatingível nesta fase do roadmap.

Detalhes técnicos e alternativas rejeitadas em `research.md`; topologia
de serviços e variáveis de ambiente em `data-model.md`; conteúdo exato
de cada arquivo em `contracts/compose-shape.md`; passos de validação
manual em `quickstart.md`.

## Conformidade com `ARQUIVO_REGRAS` / `ARQUIVO_ARQUITETURA`

| Princípio/seção | Como este plano respeita |
|---|---|
| Constitution §7 (emulador é infra pública, expõe porta ao host) | `ministack` publica `4566:4566` quando gerenciado — `contracts/compose-shape.md`. |
| Constitution §8 (endpoint do environment sempre configurável) | `MINISTACK_ENDPOINT` via `${VAR:-default}`, sobrescrevível por `.env`/variável de shell sem editar `docker-compose.yml` — `research.md`, Decisão 9. |
| Constitution §9 (recursos não gerenciados não sofrem ação de ciclo de vida) | Não aplicável a esta spec (é comportamento de UI/provider, specs 007/009-011) — sinalizado, não implementado aqui. |
| Constitution §10 (sem autenticação local) | Nenhuma variável de ambiente desta spec carrega credencial — `data-model.md`, invariante de `EnvVar`. |
| Constitution §11 (rede interna restrita; só quem precisa publica porta) | `eventpier-aws` sem `ports:` — `data-model.md`, invariante de `Service`; validado no passo 4 de `quickstart.md`. |
| Constitution §12 (abstração só após necessidade comprovada) | Guiou a rejeição de `pnpm deploy`/`node_modules` na imagem final (research.md, Decisão 2), da imagem `:full` do MiniStack e do socket Docker (Decisão 1), e de `docker-compose.override.yml` (Decisão 9) — nenhuma complexidade nova sem uso real hoje. |
| Arquitetura §8 (Arquitetura de Containers) | Topologia, portas, nomes de serviço e rede replicados exatamente — única mudança deliberada é `image:` → `build:` para os dois serviços do Eventpier (clarificação já resolvida em `/specify`) e `image: ministack` → `image: ministackorg/ministack:latest` (referência real, `research.md` Decisão 1). |
| Arquitetura §5 (`EnvironmentConfig`, `managed`/`endpoint`) | `MINISTACK_ENDPOINT`/`MINISTACK_MANAGED` passados como variáveis de ambiente para `eventpier-aws` — a leitura/uso real desses valores dentro do provider é escopo da spec 007, não desta. |

Nenhum conflito entre spec/plano e `ARQUIVO_REGRAS`/`ARQUIVO_ARQUITETURA`
foi identificado. Um ponto de tensão foi identificado e resolvido
conscientemente, não contornado: a `spec.md` já compromete um Critério
de Sucesso que exige processo real escutando porta em dois workspaces
que hoje só têm placeholder vazio — resolvido pela Decisão 3 de
`research.md` (servidor HTTP mínimo, sem framework, explicitamente
substituível pelas specs 005/009).

## Segurança e observabilidade

- **Superfície de rede**: apenas `eventpier-ui` (3000) e `ministack`
  (4566, quando gerenciado) publicam porta ao host. `eventpier-aws`
  permanece inalcançável de fora da rede `eventpier-net` — validado no
  passo 4/5 de `quickstart.md`.
- **Sem segredos**: nenhuma variável de ambiente desta spec carrega
  credencial, token ou senha — todas são configuração de topologia
  (endpoint, flag booleana, TTL numérico). `.env.example` documenta os
  nomes sem valores reais; `.env` real já é ignorado pelo
  `.gitignore` existente.
- **Docker socket não montado**: rejeitado explicitamente montar
  `/var/run/docker.sock` no `ministack` (research.md, Decisão 1) — não
  é necessário para a capability Storage do MVP, e montá-lo sem
  necessidade daria ao container controle efetivo sobre o Docker do
  host.
- **Imagem de terceiro**: `ministackorg/ministack:latest` não é pinada
  por digest/versão exata nesta spec — usa `latest`, seguindo o próprio
  quickstart oficial do projeto. Risco aceito conscientemente (imagem
  de desenvolvimento local, não produção); reavaliar pin de versão se
  uma atualização do MiniStack quebrar o Compose no futuro.
- **Logging**: os dois placeholders (`apps/ui`, `providers/aws`)
  logam apenas uma linha de "escutando na porta X" no `console.log` —
  nada sensível, nenhum dado de requisição é logado (não há rota real
  ainda).
- **Observabilidade**: fora do escopo — health-check com cache
  (constitution §6) começa na spec 006. Esta spec só garante que a
  variável `HEALTH_CHECK_TTL_MS` chega ao container de `eventpier-aws`
  configurável via ambiente, sem a lógica de cache em si existir ainda.

## Artefatos desta fase

- [research.md](./research.md) — decisões técnicas e alternativas rejeitadas
- [data-model.md](./data-model.md) — topologia de serviços e variáveis de ambiente
- [contracts/compose-shape.md](./contracts/compose-shape.md) — conteúdo exato de cada arquivo a criar/editar
- [quickstart.md](./quickstart.md) — validação manual passo a passo

## Observação para `/tasks`

Ordem sugerida: (1) `package.json` da raiz (`packageManager`); (2)
`apps/ui/tsconfig.json` e `providers/aws/tsconfig.json` (`rootDir`);
(3) `apps/ui/src/index.ts` e `providers/aws/src/index.ts`
(placeholders); (4) `apps/ui/package.json` e `providers/aws/package.json`
(scripts `build`/`start`, versão `0.2.0`); (5) confirmar
`pnpm -r exec tsc --noEmit` e os dois `pnpm --filter ... build` locais
passando antes de tocar Docker; (6) `.dockerignore` na raiz; (7)
`apps/ui/Dockerfile` e `providers/aws/Dockerfile`; (8)
`docker-compose.yml` e `.env.example` na raiz; (9) validar com
`quickstart.md` passos 2-9; (10) atualizar
`.pipeline/quality-gates.md` — estender a linha **Build** existente
para incluir `pnpm --filter @eventpier/provider-aws build` e
`pnpm --filter @eventpier/ui build`, e adicionar uma linha nova
**Docker** (`docker compose build`, critério: exit code 0) logo após
Build e antes de Testes.

Nenhuma task desta spec deve tocar `packages/contracts/`, criar
qualquer rota/endpoint real em `providers/aws` (spec 005) ou instalar
Next.js em `apps/ui` (spec 009), nem CI (spec 004).
