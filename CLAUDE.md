# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar neste
repositório.

## Eventpier

Organização open-source de ferramentas para inspeção e debugging de
ambientes cloud locais (hoje: AWS via MiniStack). Uma UI desacoplada
de cloud consome um contrato comum de capabilities exposto por
providers independentes por cloud (AWS, e futuramente Azure/GCP).

## Este projeto usa um pipeline formal: specify → plan → tasks → implement → review-pr

Features e correções passam pelos comandos abaixo, nesta ordem. Cada
comando é autodescritivo — para saber exatamente o que um deles faz,
leia `.claude/commands/<nome>.md` diretamente; não redocumente o
comportamento aqui, porque desatualiza.

| Comando | Quando usar |
|---|---|
| `/specify` | Nova feature — o quê/por quê, nunca o como |
| `/specify-tech` | Bug, débito técnico ou refatoração |
| `/plan` | Desenhar o como, a partir da spec |
| `/tasks` | Quebrar o plano em tasks ordenadas e testáveis |
| `/implement` | Executar as tasks, comitando por task |
| `/review-pr` | Revisar e aprovar merge (exige aprovação humana explícita) |
| `/pipeline-status` | Visão geral de todas as features em andamento |
| `/docs-sync` | Atualizar `docs/features/<domínio>.md` (roda automático no review-pr) |
| `/pipeline-doctor` | Checar a saúde da configuração do pipeline em si |

## Configuração do pipeline

`.pipeline/config.md` é a fonte única dos parâmetros deste projeto —
nunca assuma idioma, stack ou caminho fora dele. Os documentos que ele
referencia:

- `ARQUIVO_REGRAS` (`memory/constitution.md`) — princípios de
  engenharia não-negociáveis deste projeto.
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`) — decisões técnicas e
  desenho do sistema.
- `ARQUIVO_PRODUTO` (`docs/product.md`) — visão de produto: problema,
  público-alvo, escopo de MVP.

## Regras não-negociáveis herdadas do pipeline

- **Nunca edite `.claude/commands/*.md`** para inserir conteúdo deste
  projeto (stack, exemplos, nomes de módulo). Se um comando parecer
  precisar disso, a informação pertence a `ARQUIVO_REGRAS` ou
  `ARQUIVO_ARQUITETURA` — é isso que mantém o pacote atualizável.
- `.pipeline/state/*.json` é **intencionalmente comitado**, não
  ignorado pelo git — permite retomar uma feature em outra
  máquina/sessão. Não adicione ao `.gitignore`.
- `/review-pr` **sempre** exige aprovação humana explícita antes de
  escrever no GitHub, independente de `MODO_EXECUCAO`.
- Se houver mais de uma feature em estado ambíguo (`.pipeline/state/`
  com múltiplos arquivos incompletos), pergunte ao usuário qual retomar
  em vez de adivinhar.

## Regras de engenharia deste projeto

Regras de código (convenções, padrões DEVE/NÃO DEVE) vivem em
`ARQUIVO_REGRAS`, não aqui — este arquivo orienta *como trabalhar no
repositório e com o pipeline*, a constitution define *como o código
deve ser escrito*. Duplicar regras de engenharia aqui cria divergência
entre os dois documentos com o tempo.

## Estado atual e por onde começar

O repositório ainda está na fase de configuração do pipeline: nenhum
workspace de código foi criado ainda (`apps/ui`, `providers/aws`,
`packages/contracts` de `docs/arquitetura.md` são o alvo, não o estado
atual). Não existe `package.json` nem scripts de build/test/lint —
por isso `.pipeline/quality-gates.md` está com os comandos em aberto
(`<preencher>`); preencha assim que o workspace correspondente nascer.

O ponto de partida é `.pipeline/roadmap.md`, Fase 1, spec 001 (setup
do monorepo). Rode `/specify` para abrir a primeira spec.

Alto nível da stack (detalhes em `docs/arquitetura.md` e
`memory/constitution.md`):

| Camada | Tecnologia |
|---|---|
| UI (`apps/ui`) | Next.js, TypeScript, Storybook |
| Provider AWS (`providers/aws`) | Node.js, TypeScript |
| Contrato (`packages/contracts`) | TypeScript, versionado via `contractVersion` |
| Containerização | Docker, Docker Compose |
| Environment inicial | MiniStack |

Este monorepo (`apps/*`, `providers/*`, `packages/*` como workspaces)
é o Estado 1 de três descritos em `docs/arquitetura.md` — a divisão em
repositórios próprios (`eventpier-ui`, `eventpier-providers`,
`eventpier-contracts`) só acontece ao iniciar o segundo provider real
(Azure ou GCP), não antes.
