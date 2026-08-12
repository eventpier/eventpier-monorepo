# Research — Docker Compose do MVP (003)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípios 1, 3, 7, 8, 9,
  10, 11 e 12.
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seção 8 (Arquitetura de
  Containers) e seção 5 (`EnvironmentConfig`).
- `spec.md` desta feature, incluindo a clarificação já resolvida
  durante `/specify` (imagens via build local, não registry).
- `specs/001-setup-monorepo-workspaces/research.md` (Decisão 5: "Dockerfile
  não é criado por esta spec — depende de docker compose (spec 003) e
  de haver algo real para buildar") e
  `specs/002-definir-contrato-compartilhado/research.md` (Decisão 5,
  nota final: `rootDir` explícito é necessário na primeira vez que um
  workspace builda de verdade com `declaration: true`).
- Estado atual dos workspaces (`apps/ui`, `providers/aws`): cada um tem
  só `package.json` com `scripts: {}` e um único
  `src/index.ts` placeholder (`export {}`) — nenhum framework
  instalado, nenhum servidor HTTP real. Next.js (`apps/ui`, spec 009) e
  o framework HTTP do provider (`providers/aws`, spec 005) ainda não
  existem neste ponto do roadmap.

Nenhum conflito entre spec e regras/arquitetura foi encontrado. Um
ponto de atenção real foi identificado e resolvido nas Decisões 3 e 4
abaixo: a spec já compromete um Critério de Sucesso ("os serviços sobem
com sucesso... UI acessível pelo host"), mas nenhum dos dois workspaces
tem hoje um processo que abra porta alguma — sem uma decisão explícita
aqui, o Critério de Sucesso da spec seria inatingível.

## Decisão 1 — Imagem do MiniStack: `ministackorg/ministack:latest`

**Decisão**: usar a imagem publicada `ministackorg/ministack` (variante
padrão, ~110MB — não a `:full`, ~360MB), porta `4566` (default do
projeto, confirmado via documentação oficial), sem montar
`/var/run/docker.sock`.

**Contexto**: `docs/arquitetura.md` §8 usa `image: ministack` como
placeholder sem registry real — esta spec precisa de uma referência
concreta e válida para o Compose de fato subir o serviço.

**Alternativas consideradas**:
- *`ministackorg/ministack:full`* — rejeitada. A variante `full` existe
  para habilitar Athena (DuckDB) e drivers nativos de banco (RDS via
  Postgres/MySQL real). O escopo do MVP (`docs/product.md`) é
  exclusivamente a capability Storage (S3-like) — a imagem padrão já
  cobre isso, e trazer ~250MB a mais de imagem sem uso é desperdício
  sem necessidade comprovada (constitution, princípio 12).
- *Montar `/var/run/docker.sock` no container do MiniStack* — rejeitada.
  Esse socket é necessário apenas para os serviços do MiniStack que
  orquestram containers reais (RDS, ECS, Lambda) — nenhum deles faz
  parte do MVP. Montar o socket do Docker do host sem necessidade é uma
  superfície de ataque desnecessária (qualquer processo dentro do
  container ganharia controle efetivo do Docker do host).

**Consequência para `/tasks`**: `docker-compose.yml` referencia
`ministackorg/ministack:latest` diretamente — ver
`contracts/compose-shape.md`.

## Decisão 2 — `eventpier-ui` e `eventpier-aws`: build local via Dockerfile multi-stage, sem `node_modules` na imagem final

**Decisão**: cada workspace ganha um `Dockerfile` próprio
(`apps/ui/Dockerfile`, `providers/aws/Dockerfile`), com contexto de
build = raiz do monorepo (necessário para o `pnpm install` resolver o
workspace inteiro). Três estágios: `deps` (instala dependências com
`pnpm install --frozen-lockfile`), `build` (copia o código-fonte e
roda `pnpm --filter <pacote> build`), `runtime` (copia só
`dist/` + `package.json` do workspace buildado — **sem** copiar
`node_modules`).

**Justificativa de "sem `node_modules` na imagem final"**: nenhum dos
dois workspaces declara hoje nenhuma dependência de runtime (npm) —
ver `specs/001-setup-monorepo-workspaces/data-model.md`, que registra
que nenhuma dependência real foi declarada ainda além do TypeScript de
dev na raiz. Os placeholders desta spec (Decisão 3) usam só o módulo
`node:http` do core do Node. Copiar `node_modules` vazio seria
trabalho sem efeito.

**Alternativa considerada**: usar `pnpm deploy` (comando nativo do
pnpm para gerar um subdiretório de produção com `node_modules`
podado) — rejeitada por agora, princípio 12. Sem dependências de
runtime reais, não há nada para podar; reavaliar quando a spec 005
(framework HTTP do provider) ou a spec 009 (Next.js) introduzirem a
primeira dependência de runtime real — nesse ponto o estágio `runtime`
desta spec precisará copiar `node_modules` (podado ou não) junto do
`dist/`, o que hoje é desnecessário.

**Consequência para `/tasks`**: `.dockerignore` na raiz exclui
`node_modules`, `dist`, `.git` e afins do contexto de build — ver
`contracts/compose-shape.md`.

## Decisão 3 — Placeholder HTTP mínimo em `apps/ui` e `providers/aws`, sem framework

**Decisão**: `apps/ui/src/index.ts` e `providers/aws/src/index.ts`
deixam de ser `export {}` vazio e passam a abrir um servidor HTTP
mínimo usando só `node:http` (sem Express, sem Next.js, sem nenhuma
dependência nova) — `apps/ui` na porta 3000, `providers/aws` na porta
4000 (mesmas portas já fixadas no exemplo de `arquitetura.md` §8).
Cada um responde texto simples identificando-se como placeholder desta
spec, sem nenhuma lógica de negócio, endpoint de manifesto ou rota
real.

**Por que isso é escopo de `/plan` e não da spec 005/009**: a própria
`spec.md` desta feature (Critérios de Sucesso) já compromete que "os
três serviços sobem com sucesso" e que "a UI... fica acessível pelo
host" — sem *algo* escutando a porta, o container encerraria
imediatamente (processo `node dist/index.js` rodando um módulo vazio
termina sem erro, mas sem nenhum servidor ativo) e o critério seria
estruturalmente inatingível nesta fase do roadmap, já que Next.js
(spec 009) e o framework HTTP do provider (spec 005) ainda não
existem. Este é o mesmo padrão já usado pela spec 002: cada spec
adiciona exatamente o conteúdo mínimo real necessário para o próprio
escopo ser validável, sem antecipar o escopo de specs futuras.

**Alternativas consideradas**:
- *Não adicionar nada, aceitar que os containers de `eventpier-ui`/
  `eventpier-aws` encerram imediatamente* — rejeitada. Contradiria
  diretamente o Critério de Sucesso já aprovado em `spec.md` sem voltar
  à fase de Specify para reabri-lo, o que este comando não tem mandato
  para fazer silenciosamente.
- *Instalar Next.js já nesta spec para `apps/ui` ter um servidor "de
  verdade"* — rejeitada. Antecipa escopo explícito da spec 009 ("Fase
  3... Skeleton Next.js"), introduzindo uma dependência de build
  significativa (e o risco de compatibilidade com TypeScript 7.0.2 já
  sinalizado em `specs/001.../research.md`) só para satisfazer o
  Docker Compose. Um servidor HTTP mínimo do core do Node cumpre o
  mesmo papel de "porta aberta e alcançável" sem esse acoplamento.

**Consequência para `/tasks`**: código exato dos dois placeholders em
`contracts/compose-shape.md`. Ambos os arquivos devem ser inteiramente
substituídos pelas specs 005 (`providers/aws`) e 009 (`apps/ui`) — não
uma base a ser estendida.

## Decisão 4 — `rootDir` explícito nos dois `tsconfig.json`, aplicando a nota já deixada pela spec 002

**Decisão**: `apps/ui/tsconfig.json` e `providers/aws/tsconfig.json`
ganham `"rootDir": "src"` em `compilerOptions`, junto do `outDir`
já existente.

**Justificativa**: `specs/002-definir-contrato-compartilhado/research.md`
já registrou, em "Decisões durante a implementação", que builds reais
com `declaration: true` (herdado de `tsconfig.base.json`) falham com
`TS5011` sem `rootDir` explícito, e sinalizou explicitamente esse risco
para `providers/aws` e `apps/ui` na primeira vez que ganhassem um
build de verdade — que é agora, nesta spec (Decisão 2 exige
`pnpm --filter <pacote> build` funcionando). Aplicar a correção aqui,
em vez de deixar `/tasks`/`/implement` redescobrir o mesmo erro.

## Decisão 5 — Versão de `apps/ui`/`providers/aws`: `0.1.0` → `0.2.0`

**Decisão**: mesmo tratamento dado a `packages/contracts` na spec 002
(Decisão 5 de lá) — ambos os `package.json` sobem para `0.2.0`, por
ganharem, nesta spec, sua primeira superfície real (mesmo que
placeholder) em vez do esqueleto vazio da spec 001.

## Decisão 6 — Node 24 (`node:24-alpine`) e `pnpm@11.10.0` via Corepack, pinados

**Decisão**: `FROM node:24-alpine` nos dois Dockerfiles;
`corepack enable` seguido de `corepack prepare pnpm@11.10.0 --activate`
dentro da imagem. Root `package.json` ganha o campo
`"packageManager": "pnpm@11.10.0"`.

**Justificativa**: `node --version` (v24.13.1) e `pnpm --version`
(11.10.0) no ambiente que já implementou e validou as specs 001/002 —
usar as mesmas versões maiores no Docker evita divergência de
comportamento entre "funciona local" e "funciona no container"
(`pnpm-lock.yaml` já está em `lockfileVersion: '9.0'`, formato gerado
por essa linha do pnpm). Sem o campo `packageManager`, o Corepack usaria
uma versão de fallback não determinística.

**Risco sinalizado**: Node 24 ainda distribui o Corepack (experimental)
— confirmado nas notas de release do projeto Node.js — mas a partir do
Node 25 o Corepack deixa de vir embutido por padrão, exigindo
`npm install -g corepack` à parte. Se uma spec futura atualizar a
imagem base para Node ≥25, o Dockerfile precisa ganhar esse passo
extra — não é necessário agora com Node 24.

## Decisão 7 — Rede e portas: exatamente como `arquitetura.md` §8 já define

**Decisão**: rede interna nomeada `eventpier-net` (driver `bridge`);
`eventpier-ui` publica `3000:3000`; `eventpier-aws` não publica porta
nenhuma; `ministack` publica `4566:4566` só quando o profile
`managed-env` está ativo (`docker compose --profile managed-env up`).
Sem decisão nova aqui — só a aplicação literal dos princípios 7 e 11
da constitution e do exemplo já presente na arquitetura.

## Decisão 8 — Apontar para MiniStack externo em Linux: `extra_hosts` com `host-gateway`

**Decisão**: o serviço `eventpier-aws` ganha:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

**Justificativa**: o cenário 2 de `spec.md` (apontar para um MiniStack
já rodando fora do Compose) normalmente aponta para
`http://host.docker.internal:<porta>`. Esse hostname é resolvido
automaticamente no Docker Desktop (macOS/Windows), mas **não** em
Docker Engine puro no Linux — o ambiente de desenvolvimento verificado
é Linux. Sem este `extra_hosts`, o Critério de Sucesso 2 de `spec.md`
("aponta `eventpier-aws` para um MiniStack externo... e o provider se
conecta normalmente") falharia especificamente em Linux.

## Decisão 9 — Overrides via variáveis de ambiente com default no próprio `docker-compose.yml`

**Decisão**: `MINISTACK_ENDPOINT`, `MINISTACK_MANAGED` e
`HEALTH_CHECK_TTL_MS` usam a sintaxe `${VAR:-default}` do Compose
diretamente no `docker-compose.yml`, com um `.env.example` documentando
as três variáveis (sem valores reais — `.env` real fica de fora do
git, já coberto por `.gitignore`).

**Alternativa considerada**: um `docker-compose.override.yml` separado
para o cenário "MiniStack externo" — rejeitada por princípio 12; três
variáveis de ambiente com default já resolvem o cenário sem exigir que
o desenvolvedor aprenda o mecanismo de override em múltiplos arquivos
do Compose.

## Decisões durante a implementação

- **`@types/node` adicionado como devDependency da raiz (`24.13.3`,
  pinado — mesmo major do Node local, `v24.13.1`), e `"types": ["node"]`
  adicionado a `apps/ui/tsconfig.json` e `providers/aws/tsconfig.json`
  individualmente (não em `tsconfig.base.json`)**, não previsto em
  nenhuma decisão de `research.md`. Ao rodar
  `pnpm --filter @eventpier/ui build` / `... provider-aws build`
  (T009) pela primeira vez com os placeholders da Decisão 3
  (`node:http`, `console.log`), o TypeScript falhou com `TS2591`
  (`node:http` não reconhecido), `TS7006` (parâmetros implicitamente
  `any` nos handlers HTTP) e `TS2584` (`console` não declarado) — sem
  `@types/node`, o compilador não tem as declarações ambiente de
  módulos `node:*` nem dos globais do Node. `packages/contracts` nunca
  precisou disso (spec 002) por não importar nenhum módulo do Node nem
  usar `console`. Escopo deliberadamente restrito aos dois workspaces
  que de fato precisam (`apps/ui`, `providers/aws`), não em
  `tsconfig.base.json`, para não alterar o ambiente de type-checking de
  `packages/contracts` sem necessidade (constitution, princípio 12).
  Sinal para as specs 005/009: `@types/node` já está disponível como
  devDependency compartilhada da raiz, não precisa ser readicionado.
