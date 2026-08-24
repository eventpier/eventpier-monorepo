# Plan — EnvironmentConfig (`endpoint` / `managed`) (007)

## Contexto técnico

Terceira spec da Fase 2 (Provider AWS) — fecha a lacuna deixada
deliberadamente aberta pela spec 006 ("`EnvironmentConfig`
configurável... — spec 007", ver "Fora do escopo" de
`specs/006-cachear-health-check/spec.md`): o campo `environment` do
manifesto hoje é fixo no código
(`{ id: "ministack", managed: true }`, sem `endpoint`), embora
`docker-compose.yml`/`.env.example` já exponham `MINISTACK_ENDPOINT` e
`MINISTACK_MANAGED` desde a spec 003 sem que nenhum código os leia.

Duas Clarificações foram resolvidas com o usuário na sessão de
`/specify` e orientam todo este plano: (1) configuração inválida ou
incompleta (`managed: false` sem endpoint, ou `MINISTACK_MANAGED` não
reconhecível) deve impedir o provider de iniciar (fail-fast), nunca
assumir um default silencioso; (2) o manifesto deve sempre expor
`environment.endpoint` com o valor efetivo em uso, mesmo quando é o
default gerenciado pelo Compose.

Detalhes técnicos e alternativas rejeitadas em `research.md`
(8 decisões); entidades e regras de resolução em `data-model.md`;
código exato (`environment.config.ts`, teste, `manifest.service.ts`,
`index.ts`, scripts de validação, `quality-gates.md`, `ci.yml`) em
`contracts/environment-config-shape.md`; passos de validação manual em
`quickstart.md`.

## Conformidade com `ARQUIVO_REGRAS` / `ARQUIVO_ARQUITETURA`

| Princípio/seção | Como este plano respeita |
|---|---|
| Constitution §2 (Provider e Environment são conceitos distintos) | `Environment` continua um valor autocontido no manifesto, independente de qual capability existir — a UI (spec 009+) segue sabendo apenas o que o manifesto declara, nunca precisa conhecer regras do MiniStack diretamente. |
| Constitution §8 (endpoint do environment sempre configurável) | Esta spec **é** a implementação direta do princípio: `MINISTACK_ENDPOINT`/`MINISTACK_MANAGED` passam a ser efetivamente lidos e refletidos no manifesto (Decisões 1-2 e 5-7 de `research.md`). |
| Constitution §9 (recursos `managed: false` não sofrem ações de ciclo de vida) | Nenhuma ação de restart/start/stop é introduzida — `resolveEnvironmentConfig()` só declara estado, nunca age sobre o ambiente (RF8 de `spec.md`). Nenhum código desta spec chama o MiniStack de nenhuma forma. |
| Constitution §12 (abstração só após necessidade comprovada) | `resolveEnvironmentConfig()` lê `process.env` diretamente, sem parâmetro de injeção especulativo (Decisão 6 de `research.md`); nenhum registro/factory genérico de "providers de configuração" é criado — só o necessário para este único environment (MiniStack). |
| Constitution §13 (contrato é artefato próprio) | `Environment` é importado de `@eventpier/contracts` (já existente desde a spec 002), nunca redefinido dentro de `providers/aws`. `InvalidEnvironmentConfigError` é intencionalmente **não** adicionado ao contrato — é um detalhe de bootstrap do processo, nunca serializado numa resposta HTTP (ver `data-model.md`). |
| Arquitetura §2 (árvore do Estado 1) | `providers/aws/src/config/environment.config.ts` criado exatamente no caminho já previsto na árvore de arquivos. |
| Arquitetura §5 (Configuração de Environment) | Implementação literal da interface `EnvironmentConfig` e das regras de `managed: true`/`false` já documentadas ali — nenhum campo novo além do que a seção já especifica. |
| Arquitetura §8 (Docker Compose) | `MINISTACK_ENDPOINT`/`MINISTACK_MANAGED` já existiam em `docker-compose.yml`/`.env.example` (spec 003) com os mesmos defaults (`http://ministack:4566`, `true`) — esta spec só passa a lê-los de fato; nenhuma mudança em Compose ou `.env.example` é necessária. |

Nenhum conflito entre spec/plano e `ARQUIVO_REGRAS`/`ARQUIVO_ARQUITETURA`
foi identificado.

## Segurança e observabilidade

- **Sem superfície de entrada externa nova**: `MINISTACK_ENDPOINT` e
  `MINISTACK_MANAGED` são variáveis de ambiente definidas por quem
  opera o Eventpier (desenvolvedor local, `docker-compose.yml`) — não
  chegam via rede, query param ou corpo de requisição HTTP. Nenhum
  novo boundary de segurança é introduzido.
