# Comando: Pipeline Doctor

Verifica a **saúde da configuração do pipeline em si** — não o
progresso de nenhuma feature (isso é `/pipeline-status`). Comando
**somente leitura**: não modifica nada, não corrige nada, não avança
nenhuma fase. Útil logo após copiar este pacote para um projeto novo,
ou periodicamente para detectar configuração que apodreceu com o
tempo (arquivo apagado, roadmap movido, etc.).

## Configuração

Leia `.pipeline/config.md` para obter todos os parâmetros a verificar
(`IDIOMA_ARTEFATOS`, `SPECS_DIR`, `ESTADO_DIR`, `ARQUIVO_REGRAS`,
`ARQUIVO_ARQUITETURA`, `ARQUIVO_PRODUTO`, `ARQUIVO_QUALITY_GATES`,
`ARQUIVO_ROADMAP`, `ARQUIVO_DECISIONS_LOG`, `DOCS_FEATURES_DIR`).

## Execução

Rode as verificações abaixo, na ordem, sem parar em falhas — o
objetivo é um relatório completo, não interromper no primeiro
problema.

1. **`.pipeline/config.md` existe.**
2. **Campos obrigatórios preenchidos**: `IDIOMA_ARTEFATOS`,
   `SPECS_DIR`, `ESTADO_DIR` têm valor (não vazios, não placeholder).
3. **`ARQUIVO_REGRAS` existe** no caminho configurado. Se não existir:
   `⚠`, não `✗` — o pipeline já degrada graciosamente na ausência
   deste arquivo (ver `.pipeline/config.md`), então isso não é erro
   fatal, mas vale sinalizar.
4. **`ARQUIVO_ARQUITETURA` existe** no caminho configurado. Mesma
   regra do item 3: ausência é `⚠`, não `✗`.
5. **`ARQUIVO_PRODUTO`** — se configurado (não vazio em `config.md`),
   confirme que o caminho existe. Ausente mas configurado: `⚠`, mesma
   regra dos itens 3 e 4 (degradação graciosa, `/specify` e o
   `software-dev-panel` já lidam com a ausência). Se deixado vazio de
   propósito, reporte `— (não usado neste projeto)`, não como falha.
6. **`ARQUIVO_PRODUTO` tem seção de escopo reconhecível** — se
   `ARQUIVO_PRODUTO` estiver configurado e o arquivo existir, confirme
   que contém uma seção equivalente a "Fora do MVP"/"Fora do escopo"
   (mesmo termo que `/specify` procura para o alerta de alinhamento).
   Ausente: `⚠` — "ARQUIVO_PRODUTO existe mas sem seção de escopo; o
   alerta de alinhamento do /specify não vai funcionar". Se
   `ARQUIVO_PRODUTO` não estiver configurado ou o arquivo não existir,
   pule esta verificação — já coberta pelo item 5, nada novo a checar
   aqui.
7. **`ARQUIVO_QUALITY_GATES` existe e está preenchido**: abra o
   arquivo (`.pipeline/quality-gates.md` por padrão) e confirme que
   nenhuma célula da tabela ainda contém o placeholder `<preencher>`
   sem edição. Arquivo ausente ou com `<preencher>` remanescente conta
   como não passou.
8. **`ARQUIVO_ROADMAP`** — se configurado (não vazio em `config.md`),
   confirme que o caminho existe. Se `config.md` deixou vazio de
   propósito, reporte `— (não usado neste projeto)`, não como falha.
9. **`ARQUIVO_DECISIONS_LOG`** — mesma regra do item 8.
10. **`DOCS_FEATURES_DIR`** — mesma regra do item 8 (confirma que o
    diretório existe, não que tem conteúdo).
11. **Comandos esperados existem em `.claude/commands/`** (ou
    `.cursor/commands/`, conforme a ferramenta em uso): `specify`,
    `specify-tech`, `plan`, `tasks`, `implement`, `review-pr`,
    `pipeline-status`, `docs-sync`, `pipeline-doctor` — 9 no total.
    Reporte quantos dos 9 foram encontrados.
12. **Skills esperadas existem em `.claude/skills/`**:
    `clarification-protocol`, `software-dev-panel` — 2 no total.
13. **Para cada domínio em `DOCS_FEATURES_DIR`** (se configurado e o
    diretório existir): para cada arquivo `.md` que não seja
    `_template.md`, confirme que contém uma seção "Specs
    Relacionadas" com uma tabela. Se `DOCS_FEATURES_DIR` estiver vazio
    ou não houver nenhum doc de domínio ainda, pule esta verificação
    sem contar como falha (nada para checar ainda).
14. **`.pipeline/version` existe e é legível** — reporte a versão
    detectada. Ausência conta como não passou.

## Saída

```
## Pipeline Doctor

✓ .pipeline/config.md
✓ Campos obrigatórios preenchidos (IDIOMA_ARTEFATOS, SPECS_DIR, ESTADO_DIR)
⚠ ARQUIVO_REGRAS (memory/constitution.md) — não encontrado
⚠ ARQUIVO_ARQUITETURA (docs/arquitetura.md) — não encontrado
✓ ARQUIVO_PRODUTO (docs/product.md)
⚠ ARQUIVO_PRODUTO existe mas sem seção de escopo — alerta de
  alinhamento do /specify não vai funcionar
✗ quality-gates.md — placeholders <preencher> não editados
✓ roadmap.md
✓ decisions-log.md
✓ docs/features/
✓ Comandos (9/9)
✓ Skills (2/2)
⚠ docs/features/onboarding.md — sem tabela "Specs Relacionadas"
✓ Versão do pipeline: 1.1.1

Pipeline: 64% saudável (9/14 verificações passaram)
```

`✓` = passou. `⚠` = degradação graciosa, não fatal, mas sinalizada
(conta como não-passou no percentual). `✗` = falhou. `—` = item não
configurado no projeto (não conta nem a favor nem contra).

Não sugira correções automáticas nem ofereça editar nenhum arquivo —
se o usuário quiser corrigir algo apontado, ele pede explicitamente em
seguida. Este comando só diagnostica.
