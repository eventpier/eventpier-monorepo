# Configuração do Pipeline

Este arquivo é a **única** fonte de parâmetros específicos de projeto
que os comandos do pipeline devem ler. Nenhum comando (`specify`, `plan`,
`tasks`, `implement`, `review-pr`) deve conter idioma, stack ou caminho
de projeto hardcoded no próprio texto — tudo referencia este arquivo.

Ao adotar este pipeline em um projeto novo, edite **apenas** este
arquivo e `.pipeline/quality-gates.md`. Nunca edite o conteúdo dos
comandos em `.claude/commands/` (ou `.cursor/commands/`) para inserir
informação específica de projeto — se sentir essa necessidade, é sinal
de que a informação pertence aqui ou em `ARQUIVO_REGRAS`.

---

## Idioma

```
IDIOMA_ARTEFATOS: pt-BR
```

Idioma em que `spec.md`, `plan.md`, `tasks.md` e demais artefatos devem
ser escritos. Código-fonte e mensagens de commit seguem a convenção do
próprio projeto (normalmente inglês), independente deste valor.

---

## Regras do projeto

```
ARQUIVO_REGRAS: memory/constitution.md
ARQUIVO_ARQUITETURA: docs/arquitetura.md
```

Caminhos para os documentos que definem princípios não-negociáveis e
decisões de arquitetura. Todo comando do pipeline DEVE ler estes
arquivos antes de produzir qualquer artefato relevante para a fase.

Se algum não existir: alertar o usuário, seguir com defaults razoáveis
de mercado, e documentar explicitamente a ausência no artefato gerado
(não travar o pipeline por isso).

---

## Visão de produto

```
ARQUIVO_PRODUTO: docs/product.md
```

Caminho para o documento de visão de produto: problema que resolve,
público-alvo, proposta de valor/diferencial, escopo do MVP e fora do
escopo, métricas de sucesso. Diferente de `ARQUIVO_REGRAS` (regras de
engenharia, DEVE/NÃO DEVE) e `ARQUIVO_ARQUITETURA` (design técnico),
este é sobre **por que o produto existe e pra quem** — não como
construir nem quais restrições técnicas seguir.

Lido por `/specify` (para alinhar spec nova ao escopo de MVP já
definido) e pelo `software-dev-panel`. **Não** é lido por `/plan`,
`/tasks` ou `/implement` — visão de produto importa na hora de
especificar o quê, não na hora de decidir como construir ou executar;
esses comandos continuam sendo obrigados a ler apenas `ARQUIVO_REGRAS`
e `ARQUIVO_ARQUITETURA`.

Se não existir: alertar o usuário, seguir com defaults razoáveis, e
documentar explicitamente a ausência no artefato gerado (mesma
degradação graciosa de `ARQUIVO_REGRAS`/`ARQUIVO_ARQUITETURA` — não
travar o pipeline por isso). Deixe vazio se o projeto não quiser
manter esse documento.

---

## Quality Gates

```
ARQUIVO_QUALITY_GATES: .pipeline/quality-gates.md
```

Lista de comandos executáveis (typecheck, test, lint, build) que uma
implementação deve passar antes de ser considerada concluída. Ver
`.pipeline/quality-gates.md` para o formato.

---

## Modo de execução

```
MODO_EXECUCAO: supervisionado
```

- **`supervisionado`** (default): cada comando encerra ao fim da fase e
  devolve o controle ao usuário. Recomendado como padrão de segurança.
- **`encadeado`**: ao concluir uma fase com sucesso, o comando avança
  automaticamente para a próxima sem esperar confirmação. Só interrompe
  se: (a) houver uma clarificação sem default razoável possível, ou
  (b) um quality gate falhar após tentativa de correção.

Independente deste valor, `review-pr` **sempre** exige aprovação humana
explícita antes de submeter ao GitHub (Etapa 6 do comando) — isso não é
configurável, é regra fixa do pipeline.

---

## Clarificação

```
MAX_PERGUNTAS_CLARIFICACAO: 5
```

Número máximo de perguntas que `/specify` e `/specify-tech` podem fazer
por sessão antes de assumir defaults razoáveis para o que restar.

---

## Estrutura de diretórios

```
SPECS_DIR: specs/
ESTADO_DIR: .pipeline/state/
```

- `SPECS_DIR`: onde cada feature vive (`specs/<NNN>-<nome>/`).
- `ESTADO_DIR`: onde o `feature-state.json` de cada feature é
  persistido (ver `.pipeline/feature-state.schema.md`).

---

## Commit por fase

```
COMMIT_POR_FASE: true
```

Se `true`, `specify`, `specify-tech`, `plan` e `tasks` fazem commit
automático dos artefatos gerados ao final da fase (checkpoint de
progresso). `implement` sempre comita por task concluída,
independentemente deste valor — essa granularidade é parte fixa da
mecânica de implementação, não uma opção de projeto.

---

## Roadmap

```
ARQUIVO_ROADMAP: .pipeline/roadmap.md
```

Caminho para a lista mestre de specs (ordem de implementação, status
agregado). Diferente de `ESTADO_DIR` (estado detalhado por feature),
este é o arquivo humano-legível que dá visão geral do projeto sem
precisar rodar nenhum comando. Ver `.pipeline/roadmap.md` para o
formato. Se o projeto não quiser manter um roadmap agregado, deixe
vazio — os comandos funcionam normalmente sem ele, só não atualizam
nenhuma visão consolidada.

## Log de decisões

```
ARQUIVO_DECISIONS_LOG: .pipeline/decisions-log.md
```

Caminho para o log agregado de decisões técnicas/produto que
emergiram durante implementações (principalmente as não previstas no
plano). Diferente de `ARQUIVO_ROADMAP` (lido a cada execução de
`/specify`/`/pipeline-status`), este arquivo é atualizado apenas por
`/review-pr` (pós-merge) e lido só sob demanda — não entra no
carregamento automático de contexto dos outros comandos. Ver
`.pipeline/decisions-log.md` para o formato. Deixe vazio se o projeto
não quiser manter esse histórico.

---

## Documentação viva por domínio

```
DOCS_FEATURES_DIR: docs/features/
```

Diretório onde a documentação de domínio/funcionalidade é mantida —
um arquivo por módulo (ex.: `pricing.md`, `accounts.md`), refletindo o
comportamento **atual**, não o histórico spec por spec. Atualizado
incrementalmente por `/docs-sync` (chamado automaticamente por
`/review-pr` na Etapa 8, ou manualmente). Cada doc de domínio mantém
uma tabela "Specs Relacionadas" — histórico de specs que o tocaram,
usada para detectar recorrência de bugs (ver `/specify-tech`). Deixe
vazio se o projeto não quiser manter essa documentação.

---

## Documentos de status (opcional)

```
ARQUIVOS_STATUS: []
```

Lista opcional de documentos de acompanhamento do projeto (ex.:
`IMPLEMENTATION_STATUS.md`, `FEATURE_LIST.md`) que devem ser
atualizados na Etapa 8 do `review-pr` (pós-merge). Deixe vazio se o
projeto não mantiver esse tipo de documento — o pipeline não exige.

Exemplo preenchido:
```
ARQUIVOS_STATUS:
  - IMPLEMENTATION_STATUS.md
  - FEATURE_LIST.md
```