- **Sem dados sensíveis**: `endpoint` é uma URL de um MiniStack local
  (emulador, sem credenciais reais — princípio 10 da constitution,
  "sem autenticação em ambientes locais"); nada aqui lida com segredo
  algum.
- **Fail-fast reduz risco de operação silenciosamente incorreta**: uma
  configuração ambígua (`managed: false` sem saber para onde apontar,
  ou um valor de `managed` não reconhecível) encerra o processo em vez
  de assumir um comportamento que poderia levar uma capability futura
  (spec 008+) a operar contra o ambiente errado sem aviso — ver
  Decisão 4 de `research.md` para a justificativa completa desse
  trade-off (deliberadamente diferente do precedente de
  `HEALTH_CHECK_TTL_MS`, spec 006).
- **Mensagem de erro sem vazamento de informação sensível**: a
  mensagem de `InvalidEnvironmentConfigError` só ecoa o nome da
  variável e o valor bruto fornecido pelo próprio operador local — não
  há segredo em trânsito nessas variáveis, então ecoar o valor
  literal na mensagem de erro (para facilitar o diagnóstico) não cria
  exposição indevida.
- **Logging**: `console.error` no fail-fast é o primeiro uso de log
  estruturado-ish neste provider além de `console.log` do bootstrap
  HTTP já existente — não introduz um padrão novo de logging, apenas
  reaproveita o console já usado por `index.ts` (mesma nota já
  registrada em `specs/005-expor-manifesto/plan.md` e
  `specs/006-cachear-health-check/plan.md`: sem padrão de logging
  estruturado definido ainda no projeto).
- **Observabilidade real**: ainda não existe nenhuma chamada de rede
  de verdade para o MiniStack nesta spec — `resolveEnvironmentConfig()`
  só lê variáveis de ambiente locais ao processo, nunca abre conexão.
  A primeira conexão real acontece na spec 008 (Storage).

## Artefatos desta fase

- [research.md](./research.md) — 8 decisões técnicas e alternativas rejeitadas
- [data-model.md](./data-model.md) — `Environment` (reutilizado), `resolveEnvironmentConfig`, `InvalidEnvironmentConfigError`
- [contracts/environment-config-shape.md](./contracts/environment-config-shape.md) — código exato: `environment.config.ts`, teste, `manifest.service.ts`, `index.ts`, dois scripts de validação, `quality-gates.md`, `ci.yml`
- [quickstart.md](./quickstart.md) — validação manual passo a passo (testes, build/typecheck, demonstrações default/externo/fail-fast, `docker compose up`, regressão)

## Observação para `/tasks`

Ordem sugerida: (1)
`providers/aws/src/config/environment.config.ts` conforme
`contracts/environment-config-shape.md`; (2)
`providers/aws/src/config/environment.config.test.ts` conforme o mesmo
arquivo; (3) `pnpm --filter @eventpier/provider-aws test`, confirmar
todos os testes verdes (novos + `health-cache.test.ts` sem regressão)
antes de seguir; (4) alterar
`providers/aws/src/manifest/manifest.service.ts` (assinatura de
`buildManifest`); (5) alterar `providers/aws/src/index.ts`
(bootstrap com fail-fast); (6)
`pnpm --filter @eventpier/contracts build && pnpm --filter @eventpier/provider-aws build && pnpm -r exec tsc --noEmit`,
confirmar sem erros; (7) alterar
`scripts/validate-manifest-endpoint.mjs` (asserção de `endpoint`
default); (8) criar `scripts/validate-environment-config.mjs`
conforme `contracts/environment-config-shape.md`; (9) validar
manualmente com os passos 1-6 de `quickstart.md`; (10) atualizar
`.pipeline/quality-gates.md` — nova entrada na linha "Testes de
integração" e frase explicativa; (11) atualizar
`.github/workflows/ci.yml` — nova linha no step "Testes de integração";
(12) confirmar todos os quality gates verdes, incluindo o passo 7 de
`quickstart.md` (`docker compose up` sem regressão).

Nenhuma task desta spec deve: alterar
`packages/contracts/src/manifest.ts` (tipo `Environment` já é
suficiente); alterar `docker-compose.yml` ou `.env.example` (variáveis
e defaults já existiam desde a spec 003); alterar
`providers/aws/src/manifest/health-cache.ts` (spec 006, não
relacionado); adicionar qualquer capability real ou chamada de
verdade ao MiniStack (Storage é spec 008); adicionar suporte a
environment diferente de MiniStack (LocalStack é explicitamente fora
do MVP em `docs/product.md`); introduzir qualquer ação de
restart/start/stop sobre o MiniStack (princípio 9 da constitution,
permanece proibido mesmo com `managed: false` declarado).
